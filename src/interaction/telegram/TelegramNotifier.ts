// src/interaction/telegram/TelegramNotifier.ts
// Handles sending notifications to Telegram

import TelegramBotApi from 'node-telegram-bot-api';
import { MessageTemplates } from './MessageTemplates';
import { PermissionAssessment } from '../../types/permission.types';
import { PreparedOrder } from '../../types/order.types';
import { MESSAGE_TIERS } from '../../config/constants';
import { log } from '../../utils/logger';

/**
 * TelegramNotifier sends formatted messages to traders.
 * 
 * Message Tiers (per Phase 3 §4.3):
 * - T1 INFO: Daily updates, batch permitted
 * - T2 WARNING: Risk factors, max 3/hour per asset
 * - T3 ALERT: Permission changes, immediate
 * - T4 CRITICAL: System failures, requires acknowledgment
 */
export class TelegramNotifier {
  private bot: TelegramBotApi;
  private chatId: string;
  private templates: MessageTemplates;

  constructor(bot: TelegramBotApi, chatId: string) {
    this.bot = bot;
    this.chatId = chatId;
    this.templates = new MessageTemplates();
  }

  /**
   * Send a permission update (T1: INFO)
   */
  async sendPermissionUpdate(assessment: PermissionAssessment): Promise<void> {
    const message = this.templates.permissionUpdate(assessment);
    await this.send(message, MESSAGE_TIERS.T1_INFO);
  }

  /**
   * Send a risk warning (T2: WARNING)
   */
  async sendRiskWarning(assessment: PermissionAssessment, riskType: string): Promise<void> {
    const message = this.templates.riskWarning(assessment, riskType);
    await this.send(message, MESSAGE_TIERS.T2_WARNING);
  }

  /**
   * Send a permission change alert (T3: ALERT)
   */
  async sendPermissionChange(
    asset: string,
    previousState: string,
    currentState: string,
    trigger: string
  ): Promise<void> {
    const message = this.templates.permissionChange(
      asset,
      previousState,
      currentState,
      trigger
    );
    await this.send(message, MESSAGE_TIERS.T3_ALERT);
  }

  /**
   * Send order confirmation request (T3: ALERT)
   */
  async sendOrderConfirmationRequest(order: PreparedOrder): Promise<void> {
    const message = this.templates.orderConfirmationRequest(order);
    await this.send(message, MESSAGE_TIERS.T3_ALERT);
  }

  /**
   * Send Auto-Protect activation notice (T4: CRITICAL)
   */
  async sendAutoProtectActivation(
    asset: string,
    reason: string,
    action: string
  ): Promise<void> {
    const message = this.templates.autoProtectActivation(asset, reason, action);
    await this.send(message, MESSAGE_TIERS.T4_CRITICAL);
  }

  /**
   * Send system critical message (T4: CRITICAL)
   */
  async sendSystemCritical(title: string, details: string): Promise<void> {
    const message = this.templates.systemCritical(title, details);
    await this.send(message, MESSAGE_TIERS.T4_CRITICAL);
  }

  /**
   * Send order execution result
   */
  async sendExecutionResult(
    orderId: string,
    asset: string,
    success: boolean,
    details: {
      fillPrice?: number;
      fillSize?: number;
      error?: string;
    }
  ): Promise<void> {
    const message = this.templates.executionResult(orderId, asset, success, details);
    await this.send(message, success ? MESSAGE_TIERS.T1_INFO : MESSAGE_TIERS.T3_ALERT);
  }

  /**
   * Send a custom message
   */
  async sendCustomMessage(message: string, tier: string = MESSAGE_TIERS.T1_INFO): Promise<void> {
    await this.send(message, tier);
  }

  /**
   * Internal send method
   */
  private async send(message: string, tier: string): Promise<void> {
    try {
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      
      log.debug(`Sent ${tier} message`, { tier, length: message.length });
    } catch (error) {
      log.error(`Failed to send ${tier} message`, {
        tier,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send market status update (T1: INFO)
   */
  async sendMarketStatus(
    asset: string,
    price: number,
    priceChange24h: number,
    volStance: string,
    impliedVol: number | null,
    flowDirection: string,
    permissionState: string
  ): Promise<void> {
    const message = this.templates.marketStatus(
      asset,
      price,
      priceChange24h,
      volStance,
      impliedVol,
      flowDirection,
      permissionState
    );
    await this.send(message, MESSAGE_TIERS.T1_INFO);
  }

  /**
   * Send volatility/flash move alert (T3: ALERT)
   */
  async sendVolatilityAlert(
    asset: string,
    triggerType: 'PRICE_CHANGE' | 'VOL_STANCE_CHANGE',
    details: {
      priceChange?: number;
      currentPrice?: number;
      previousVolStance?: string;
      currentVolStance?: string;
    }
  ): Promise<void> {
    const message = this.templates.volatilityAlert(asset, triggerType, details);
    await this.send(message, MESSAGE_TIERS.T3_ALERT);
  }

  /**
   * Send scanner notification (T2: WARNING)
   */
  async sendScannerNotification(
    type: 'NO_ASSETS' | 'WATCHLIST_UPDATED',
    details: {
      assets?: string[];
      reason?: string;
    }
  ): Promise<void> {
    const message = this.templates.scannerNotification(type, details);
    await this.send(message, MESSAGE_TIERS.T2_WARNING);
  }

  /**
   * Send to a specific chat (for direct replies)
   */
  async sendToChat(chatId: number | string, message: string): Promise<void> {
    try {
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    } catch (error) {
      log.error('Failed to send message to chat', {
        chatId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

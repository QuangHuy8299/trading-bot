// src/execution/OrderExecutionService.ts
// Main service for managing auto-entry flow with pending orders

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BinanceExecutor, ExecutionResult } from './BinanceExecutor';
import { SignalGenerator } from './SignalGenerator';
import { TradeSuggestion, RiskConfig } from '../types/execution.types';
import { GateEvaluationResult, PermissionAssessment } from '../types';
import { env } from '../config/environment';
import { log } from '../utils/logger';

export interface PendingOrder {
  id: string;
  suggestion: TradeSuggestion;
  createdAt: Date;
  expiresAt: Date;
  confirmed: boolean;
}

export class OrderExecutionService extends EventEmitter {
  private signalGenerator: SignalGenerator;
  private executor: BinanceExecutor;
  private pendingOrders: Map<string, PendingOrder>;
  private activePositions: Set<string>; // Track assets with open positions

  constructor(
    executor: BinanceExecutor,
    riskConfig: RiskConfig
  ) {
    super();
    this.executor = executor;
    this.signalGenerator = new SignalGenerator(riskConfig);
    this.pendingOrders = new Map();
    this.activePositions = new Set();

    // Cleanup expired orders every 30 seconds
    setInterval(() => this.cleanupExpiredOrders(), 30000);
  }

  /**
   * Process a trading signal and decide whether to execute or queue
   */
  async processSignal(
    asset: string,
    currentPrice: number,
    gates: GateEvaluationResult,
    permission: PermissionAssessment
  ): Promise<void> {
    // Check if auto-entry is enabled
    if (!env.AUTO_ENTRY_ENABLED) {
      log.debug('OrderExecutionService: Auto-entry disabled, skipping', { asset });
      return;
    }

    // Check if we already have a position for this asset
    if (this.activePositions.has(asset)) {
      log.debug('OrderExecutionService: Position already exists for asset', { asset });
      return;
    }

    // Check max concurrent positions limit
    if (this.activePositions.size >= env.MAX_CONCURRENT_POSITIONS) {
      log.warn('OrderExecutionService: Max concurrent positions reached', {
        current: this.activePositions.size,
        max: env.MAX_CONCURRENT_POSITIONS,
      });
      return;
    }

    // Generate signal
    const suggestion = this.signalGenerator.generate(asset, currentPrice, gates, permission);

    if (!suggestion) {
      log.debug('OrderExecutionService: No valid signal generated', { asset });
      return;
    }

    // Check confidence threshold
    if (suggestion.confidenceScore < env.MIN_CONFIDENCE_SCORE) {
      log.info('OrderExecutionService: Signal confidence too low', {
        asset,
        confidence: suggestion.confidenceScore,
        threshold: env.MIN_CONFIDENCE_SCORE,
      });
      return;
    }

    // Process based on AUTO_ENTRY_MODE
    const mode = env.AUTO_ENTRY_MODE;

    if (mode === 'AUTO') {
      // Immediate execution without confirmation
      await this.executeImmediately(suggestion);
    } else if (mode === 'SAFE') {
      // Queue for manual confirmation via Telegram
      this.queueForConfirmation(suggestion);
    } else if (mode === 'HYBRID') {
      // Execute immediately only if confidence is very high (e.g., >= 80)
      if (suggestion.confidenceScore >= 80) {
        await this.executeImmediately(suggestion);
      } else {
        this.queueForConfirmation(suggestion);
      }
    }
  }

  /**
   * Execute order immediately (AUTO mode)
   */
  private async executeImmediately(suggestion: TradeSuggestion): Promise<void> {
    log.info('OrderExecutionService: Executing order immediately', {
      asset: suggestion.asset,
      direction: suggestion.direction,
    });

    const result = await this.executor.executeTradeWithTpSl(suggestion);

    if (result.success) {
      // Mark asset as having an active position
      this.activePositions.add(suggestion.asset);

      // Emit event for notification
      this.emit('order:executed', {
        suggestion,
        result,
      });

      log.info('OrderExecutionService: Order executed successfully', {
        asset: suggestion.asset,
        orderId: result.entryOrder.orderId,
      });
    } else {
      this.emit('order:failed', {
        suggestion,
        error: result.error,
      });

      log.error('OrderExecutionService: Order execution failed', {
        asset: suggestion.asset,
        error: result.error,
      });
    }
  }

  /**
   * Queue order for manual confirmation (SAFE mode)
   */
  private queueForConfirmation(suggestion: TradeSuggestion): void {
    const orderId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + env.ORDER_CONFIRMATION_TIMEOUT_MS);

    const pendingOrder: PendingOrder = {
      id: orderId,
      suggestion,
      createdAt: now,
      expiresAt,
      confirmed: false,
    };

    this.pendingOrders.set(orderId, pendingOrder);

    log.info('OrderExecutionService: Order queued for confirmation', {
      orderId,
      asset: suggestion.asset,
      expiresAt,
    });

    // Emit event for Telegram notification
    this.emit('order:pending', {
      orderId,
      suggestion,
      expiresAt,
    });
  }

  /**
   * Confirm and execute a pending order (called via /confirm command)
   */
  async confirmOrder(orderId: string): Promise<ExecutionResult | null> {
    const pendingOrder = this.pendingOrders.get(orderId);

    if (!pendingOrder) {
      log.warn('OrderExecutionService: Order not found', { orderId });
      return null;
    }

    // Check if expired
    if (new Date() > pendingOrder.expiresAt) {
      log.warn('OrderExecutionService: Order expired', { orderId });
      this.pendingOrders.delete(orderId);
      return null;
    }

    log.info('OrderExecutionService: Confirming order', { orderId });

    // Execute the order
    const result = await this.executor.executeTradeWithTpSl(pendingOrder.suggestion);

    // Remove from pending queue
    this.pendingOrders.delete(orderId);

    if (result.success) {
      this.activePositions.add(pendingOrder.suggestion.asset);

      this.emit('order:confirmed', {
        orderId,
        suggestion: pendingOrder.suggestion,
        result,
      });
    } else {
      this.emit('order:failed', {
        orderId,
        suggestion: pendingOrder.suggestion,
        error: result.error,
      });
    }

    return result;
  }

  /**
   * Cancel a pending order
   */
  cancelOrder(orderId: string): boolean {
    const deleted = this.pendingOrders.delete(orderId);

    if (deleted) {
      log.info('OrderExecutionService: Order cancelled', { orderId });
      this.emit('order:cancelled', { orderId });
    }

    return deleted;
  }

  /**
   * Get all pending orders
   */
  getPendingOrders(): PendingOrder[] {
    return Array.from(this.pendingOrders.values());
  }

  /**
   * Get a specific pending order
   */
  getPendingOrder(orderId: string): PendingOrder | undefined {
    return this.pendingOrders.get(orderId);
  }

  /**
   * Notify that a position was closed (to update activePositions)
   */
  notifyPositionClosed(asset: string): void {
    this.activePositions.delete(asset);
    log.info('OrderExecutionService: Position closed notification', { asset });
  }

  /**
   * Cleanup expired pending orders
   */
  private cleanupExpiredOrders(): void {
    const now = new Date();
    const expired: string[] = [];

    for (const [orderId, order] of this.pendingOrders) {
      if (now > order.expiresAt) {
        expired.push(orderId);
      }
    }

    if (expired.length > 0) {
      log.info('OrderExecutionService: Cleaning up expired orders', {
        count: expired.length,
        orderIds: expired,
      });

      for (const orderId of expired) {
        this.pendingOrders.delete(orderId);
        this.emit('order:expired', { orderId });
      }
    }
  }
}

// src/interaction/telegram/TelegramBot.ts

import TelegramBotApi from 'node-telegram-bot-api';
import { env } from '../../config/environment';
import { CommandHandler } from './CommandHandler';
import { TelegramNotifier } from './TelegramNotifier';
import { AuditLogger } from '../../infrastructure/audit';
import { log } from '../../utils/logger';

export class TelegramBot {
  private bot: TelegramBotApi;
  private commandHandler: CommandHandler;
  private notifier: TelegramNotifier;
  private auditLogger: AuditLogger;
  private authorizedUsers: Set<string>;

  constructor(commandHandler: CommandHandler, auditLogger: AuditLogger) {
    this.bot = new TelegramBotApi(env.TELEGRAM_BOT_TOKEN, { polling: true });
    this.commandHandler = commandHandler;
    this.auditLogger = auditLogger;
    this.authorizedUsers = new Set(env.TELEGRAM_ADMIN_IDS);
    this.notifier = new TelegramNotifier(this.bot, env.TELEGRAM_CHAT_ID);

    this.setupHandlers();
    log.info('Telegram bot initialized and listening');
  }

  private isAuthorized(msg: TelegramBotApi.Message): boolean {
    const userId = msg.from?.id.toString();
    return !!userId && this.authorizedUsers.has(userId);
  }

  private setupHandlers(): void {
    // Message handler for unauthorized access
    this.bot.on('message', (msg) => {
      if (msg.text?.startsWith('/') && !this.isAuthorized(msg)) {
        void this.handleUnauthorized(msg);
      }
    });

    // Command handlers with proper error handling
    this.bot.onText(/\/start/, (msg) => {
      if (!this.isAuthorized(msg)) return;
      void this.sendWelcome(msg.chat.id);
    });

    this.bot.onText(/\/help/, (msg) => {
      if (!this.isAuthorized(msg)) return;
      void this.sendHelp(msg.chat.id);
    });

    this.bot.onText(/\/status(?:\s+(\w+))?/, (msg, match) => {
      if (!this.isAuthorized(msg)) return;
      void this.routeCommand(msg, 'status', match?.[1]);
    });

    this.bot.onText(/\/safety/, (msg) => {
      if (!this.isAuthorized(msg)) return;
      void this.routeCommand(msg, 'safety');
    });

    this.bot.onText(/\/killswitch/, (msg) => {
      if (!this.isAuthorized(msg)) return;
      void this.routeCommand(msg, 'killswitch');
    });

    // Error handling for polling
    this.bot.on('polling_error', (error) => {
      log.error('Telegram polling error', { error: error.message });
    });
  }

  private async routeCommand(
    msg: TelegramBotApi.Message,
    command: string,
    ...args: (string | undefined)[]
  ): Promise<void> {
    const userId = msg.from?.id.toString() ?? 'unknown';
    const chatId = msg.chat.id;

    try {
      this.auditLogger.logTraderAction({
        actionType: 'COMMAND_RECEIVED',
        traderId: userId,
        details: { command, args: args.filter(Boolean) },
        timestamp: new Date(),
      });

      const response = await this.commandHandler.handle(
        command,
        args.filter((a): a is string => !!a),
        userId
      );

      await this.bot.sendMessage(chatId, response, { 
        parse_mode: 'HTML',
        disable_web_page_preview: true 
      });
    } catch (error) {
      const msgError = error instanceof Error ? error.message : 'Unknown error';
      
      try {
        await this.bot.sendMessage(
          chatId, 
          `❌ <b>Error:</b> ${msgError}`, 
          { parse_mode: 'HTML' }
        );
      } catch (sendError) {
        log.error('Failed to send error message', { 
          error: sendError instanceof Error ? sendError.message : 'Unknown error' 
        });
      }
      
      log.error(`Command failed: ${command}`, { error: msgError, userId });
    }
  }

  private async sendWelcome(chatId: number): Promise<void> {
    try {
      const text = `
🤖 <b>TK Trading System Online</b>
Decision Support System is active.

Use /help to see available commands.
    `.trim();
      await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch (error) {
      log.error('Failed to send welcome message', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        chatId 
      });
    }
  }

  private async sendHelp(chatId: number): Promise<void> {
    try {
      const text = `
<b>📊 Information</b>
/status - All asset states
/status [ASSET] - Specific asset details
/safety - System safety status

<b>🚨 Emergency</b>
/killswitch - Emergency stop
    `.trim();
      await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch (error) {
      log.error('Failed to send help message', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        chatId 
      });
    }
  }

  private async handleUnauthorized(msg: TelegramBotApi.Message): Promise<void> {
    try {
      const userId = msg.from?.id.toString() ?? 'unknown';
      await this.bot.sendMessage(
        msg.chat.id,
        `⛔ <b>Access Denied</b>\nYour ID: <code>${userId}</code> is not authorized.`,
        { parse_mode: 'HTML' }
      );
      log.warn('Unauthorized access attempt', { userId, text: msg.text });
    } catch (error) {
      log.error('Failed to send unauthorized message', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  public getNotifier(): TelegramNotifier {
    return this.notifier;
  }

  public stop(): void {
    void this.bot.stopPolling();
    log.info('Telegram bot stopped');
  }
}
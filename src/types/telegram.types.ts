// src/types/telegram.types.ts
// Type definitions for Telegram integration

export enum MessageTier {
  T1_INFO = 'T1_INFO',
  T2_WARNING = 'T2_WARNING',
  T3_ALERT = 'T3_ALERT',
  T4_CRITICAL = 'T4_CRITICAL'
}

export interface TelegramMessage {
  tier: MessageTier;
  type: string;
  content: string;
  asset?: string;
  timestamp: Date;
  messageId?: string;
  requiresAcknowledgment: boolean;
}

export interface TelegramCommand {
  command: string;
  args: string[];
  userId: string;
  chatId: string;
  timestamp: Date;
}

export interface CommandResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export type TelegramCommandType = 
  | 'status'
  | 'prepare_reduce'
  | 'prepare_close'
  | 'confirm'
  | 'cancel'
  | 'override'
  | 'enable_autoprotect'
  | 'disable_autoprotect'
  | 'killswitch'
  | 'help';

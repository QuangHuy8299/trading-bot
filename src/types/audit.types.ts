// src/types/audit.types.ts
// Type definitions for audit logging

import { PermissionAssessment, PermissionState } from './permission.types';
import { GateEvaluationResult } from './gates.types';
import { OrderStatus } from './order.types';

export interface BaseAuditEntry {
  timestamp: Date;
  entryId?: string;
}

export interface SystemEventLog extends BaseAuditEntry {
  type: 'SYSTEM_EVENT';
  eventType: string;
  details: Record<string, unknown>;
}

export interface GateEvaluationLog extends BaseAuditEntry {
  type: 'GATE_EVALUATION';
  asset: string;
  result: GateEvaluationResult;
  dataQuality: {
    overall: string;
    binance: { fresh: boolean };
    option: { fresh: boolean; available: boolean };
    whale: { fresh: boolean; available: boolean };
  };
}

export interface TraderActionLog extends BaseAuditEntry {
  type: 'TRADER_ACTION';
  actionType: string;
  traderId: string;
  asset?: string;
  details: Record<string, unknown>;
}

export interface OverrideLog extends BaseAuditEntry {
  type: 'OVERRIDE';
  level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
  asset: string;
  reason: string;
  traderId: string;
  assessmentAtOverride: PermissionAssessment;
}

export interface ExecutionLog extends BaseAuditEntry {
  type: 'EXECUTION';
  orderId: string;
  asset: string;
  action: string;
  status: 'ATTEMPT' | 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  exchangeOrderId?: string;
  fillPrice?: number;
  fillSize?: number;
  failureReason?: string;
  blockedBy?: string;
}

export interface AutoProtectLog extends BaseAuditEntry {
  type: 'AUTO_PROTECT';
  status: 'TRIGGERED' | 'EXECUTED' | 'FAILED';
  asset: string;
  action: string;
  triggerReason?: string;
  exchangeOrderId?: string;
  fillPrice?: number;
  error?: string;
}

export interface SecurityEventLog extends BaseAuditEntry {
  type: 'SECURITY_EVENT';
  eventType: string;
  userId?: string;
  details: Record<string, unknown>;
}

export interface Tier1ViolationLog extends BaseAuditEntry {
  type: 'TIER1_VIOLATION';
  violationType: string;
  reason: string;
  asset?: string;
  details: Record<string, unknown>;
}

export type AuditLogEntry = 
  | SystemEventLog
  | GateEvaluationLog
  | TraderActionLog
  | OverrideLog
  | ExecutionLog
  | AutoProtectLog
  | SecurityEventLog
  | Tier1ViolationLog;

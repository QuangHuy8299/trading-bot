// src/types/audit.types.ts
// Audit log type definitions

export interface SystemEventLog {
  type: 'SYSTEM_EVENT';
  entryId: string;
  eventType: string;
  details: any;
  timestamp: Date;
}

export interface GateEvaluationLog {
  type: 'GATE_EVALUATION';
  entryId: string;
  asset: string;
  result: any;
  dataQuality: {
    overall: number;
    binance?: { fresh: boolean };
    option?: { fresh: boolean; available: boolean };
    whale?: { fresh: boolean; available: boolean };
  };
  timestamp: Date;
}

export interface TraderActionLog {
  type: 'TRADER_ACTION';
  entryId: string;
  actionType: string;
  traderId: string;
  asset: string;
  details: any;
  timestamp: Date;
}

export interface OverrideLog {
  type: 'OVERRIDE';
  entryId: string;
  level: string;
  asset: string;
  reason: string;
  traderId: string;
  assessmentAtOverride: any;
  timestamp: Date;
}

export interface ExecutionLog {
  type: 'EXECUTION';
  entryId: string;
  orderId: string;
  asset: string;
  action: string;
  status: 'ATTEMPT' | 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  exchangeOrderId?: string;
  fillPrice?: number;
  fillSize?: number;
  failureReason?: string;
  blockedBy?: string;
  timestamp: Date;
}

export interface AutoProtectLog {
  type: 'AUTO_PROTECT';
  entryId: string;
  status: 'TRIGGERED' | 'EXECUTED' | 'FAILED';
  asset: string;
  action: string;
  triggerReason?: string;
  error?: string;
  exchangeOrderId?: string;
  fillPrice?: number;
  timestamp: Date;
}

export interface SecurityEventLog {
  type: 'SECURITY_EVENT';
  entryId: string;
  eventType: string;
  userId: string;
  details: any;
  timestamp: Date;
}

export interface Tier1ViolationLog {
  type: 'TIER1_VIOLATION';
  entryId: string;
  violationType: string;
  reason: string;
  asset: string;
  details: any;
  timestamp: Date;
}

// Aggregate type for all audit log entries
export type AuditLogEntry =
  | SystemEventLog
  | GateEvaluationLog
  | TraderActionLog
  | OverrideLog
  | ExecutionLog
  | AutoProtectLog
  | SecurityEventLog
  | Tier1ViolationLog;

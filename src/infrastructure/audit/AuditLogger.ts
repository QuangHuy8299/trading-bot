// src/infrastructure/audit/AuditLogger.ts
// Comprehensive audit logging system

import { createLogger, format, transports, Logger } from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/environment';
import {
  SystemEventLog,
  GateEvaluationLog,
  TraderActionLog,
  OverrideLog,
  ExecutionLog,
  AutoProtectLog,
  SecurityEventLog,
  Tier1ViolationLog,
} from '../../types/audit.types';

const { combine, timestamp, json, printf } = format;

/**
 * AuditLogger provides comprehensive logging for all system activities.
 *
 * Per Phase 3.5 §4: All system outputs and trader actions must be logged.
 *
 * Log Types:
 * - System Events: Startup, shutdown, configuration changes
 * - Gate Evaluations: All gate assessment results
 * - Trader Actions: Commands, acknowledgments, requests
 * - Overrides: All override attempts and results
 * - Executions: Order attempts, successes, failures
 * - Auto-Protect: Trigger conditions and actions
 * - Security Events: Auth failures, suspicious activity
 * - Tier 1 Violations: Constraint violation attempts
 */
export class AuditLogger {
  private appLogger: Logger;
  private auditLogger: Logger;

  constructor() {
    // Application logger (general logs)
    this.appLogger = createLogger({
      level: env.LOG_LEVEL,
      format: combine(timestamp(), json()),
      transports: [
        new transports.Console({
          format: combine(
            format.colorize(),
            timestamp({ format: 'HH:mm:ss' }),
            printf(({ level, message, timestamp, ...meta }) => {
              const metaString = meta && typeof meta === 'object' ? JSON.stringify(meta) : '';
              return `${String(timestamp)} [${String(level)}]: ${String(message)} ${String(metaString)}`;
            })
          ),
        }),
        new transports.File({
          filename: 'logs/app.log',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        }),
        new transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
        }),
      ],
    });

    // Audit logger (immutable audit trail)
    this.auditLogger = createLogger({
      level: 'info',
      format: combine(timestamp(), json()),
      transports: [
        new transports.File({
          filename: 'logs/audit.log',
          options: { flags: 'a' }, // Append only
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 10,
        }),
      ],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  logSystemEvent(entry: Omit<SystemEventLog, 'type' | 'entryId'>): void {
    const log: SystemEventLog = {
      type: 'SYSTEM_EVENT',
      entryId: uuidv4(),
      eventType: entry.eventType,
      details: entry.details,
      timestamp: entry.timestamp,
    };

    this.auditLogger.info('SYSTEM_EVENT', log);
    this.appLogger.info(`System Event: ${entry.eventType}`, entry.details);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GATE EVALUATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  logGateEvaluation(entry: Omit<GateEvaluationLog, 'type' | 'entryId'>): void {
    const log: GateEvaluationLog = {
      type: 'GATE_EVALUATION',
      entryId: uuidv4(),
      asset: entry.asset,
      result: entry.result,
      dataQuality: entry.dataQuality,
      timestamp: entry.timestamp,
    };

    this.auditLogger.info('GATE_EVALUATION', log);
    this.appLogger.debug(`Gate Evaluation: ${entry.asset}`, {
      regime: entry.result.regime.status,
      flow: entry.result.flow.status,
      risk: entry.result.risk.status,
      context: entry.result.context.status,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRADER ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  logTraderAction(entry: Omit<TraderActionLog, 'type' | 'entryId'>): void {
    const log: TraderActionLog = {
      type: 'TRADER_ACTION',
      entryId: uuidv4(),
      actionType: entry.actionType,
      traderId: entry.traderId,
      asset: entry.asset,
      details: entry.details,
      timestamp: entry.timestamp,
    };

    this.auditLogger.info('TRADER_ACTION', log);
    this.appLogger.info(`Trader Action: ${entry.actionType}`, {
      traderId: entry.traderId,
      asset: entry.asset,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OVERRIDES
  // ═══════════════════════════════════════════════════════════════════════════

  logOverride(entry: Omit<OverrideLog, 'type' | 'entryId'>): void {
    const log: OverrideLog = {
      type: 'OVERRIDE',
      entryId: uuidv4(),
      level: entry.level,
      asset: entry.asset,
      reason: entry.reason,
      traderId: entry.traderId,
      assessmentAtOverride: entry.assessmentAtOverride,
      timestamp: entry.timestamp,
    };

    this.auditLogger.warn('OVERRIDE', log);
    this.appLogger.warn(`Override: Level ${entry.level}`, {
      asset: entry.asset,
      traderId: entry.traderId,
      reason: entry.reason,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXECUTION EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  logExecutionAttempt(entry: {
    orderId: string;
    asset: string;
    action: string;
    size: number;
    timestamp: Date;
  }): void {
    const log: ExecutionLog = {
      type: 'EXECUTION',
      entryId: uuidv4(),
      orderId: entry.orderId,
      asset: entry.asset,
      action: entry.action,
      status: 'ATTEMPT',
      timestamp: entry.timestamp,
    };

    this.auditLogger.info('EXECUTION_ATTEMPT', log);
    this.appLogger.info(`Execution Attempt: ${entry.asset}`, {
      orderId: entry.orderId,
      action: entry.action,
      size: entry.size,
    });
  }

  logExecutionSuccess(entry: {
    orderId: string;
    exchangeOrderId: string;
    fillPrice: number | null;
    fillSize: number | null;
    timestamp: Date;
  }): void {
    const log: ExecutionLog = {
      type: 'EXECUTION',
      entryId: uuidv4(),
      orderId: entry.orderId,
      asset: '',
      action: '',
      status: 'SUCCESS',
      exchangeOrderId: entry.exchangeOrderId,
      fillPrice: entry.fillPrice ?? undefined,
      fillSize: entry.fillSize ?? undefined,
      timestamp: entry.timestamp,
    };

    this.auditLogger.info('EXECUTION_SUCCESS', log);
    this.appLogger.info(`Execution Success: ${entry.orderId}`, {
      exchangeOrderId: entry.exchangeOrderId,
      fillPrice: entry.fillPrice,
    });
  }

  logExecutionFailure(entry: { orderId: string; error: string; timestamp: Date }): void {
    const log: ExecutionLog = {
      type: 'EXECUTION',
      entryId: uuidv4(),
      orderId: entry.orderId,
      asset: '',
      action: '',
      status: 'FAILURE',
      failureReason: entry.error,
      timestamp: entry.timestamp,
    };

    this.auditLogger.error('EXECUTION_FAILURE', log);
    this.appLogger.error(`Execution Failure: ${entry.orderId}`, { error: entry.error });
  }

  logExecutionBlocked(entry: {
    reason: string;
    orderId: string;
    timestamp: Date;
    [key: string]: unknown;
  }): void {
    const log: ExecutionLog = {
      type: 'EXECUTION',
      entryId: uuidv4(),
      orderId: entry.orderId,
      asset: '',
      action: '',
      status: 'BLOCKED',
      blockedBy: entry.reason,
      timestamp: entry.timestamp,
    };

    this.auditLogger.warn('EXECUTION_BLOCKED', log);
    this.appLogger.warn(`Execution Blocked: ${entry.orderId}`, { reason: entry.reason });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-PROTECT EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  logAutoProtectTriggered(entry: {
    asset: string;
    action: string;
    triggerReason: string;
    positionSize: number;
    timestamp: Date;
  }): void {
    const log: AutoProtectLog = {
      type: 'AUTO_PROTECT',
      entryId: uuidv4(),
      status: 'TRIGGERED',
      asset: entry.asset,
      action: entry.action,
      triggerReason: entry.triggerReason,
      timestamp: entry.timestamp,
    };

    this.auditLogger.warn('AUTO_PROTECT_TRIGGERED', log);
    this.appLogger.warn(`Auto-Protect Triggered: ${entry.asset}`, {
      action: entry.action,
      reason: entry.triggerReason,
    });
  }

  logAutoProtectExecuted(entry: {
    asset: string;
    action: string;
    exchangeOrderId: string;
    fillPrice: number | null;
    timestamp: Date;
  }): void {
    const log: AutoProtectLog = {
      type: 'AUTO_PROTECT',
      entryId: uuidv4(),
      status: 'EXECUTED',
      asset: entry.asset,
      action: entry.action,
      exchangeOrderId: entry.exchangeOrderId,
      fillPrice: entry.fillPrice ?? undefined,
      timestamp: entry.timestamp,
    };

    this.auditLogger.info('AUTO_PROTECT_EXECUTED', log);
    this.appLogger.info(`Auto-Protect Executed: ${entry.asset}`, {
      action: entry.action,
      exchangeOrderId: entry.exchangeOrderId,
    });
  }

  logAutoProtectFailed(entry: {
    asset: string;
    action: string;
    error: string;
    timestamp: Date;
  }): void {
    const log: AutoProtectLog = {
      type: 'AUTO_PROTECT',
      entryId: uuidv4(),
      status: 'FAILED',
      asset: entry.asset,
      action: entry.action,
      error: entry.error,
      timestamp: entry.timestamp,
    };

    this.auditLogger.error('AUTO_PROTECT_FAILED', log);
    this.appLogger.error(`Auto-Protect Failed: ${entry.asset}`, { error: entry.error });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  logSecurityEvent(entry: Omit<SecurityEventLog, 'type' | 'entryId'>): void {
    const log: SecurityEventLog = {
      type: 'SECURITY_EVENT',
      entryId: uuidv4(),
      eventType: entry.eventType,
      userId: entry.userId,
      details: entry.details,
      timestamp: entry.timestamp,
    };

    this.auditLogger.warn('SECURITY_EVENT', log);
    this.appLogger.warn(`Security Event: ${entry.eventType}`, entry.details);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 1 VIOLATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  logTier1Violation(entry: Omit<Tier1ViolationLog, 'type' | 'entryId'>): void {
    const log: Tier1ViolationLog = {
      type: 'TIER1_VIOLATION',
      entryId: uuidv4(),
      violationType: entry.violationType,
      reason: entry.reason,
      asset: entry.asset,
      details: entry.details,
      timestamp: entry.timestamp,
    };

    this.auditLogger.error('TIER1_VIOLATION', log);
    this.appLogger.error(`Tier 1 Violation: ${entry.violationType}`, {
      reason: entry.reason,
      asset: entry.asset,
    });
  }

  logDataCollection(entry: {
    asset: string;
    sources: { [key: string]: boolean };
    dataQuality: number;
    duration: number;
  }): void {
    const log = {
      type: 'DATA_COLLECTION',
      entryId: uuidv4(),
      asset: entry.asset,
      sources: entry.sources,
      dataQuality: entry.dataQuality,
      duration: entry.duration,
      timestamp: new Date(),
    };

    // Log vào file audit (nếu cần tracking chi tiết) hoặc chỉ debug
    // Ở đây tôi dùng appLogger debug level để tránh spam audit log quá nhiều
    this.appLogger.debug(`Data Collection: ${entry.asset}`, {
      quality: entry.dataQuality,
      duration: `${entry.duration}ms`,
      sources: JSON.stringify(entry.sources),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR LOGGING
  // ═══════════════════════════════════════════════════════════════════════════

  logError(entry: { type: string; error: string; timestamp: Date; [key: string]: unknown }): void {
    // Avoid duplicate 'error' property: spread entry only
    this.appLogger.error(entry.type, { ...entry });
    this.auditLogger.error('ERROR', {
      entryId: uuidv4(),
      ...entry,
    });
  }
}

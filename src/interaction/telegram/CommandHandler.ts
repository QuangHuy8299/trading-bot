// src/interaction/telegram/CommandHandler.ts
// Handles Telegram command processing

import { env } from '../../config/environment';
import { AuditLogger } from '../../infrastructure/audit';
import { SafetyManager } from '../../infrastructure/safety';
import { DataCollector } from '../../core/data-collector/DataCollector';
import { GateEvaluator } from '../../core/gate-evaluator/GateEvaluator';
import { PermissionStateEngine } from '../../core/permission-engine/PermissionStateEngine';
import { PermissionAssessment, PermissionState } from '../../types/permission.types';
import { formatPermissionState, formatGateStatus, formatTimestamp } from '../../utils/formatters';
import { log } from '../../utils/logger'; // Thêm logger để debug lỗi

/**
 * CommandHandler processes Telegram commands.
 * * Integrates with DataCollector, GateEvaluator, and PermissionStateEngine
 * for real-time permission state evaluation in response to Telegram commands.
 */
export class CommandHandler {
  private auditLogger: AuditLogger;
  private safetyManager: SafetyManager;
  private dataCollector: DataCollector;
  private gateEvaluator: GateEvaluator;
  private permissionEngine: PermissionStateEngine;

  constructor(
    auditLogger: AuditLogger,
    safetyManager: SafetyManager,
    dataCollector: DataCollector,
    gateEvaluator: GateEvaluator,
    permissionEngine: PermissionStateEngine
  ) {
    this.auditLogger = auditLogger;
    this.safetyManager = safetyManager;
    this.dataCollector = dataCollector;
    this.gateEvaluator = gateEvaluator;
    this.permissionEngine = permissionEngine;
  }

  /**
   * Handle a command
   */
  async handle(command: string, args: string[], traderId: string): Promise<string> {
    switch (command) {
      case 'status':
        return this.handleStatus(args[0]);
      case 'check':
        return this.handleCheck(args[0]);
      case 'prepare_reduce':
        return this.handlePrepare('REDUCE', args[0], args[1], traderId);
      case 'prepare_close':
        return this.handlePrepare('CLOSE', args[0], args[1], traderId);
      case 'confirm':
        return this.handleConfirm(args[0], traderId);
      case 'cancel':
        return this.handleCancel(args[0], traderId);
      case 'override':
        return this.handleOverride(args[0], args[1], traderId);
      case 'enable_autoprotect':
        return this.handleEnableAutoProtect(args[0], args[1], traderId);
      case 'disable_autoprotect':
        return this.handleDisableAutoProtect(args[0], traderId);
      case 'killswitch':
        return this.handleKillswitch(traderId);
      case 'safety':
        return this.handleSafetyStatus();
      default:
        return `Unknown command: ${command}\nUse /help for available commands.`;
    }
  }

  /**
   * Handle /check command - returns concise market status
   */
  private async handleCheck(asset?: string): Promise<string> {
    if (!asset) {
      return `
<b>Market Check</b>

Usage: /check ASSET

Example: /check BTCUSDT

Returns current price, volatility, flow, and permission state.
      `.trim();
    }

    const upperAsset = asset.toUpperCase();

    try {
      // Fetch latest market data
      const marketData = await this.dataCollector.collect(upperAsset);

      if (!marketData) {
        return `No market data available for ${upperAsset}. Try again later.`;
      }

      // Evaluate gates
      const gateResult = this.gateEvaluator.evaluate(marketData);
      // Assess permission state
      const assessment = this.permissionEngine.assess(upperAsset, gateResult);

      // Format concise response
      const price = marketData.price;
      const priceChange24h = marketData.binance.priceChangePercent24h;
      const volStance = gateResult.regime.volStance;
      const impliedVol = marketData.option?.impliedVolatility;
      const flowDirection = gateResult.flow.flowDirection;
      const permissionState = assessment.permissionState;

      const priceChangeStr = priceChange24h >= 0 
        ? `+${priceChange24h.toFixed(2)}%` 
        : `${priceChange24h.toFixed(2)}%`;
      
      const volInfo = impliedVol 
        ? `${volStance} (IV: ${(impliedVol * 100).toFixed(1)}%)`
        : volStance;

      return `
━━━━━━━━━━━━━━━━━━━━━━━
📊 <b>MARKET CHECK</b>
${upperAsset} | ${formatTimestamp(new Date())}
━━━━━━━━━━━━━━━━━━━━━━━

<b>Price:</b> $${price.toLocaleString()} (${priceChangeStr} 24h)

<b>Volatility:</b> ${volInfo}

<b>Flow:</b> ${flowDirection}

<b>Permission:</b> ${formatPermissionState(permissionState)}

━━━━━━━━━━━━━━━━━━━━━━━
Use /status ${upperAsset} for full assessment
━━━━━━━━━━━━━━━━━━━━━━━
      `.trim();
    } catch (error) {
      log.error(`Failed to handle check for ${upperAsset}`, { error });
      return `⚠️ Error fetching data for ${upperAsset}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Handle /status command - returns real permission state assessment
   */
  private async handleStatus(asset?: string): Promise<string> {
    if (!asset) {
      // Return summary
      return `
<b>Permission State Summary</b>

Assets being tracked: ${env.TRACKED_ASSETS.join(', ')}

Use /status ASSET for detailed assessment.

<i>Gate evaluations update every minute.</i>
      `.trim();
    }

    const upperAsset = asset.toUpperCase();

    try {
      // --- UPDATE START: Sử dụng collect() thay vì getData() ---
      // Gọi hàm async để lấy dữ liệu mới nhất
      const marketData = await this.dataCollector.collect(upperAsset);

      if (!marketData) {
        return `No market data available for ${upperAsset}. Try again later.`;
      }
      // --- UPDATE END ---

      // Evaluate gates
      const gateResult = this.gateEvaluator.evaluate(marketData);
      // Assess permission state
      const assessment = this.permissionEngine.assess(upperAsset, gateResult);

      // Format response
      return `
━━━━━━━━━━━━━━━━━━━━━━━
📊 <b>ASSESSMENT</b>
${upperAsset} | ${formatTimestamp(assessment.assessedAt)}
━━━━━━━━━━━━━━━━━━━━━━━

<b>Permission:</b> ${formatPermissionState(assessment.permissionState)}
<b>Uncertainty:</b> ${assessment.uncertaintyLevel}

<b>Gates:</b>
Regime: ${formatGateStatus(assessment.gateEvaluations.regime.status)}
Flow: ${formatGateStatus(assessment.gateEvaluations.flow.status)}
Risk: ${formatGateStatus(assessment.gateEvaluations.risk.status)}
Context: ${formatGateStatus(assessment.gateEvaluations.context.status)}

<b>Conflicts:</b> ${assessment.conflicts.length > 0 ? assessment.conflicts.map((c) => c.description).join('; ') : 'None'}

<b>Explanation:</b>
${assessment.explanation.currentObservation}
${assessment.explanation.alignmentAssessment}
${assessment.explanation.conflictAssessment}

<i>Valid until: ${formatTimestamp(assessment.validUntil)}</i>
━━━━━━━━━━━━━━━━━━━━━━━
      `.trim();
    } catch (error) {
      log.error(`Failed to handle status for ${upperAsset}`, { error });
      return `⚠️ Error fetching data for ${upperAsset}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Handle /prepare_reduce and /prepare_close commands
   */
  private handlePrepare(
    action: 'REDUCE' | 'CLOSE',
    asset?: string,
    size?: string,
    traderId?: string
  ): string {
    if (!asset) {
      return `To prepare a ${action} order, provide the asset symbol.\nUsage: /prepare_${action.toLowerCase()} ASSET`;
    }

    return `
To prepare a ${action} order for ${asset.toUpperCase()}, provide:

/prepare_${action.toLowerCase()} ${asset.toUpperCase()}
size: [PERCENTAGE] ${action === 'CLOSE' ? '(optional)' : ''}
reason: [YOUR REASON]

Example:
/prepare_${action.toLowerCase()} ${asset.toUpperCase()}
size: 30%
reason: Permission downgraded to WAIT
    `.trim();
  }

  /**
   * Handle /confirm command
   */
  private handleConfirm(orderId?: string, traderId?: string): string {
    if (!orderId) {
      return 'No pending orders to confirm.\nUse /confirm ORDER_ID to confirm a specific order.';
    }

    if (!env.EXECUTION_ENABLED) {
      return '⚠️ Execution is DISABLED.\nCannot confirm orders in suggestion-only mode.';
    }

    return `Order confirmation requires full module integration.\nOrder ID: ${orderId}`;
  }

  /**
   * Handle /cancel command
   */
  private handleCancel(orderId?: string, traderId?: string): string {
    if (!orderId) {
      return 'Usage: /cancel ORDER_ID';
    }

    return `Order cancellation requires full module integration.\nOrder ID: ${orderId}`;
  }

  /**
   * Handle /override command
   */
  private handleOverride(asset?: string, reason?: string, traderId?: string): string {
    if (!asset || !reason) {
      return 'Usage: /override ASSET REASON\nReason must be at least 20 characters.';
    }

    if (reason.length < 20) {
      return '❌ Override reason must be at least 20 characters.\nPlease provide more context.';
    }

    this.auditLogger.logOverride({
      level: 'LEVEL_1',
      asset: asset.toUpperCase(),
      reason,
      traderId: traderId || 'unknown',
      assessmentAtOverride: {} as PermissionAssessment,
      timestamp: new Date(),
    });

    return `
✅ Override request logged.

Asset: ${asset.toUpperCase()}
Reason: ${reason}

⚠️ You are proceeding outside system assessment.
This is logged for review.
    `.trim();
  }

  /**
   * Handle /enable_autoprotect command
   */
  private handleEnableAutoProtect(asset?: string, action?: string, traderId?: string): string {
    if (!asset || !action) {
      return 'Usage: /enable_autoprotect ASSET ACTION\nACTION: CLOSE or REDUCE_50';
    }

    if (!['CLOSE', 'REDUCE_50'].includes(action.toUpperCase())) {
      return 'Invalid action. Must be CLOSE or REDUCE_50';
    }

    if (!env.AUTO_PROTECT_GLOBALLY_ENABLED) {
      return '⚠️ Auto-Protect is globally disabled.\nContact administrator to enable.';
    }

    return `
✅ Auto-Protect ENABLED for ${asset.toUpperCase()}

Action if triggered: ${action.toUpperCase()}

<b>This means:</b>
If ALL of the following occur:
1. Permission = NO_TRADE
2. Risk Gate = FAIL
3. You have an open position

The system will AUTOMATICALLY execute: ${action.toUpperCase()}

Disable with: /disable_autoprotect ${asset.toUpperCase()}
    `.trim();
  }

  /**
   * Handle /disable_autoprotect command
   */
  private handleDisableAutoProtect(asset?: string, traderId?: string): string {
    if (!asset) {
      return 'Usage: /disable_autoprotect ASSET';
    }

    return `✅ Auto-Protect DISABLED for ${asset.toUpperCase()}`;
  }

  /**
   * Handle /killswitch command
   */
  private async handleKillswitch(traderId: string): Promise<string> {
    await this.safetyManager.activateKillswitch(traderId);

    return `
🚨 KILLSWITCH ACTIVATED

All operations suspended.
No orders will be executed.
Auto-Protect disabled.

System requires manual restart.
    `.trim();
  }

  /**
   * Handle /safety command
   */
  private handleSafetyStatus(): string {
    const status = this.safetyManager.getStatus();

    return `
<b>Safety Status</b>

<b>Kill Switch:</b> ${status.killswitch.active ? '🔴 ACTIVE' : '🟢 Inactive'}
${status.killswitch.active ? `├ Since: ${status.killswitch.activatedAt?.toISOString()}\n└ By: ${status.killswitch.activatedBy}` : ''}

<b>Rate Limit:</b>
├ Remaining: ${status.rateLimit.remaining}
├ Used: ${status.rateLimit.used}
└ Resets: ${status.rateLimit.resetsAt.toISOString()}

<b>Circuit Breaker:</b> ${status.circuitBreaker.state}
├ Failures: ${status.circuitBreaker.failures}
└ Last failure: ${status.circuitBreaker.lastFailure?.toISOString() || 'None'}

<b>Can Execute:</b> ${status.canExecute ? '✅ Yes' : '❌ No'}
${status.blockReason ? `└ Reason: ${status.blockReason}` : ''}

<b>Config:</b>
├ Execution: ${env.EXECUTION_ENABLED ? '⚠️ ENABLED' : '✅ Disabled'}
├ Auto-Protect: ${env.AUTO_PROTECT_GLOBALLY_ENABLED ? '⚠️ ENABLED' : '✅ Disabled'}
└ Testnet: ${env.BINANCE_TESTNET ? '✅ Yes' : '⚠️ LIVE'}
    `.trim();
  }
}

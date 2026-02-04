// src/interaction/telegram/MessageTemplates.ts
// Message templates for Telegram notifications

import { PermissionAssessment, PermissionState } from '../../types/permission.types';
import { PreparedOrder } from '../../types/order.types';
import { GateStatus } from '../../types/gates.types';
import { formatPermissionState, formatGateStatus, formatTimestamp, formatOrderId } from '../../utils/formatters';

/**
 * MessageTemplates provides formatted message templates.
 * 
 * Per Phase 3 §3.3, messages must:
 * - NEVER use directional language
 * - NEVER suggest specific actions
 * - Focus on observations and conditions
 * - Include appropriate disclaimers
 */
export class MessageTemplates {
  /**
   * Permission Update (T1: INFO)
   */
  permissionUpdate(assessment: PermissionAssessment): string {
    const { asset, permissionState, gateEvaluations, uncertaintyLevel } = assessment;
    const { regime, flow, risk, context } = gateEvaluations;

    return `
━━━━━━━━━━━━━━━━━━━━━━━
📋 <b>PERMISSION UPDATE</b>
${asset} | ${formatTimestamp(new Date())}
ID: ${assessment.id.slice(0, 8)}
━━━━━━━━━━━━━━━━━━━━━━━

<b>STATE:</b> ${formatPermissionState(permissionState)}

<b>GATES</b>
├ Regime: ${formatGateStatus(regime.status)} (${regime.confidence})
├ Flow: ${formatGateStatus(flow.status)} (${flow.confidence})
├ Risk: ${formatGateStatus(risk.status)} (${risk.confidence})
└ Context: ${formatGateStatus(context.status)} (${context.confidence})

<b>SUMMARY</b>
${assessment.explanation.currentObservation}

${uncertaintyLevel !== 'LOW' ? `⚠️ Uncertainty: ${uncertaintyLevel}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━
<i>Permission state only. Not a trade signal.</i>
━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }

  /**
   * Risk Warning (T2: WARNING)
   */
  riskWarning(assessment: PermissionAssessment, riskType: string): string {
    return `
━━━━━━━━━━━━━━━━━━━━━━━
⚠️ <b>RISK WARNING</b>
${assessment.asset} | ${formatTimestamp(new Date())}
━━━━━━━━━━━━━━━━━━━━━━━

<b>FACTOR:</b> ${riskType}

<b>OBSERVATION</b>
${assessment.explanation.riskFactors.slice(0, 3).join('\n')}

<b>CONTEXT</b>
${assessment.explanation.cautionPoints.slice(0, 2).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━
Reply /status ${assessment.asset} for full assessment
━━━━━━━━━━━━━━━━━━━━━━━
<i>Risk notification only.</i>
━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }

  /**
   * Permission Change (T3: ALERT)
   */
  permissionChange(
    asset: string,
    previousState: string,
    currentState: string,
    trigger: string
  ): string {
    const prevIcon = this.getStateIcon(previousState as PermissionState);
    const currIcon = this.getStateIcon(currentState as PermissionState);

    return `
━━━━━━━━━━━━━━━━━━━━━━━
🔔 <b>PERMISSION CHANGE</b>
${asset} | ${formatTimestamp(new Date())}
━━━━━━━━━━━━━━━━━━━━━━━

<b>CHANGE</b>
├ From: ${prevIcon} ${previousState}
└ To: ${currIcon} ${currentState}

<b>TRIGGER</b>
${trigger}

━━━━━━━━━━━━━━━━━━━━━━━
<b>[ACK REQUIRED]</b>
Reply /status ${asset} to acknowledge
━━━━━━━━━━━━━━━━━━━━━━━
<i>State change notification. Not a trade signal.</i>
━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }

  /**
   * Order Confirmation Request (T3: ALERT)
   */
  orderConfirmationRequest(order: PreparedOrder): string {
    const expiresIn = Math.max(0, Math.round(
      (order.expiresAt.getTime() - Date.now()) / 60000
    ));

    return `
━━━━━━━━━━━━━━━━━━━━━━━
📝 <b>ORDER PREPARED</b>
${order.asset} | ${formatTimestamp(new Date())}
Order ID: ${formatOrderId(order.id)}
━━━━━━━━━━━━━━━━━━━━━━━

<b>⚠️ NOT YET EXECUTED</b>

<b>ORDER DETAILS</b>
├ Asset: ${order.asset}
├ Action: ${order.action}
├ Size: ${order.sizePercent}%
└ Side: ${order.side}

<b>FRAMEWORK CONTEXT</b>
└ Permission at prep: ${order.permissionStateAtPreparation}

<b>YOUR REASON</b>
"${order.traderReason}"

━━━━━━━━━━━━━━━━━━━━━━━
Expires in ${expiresIn} minutes

/confirm ${formatOrderId(order.id)} — Execute
/cancel ${formatOrderId(order.id)} — Discard
━━━━━━━━━━━━━━━━━━━━━━━
<i>Execution requires your explicit confirmation.</i>
━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }

  /**
   * Auto-Protect Activation (T4: CRITICAL)
   */
  autoProtectActivation(asset: string, reason: string, action: string): string {
    return `
━━━━━━━━━━━━━━━━━━━━━━━
🚨 <b>AUTO-PROTECT ACTIVATED</b>
${asset} | ${formatTimestamp(new Date())}
━━━━━━━━━━━━━━━━━━━━━━━

<b>TRIGGER CONDITIONS MET</b>

Permission: NO_TRADE
Risk Gate: FAIL
├ Reason: ${reason}

<b>AUTOMATIC ACTION EXECUTING</b>

Action: ${action}
Status: EXECUTING NOW

This was predefined when you enabled Auto-Protect.

━━━━━━━━━━━━━━━━━━━━━━━
<i>Emergency protective action. Not a trading decision.</i>
━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }

  /**
   * System Critical (T4: CRITICAL)
   */
  systemCritical(title: string, details: string): string {
    return `
━━━━━━━━━━━━━━━━━━━━━━━
🚨 <b>SYSTEM CRITICAL</b>
${formatTimestamp(new Date())}
━━━━━━━━━━━━━━━━━━━━━━━

<b>STATUS:</b> ${title}

<b>DETAILS</b>
${details}

<b>IMPACT</b>
Manual verification required.

━━━━━━━━━━━━━━━━━━━━━━━
<i>System reliability may be affected.</i>
━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }

  /**
   * Execution Result
   */
  executionResult(
    orderId: string,
    asset: string,
    success: boolean,
    details: {
      fillPrice?: number;
      fillSize?: number;
      error?: string;
    }
  ): string {
    if (success) {
      return `
━━━━━━━━━━━━━━━━━━━━━━━
✅ <b>ORDER EXECUTED</b>
${asset} | ${formatTimestamp(new Date())}
Order: ${formatOrderId(orderId)}
━━━━━━━━━━━━━━━━━━━━━━━

<b>FILL DETAILS</b>
├ Price: ${details.fillPrice?.toLocaleString() ?? 'N/A'}
└ Size: ${details.fillSize ?? 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━
      `.trim();
    } else {
      return `
━━━━━━━━━━━━━━━━━━━━━━━
❌ <b>EXECUTION FAILED</b>
${asset} | ${formatTimestamp(new Date())}
Order: ${formatOrderId(orderId)}
━━━━━━━━━━━━━━━━━━━━━━━

<b>ERROR</b>
${details.error ?? 'Unknown error'}

━━━━━━━━━━━━━━━━━━━━━━━
      `.trim();
    }
  }

  /**
   * Market Status (T1: INFO)
   */
  marketStatus(
    asset: string,
    price: number,
    priceChange24h: number,
    volStance: string,
    impliedVol: number | null,
    flowDirection: string,
    permissionState: string
  ): string {
    const priceChangeStr = priceChange24h >= 0 
      ? `+${priceChange24h.toFixed(2)}%` 
      : `${priceChange24h.toFixed(2)}%`;
    
    const volInfo = impliedVol 
      ? `${volStance} (IV: ${(impliedVol * 100).toFixed(1)}%)`
      : volStance;

    return `
━━━━━━━━━━━━━━━━━━━━━━━
📊 <b>MARKET STATUS</b>
${asset} | ${formatTimestamp(new Date())}
━━━━━━━━━━━━━━━━━━━━━━━

<b>Price:</b> $${price.toLocaleString()} (${priceChangeStr} 24h)

<b>Volatility:</b> ${volInfo}

<b>Flow:</b> ${flowDirection}

<b>Permission:</b> ${formatPermissionState(permissionState as PermissionState)}

━━━━━━━━━━━━━━━━━━━━━━━
<i>Market observation only. Not a trade signal.</i>
━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }

  /**
   * Volatility Alert (T3: ALERT)
   */
  volatilityAlert(
    asset: string,
    triggerType: 'PRICE_CHANGE' | 'VOL_STANCE_CHANGE',
    details: {
      priceChange?: number;
      currentPrice?: number;
      previousVolStance?: string;
      currentVolStance?: string;
    }
  ): string {
    if (triggerType === 'PRICE_CHANGE' && details.priceChange !== undefined && details.currentPrice !== undefined) {
      const changeStr = details.priceChange >= 0 
        ? `+${details.priceChange.toFixed(2)}%` 
        : `${details.priceChange.toFixed(2)}%`;
      const direction = details.priceChange >= 0 ? 'UP' : 'DOWN';
      
      return `
━━━━━━━━━━━━━━━━━━━━━━━
⚡ <b>FLASH MOVE DETECTED</b>
${asset} | ${formatTimestamp(new Date())}
━━━━━━━━━━━━━━━━━━━━━━━

<b>TRIGGER:</b> Significant price movement

<b>CHANGE</b>
├ Direction: ${direction}
├ Magnitude: ${changeStr}
└ Current Price: $${details.currentPrice.toLocaleString()}

<b>TIME WINDOW:</b> 5 minutes

━━━━━━━━━━━━━━━━━━━━━━━
Reply /check ${asset} for current status
━━━━━━━━━━━━━━━━━━━━━━━
<i>Volatility alert. Not a trade signal.</i>
━━━━━━━━━━━━━━━━━━━━━━━
      `.trim();
    }

    if (triggerType === 'VOL_STANCE_CHANGE' && details.previousVolStance && details.currentVolStance) {
      return `
━━━━━━━━━━━━━━━━━━━━━━━
⚡ <b>VOLATILITY STANCE CHANGE</b>
${asset} | ${formatTimestamp(new Date())}
━━━━━━━━━━━━━━━━━━━━━━━

<b>TRIGGER:</b> Regime Gate vol stance transition

<b>CHANGE</b>
├ From: ${details.previousVolStance}
└ To: ${details.currentVolStance}

<b>CONTEXT</b>
This indicates a shift in market volatility expectations.

━━━━━━━━━━━━━━━━━━━━━━━
Reply /check ${asset} for current status
━━━━━━━━━━━━━━━━━━━━━━━
<i>Volatility alert. Not a trade signal.</i>
━━━━━━━━━━━━━━━━━━━━━━━
      `.trim();
    }

    return `
━━━━━━━━━━━━━━━━━━━━━━━
⚡ <b>VOLATILITY ALERT</b>
${asset} | ${formatTimestamp(new Date())}
━━━━━━━━━━━━━━━━━━━━━━━

Volatility conditions have changed.

Reply /check ${asset} for current status
━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }

  /**
   * Scanner Notification (T2: WARNING)
   */
  scannerNotification(
    type: 'NO_ASSETS' | 'WATCHLIST_UPDATED',
    details: {
      assets?: string[];
      reason?: string;
    }
  ): string {
    if (type === 'NO_ASSETS') {
      return `
━━━━━━━━━━━━━━━━━━━━━━━
🔍 <b>SCANNER ALERT</b>
${formatTimestamp(new Date())}
━━━━━━━━━━━━━━━━━━━━━━━

<b>STATUS:</b> No tradeable pairs found

<b>DETAILS</b>
Scanner completed but found no assets meeting criteria:
${details.reason || '• Volume too low\n• Price movement insufficient\n• No qualifying opportunities'}

<b>ACTION</b>
Current watchlist remains unchanged.
Scanner will retry in 15 minutes.

━━━━━━━━━━━━━━━━━━━━━━━
<i>Market conditions may be unfavorable for trading.</i>
━━━━━━━━━━━━━━━━━━━━━━━
      `.trim();
    }

    // WATCHLIST_UPDATED
    return `
━━━━━━━━━━━━━━━━━━━━━━━
✅ <b>WATCHLIST UPDATED</b>
${formatTimestamp(new Date())}
━━━━━━━━━━━━━━━━━━━━━━━

<b>NEW ASSETS:</b>
${details.assets?.map(a => `• ${a}`).join('\n') || 'None'}

<b>STATUS</b>
Scanner identified top opportunities.
Monitoring these assets for trading signals.

━━━━━━━━━━━━━━━━━━━━━━━
<i>Watchlist updated by automatic scanner.</i>
━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }

  /**
   * Get icon for permission state
   */
  private getStateIcon(state: PermissionState): string {
    const icons: Record<PermissionState, string> = {
      [PermissionState.TRADE_ALLOWED]: '🟢',
      [PermissionState.TRADE_ALLOWED_REDUCED_RISK]: '🟡',
      [PermissionState.SCALP_ONLY]: '🟠',
      [PermissionState.WAIT]: '⏸️',
      [PermissionState.NO_TRADE]: '🔴',
    };
    return icons[state] || '❓';
  }
}

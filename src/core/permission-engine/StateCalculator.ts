// src/core/permission-engine/StateCalculator.ts
// State Calculator - Implements Phase 3 permission state logic

import { GateEvaluationResult, GateStatus } from '../../types/gates.types';
import { PermissionState, LayerConflict } from '../../types/permission.types';

/**
 * StateCalculator implements the Permission State Engine logic from Phase 3 §1.2
 * 
 * The calculation follows a strict hierarchy:
 * 1. Check for Hard Failures → NO_TRADE
 * 2. Check for Transitional State → WAIT
 * 3. Check Flow Quality → SCALP_ONLY
 * 4. Check for Risk Factors → REDUCED_RISK or TRADE_ALLOWED
 * 
 * This order is important and must not be changed.
 */
export class StateCalculator {
  /**
   * Calculate permission state from gate evaluations
   * 
   * @param gateResult - All gate evaluations
   * @param conflicts - Detected layer conflicts
   * @returns The calculated permission state
   */
  calculate(
    gateResult: GateEvaluationResult,
    conflicts: LayerConflict[]
  ): PermissionState {
    const { regime, flow, risk, context } = gateResult;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Check for Hard Failures (Tier 1 Constraints)
    // These are non-negotiable conditions that result in NO_TRADE
    // ═══════════════════════════════════════════════════════════════════
    
    // IF Regime = FAIL → NO_TRADE
    // Regime gate failure means no clear market context
    if (regime.status === GateStatus.FAIL) {
      return PermissionState.NO_TRADE;
    }
    
    // IF Risk = FAIL → NO_TRADE
    // Risk gate failure is a TIER 1 CONSTRAINT - blocks ALL trading
    // This includes: extreme crowding, price in stress range
    if (risk.status === GateStatus.FAIL) {
      return PermissionState.NO_TRADE;
    }
    
    // IF (Flow = FAIL AND Context = FAIL) → NO_TRADE
    // Both secondary gates failing indicates severe misalignment
    if (flow.status === GateStatus.FAIL && context.status === GateStatus.FAIL) {
      return PermissionState.NO_TRADE;
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Check for Transitional State
    // Conditions that indicate waiting is appropriate
    // ═══════════════════════════════════════════════════════════════════
    
    // Count WEAK_PASS gates
    const gates = [regime, flow, risk, context];
    const weakPassCount = gates.filter(g => g.status === GateStatus.WEAK_PASS).length;
    
    // IF Multiple WEAK_PASS (≥3 gates) → WAIT
    // Too many uncertain factors to recommend action
    if (weakPassCount >= 3) {
      return PermissionState.WAIT;
    }
    
    // IF high severity conflicts detected → WAIT
    // Significant layer disagreement warrants caution
    const hasHighSeverityConflict = conflicts.some(c => c.severity === 'HIGH');
    if (hasHighSeverityConflict) {
      return PermissionState.WAIT;
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: Check Flow Quality
    // Flow issues restrict to scalp-only territory
    // ═══════════════════════════════════════════════════════════════════
    
    // IF Flow = FAIL OR Flow = WEAK_PASS → SCALP_ONLY
    // Poor flow quality means short-term only (if at all)
    if (flow.status === GateStatus.FAIL) {
      // Flow failed but didn't trigger NO_TRADE (Context didn't also fail)
      return PermissionState.SCALP_ONLY;
    }
    
    if (flow.status === GateStatus.WEAK_PASS) {
      // Flow is uncertain - restrict to scalp
      return PermissionState.SCALP_ONLY;
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: Check for Risk Factors
    // Determine between full permission and reduced risk
    // ═══════════════════════════════════════════════════════════════════
    
    // IF any gate = WEAK_PASS → TRADE_ALLOWED_REDUCED_RISK
    // Some concerns present - recommend reduced sizing
    if (weakPassCount > 0) {
      return PermissionState.TRADE_ALLOWED_REDUCED_RISK;
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 5: Full Permission
    // All gates PASS with no significant concerns
    // ═══════════════════════════════════════════════════════════════════
    
    // IF all gates = PASS → TRADE_ALLOWED
    return PermissionState.TRADE_ALLOWED;
  }

  /**
   * Get the primary reason for current state
   */
  getPrimaryReason(
    gateResult: GateEvaluationResult,
    state: PermissionState
  ): string {
    const { regime, flow, risk, context } = gateResult;

    switch (state) {
      case PermissionState.NO_TRADE:
        if (risk.status === GateStatus.FAIL) {
          return 'Risk Gate FAIL (Tier 1 constraint)';
        }
        if (regime.status === GateStatus.FAIL) {
          return 'Regime Gate FAIL';
        }
        if (flow.status === GateStatus.FAIL && context.status === GateStatus.FAIL) {
          return 'Both Flow and Context Gates FAIL';
        }
        return 'Multiple gate failures';

      case PermissionState.WAIT:
        return 'Multiple gates at WEAK_PASS or high severity conflict';

      case PermissionState.SCALP_ONLY:
        if (flow.status === GateStatus.FAIL) {
          return 'Flow Gate FAIL';
        }
        return 'Flow Gate WEAK_PASS';

      case PermissionState.TRADE_ALLOWED_REDUCED_RISK:
        const weakGates = [regime, flow, risk, context]
          .filter(g => g.status === GateStatus.WEAK_PASS)
          .map(g => g.gateName);
        return `WEAK_PASS on: ${weakGates.join(', ')}`;

      case PermissionState.TRADE_ALLOWED:
        return 'All gates PASS';

      default:
        return 'Unknown state';
    }
  }

  /**
   * Check if a state transition would be an upgrade or downgrade
   */
  compareStates(from: PermissionState, to: PermissionState): 'UPGRADE' | 'DOWNGRADE' | 'SAME' {
    const stateOrder: Record<PermissionState, number> = {
      [PermissionState.TRADE_ALLOWED]: 5,
      [PermissionState.TRADE_ALLOWED_REDUCED_RISK]: 4,
      [PermissionState.SCALP_ONLY]: 3,
      [PermissionState.WAIT]: 2,
      [PermissionState.NO_TRADE]: 1,
    };

    const fromValue = stateOrder[from];
    const toValue = stateOrder[to];

    if (toValue > fromValue) return 'UPGRADE';
    if (toValue < fromValue) return 'DOWNGRADE';
    return 'SAME';
  }
}

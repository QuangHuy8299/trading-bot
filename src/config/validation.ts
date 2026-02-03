// src/config/validation.ts
// Configuration validation utilities

import { env } from './environment';
import { TIER1_CONSTRAINTS, FORBIDDEN_LANGUAGE } from './constants';

/**
 * Validate that a message doesn't contain forbidden language
 * Per Phase 3 §3.3, system messages must not use certain phrases
 */
export function validateMessageContent(message: string): {
  valid: boolean;
  violations: string[];
} {
  const lowerMessage = message.toLowerCase();
  const violations: string[] = [];
  
  for (const forbidden of FORBIDDEN_LANGUAGE) {
    if (lowerMessage.includes(forbidden.toLowerCase())) {
      violations.push(forbidden);
    }
  }
  
  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Check if a condition is non-overridable per Tier 1 constraints
 */
export function isNonOverridableCondition(condition: string): boolean {
  return TIER1_CONSTRAINTS.NON_OVERRIDABLE_CONDITIONS.includes(
    condition as typeof TIER1_CONSTRAINTS.NON_OVERRIDABLE_CONDITIONS[number]
  );
}

/**
 * Check if an action is in the NEVER_AUTOMATE list
 */
export function isNeverAutomate(action: string): boolean {
  return TIER1_CONSTRAINTS.NEVER_AUTOMATE.includes(
    action as typeof TIER1_CONSTRAINTS.NEVER_AUTOMATE[number]
  );
}

/**
 * Validate Telegram user is authorized
 */
export function isAuthorizedUser(userId: string): boolean {
  return env.TELEGRAM_ADMIN_IDS.includes(userId);
}

/**
 * Validate asset symbol format
 */
export function isValidAssetSymbol(symbol: string): boolean {
  // Basic validation: uppercase, ends with USDT/BUSD/BTC
  const pattern = /^[A-Z]{2,10}(USDT|BUSD|BTC)$/;
  return pattern.test(symbol);
}

/**
 * Validate size percentage
 */
export function isValidSizePercent(percent: number): boolean {
  return percent > 0 && percent <= 100;
}

/**
 * Validate order preparation request
 */
export function validateOrderPreparation(request: {
  asset: string;
  action: 'REDUCE' | 'CLOSE';
  sizePercent?: number;
}): { valid: boolean; reason?: string } {
  // Check asset format
  if (!isValidAssetSymbol(request.asset)) {
    return { valid: false, reason: 'Invalid asset symbol format' };
  }
  
  // Check action
  if (!['REDUCE', 'CLOSE'].includes(request.action)) {
    return { valid: false, reason: 'Action must be REDUCE or CLOSE' };
  }
  
  // Check size for REDUCE action
  if (request.action === 'REDUCE') {
    if (!request.sizePercent) {
      return { valid: false, reason: 'Size percentage required for REDUCE action' };
    }
    if (!isValidSizePercent(request.sizePercent)) {
      return { valid: false, reason: 'Size percentage must be between 1 and 100' };
    }
  }
  
  return { valid: true };
}

/**
 * Runtime check that execution is properly disabled
 * Called during critical paths as an extra safety measure
 */
export function assertExecutionSafe(): void {
  if (!env.EXECUTION_ENABLED) {
    return; // Safe - execution is disabled
  }
  
  // If execution is enabled, verify we're not in an unexpected state
  if (env.NODE_ENV === 'production' && !env.BINANCE_TESTNET) {
    console.warn('⚠️ CRITICAL: Execution enabled on production with live Binance');
  }
}

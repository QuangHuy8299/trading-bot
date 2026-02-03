// src/config/constants.ts
// System constants and immutable configuration

/**
 * Permission states as defined in Phase 3
 */
export const PERMISSION_STATES = {
  TRADE_ALLOWED: 'TRADE_ALLOWED',
  TRADE_ALLOWED_REDUCED_RISK: 'TRADE_ALLOWED_REDUCED_RISK',
  SCALP_ONLY: 'SCALP_ONLY',
  WAIT: 'WAIT',
  NO_TRADE: 'NO_TRADE',
} as const;

/**
 * Gate names as defined in Phase 2
 */
export const GATE_NAMES = {
  REGIME: 'REGIME',
  FLOW: 'FLOW',
  RISK: 'RISK',
  CONTEXT: 'CONTEXT',
} as const;

/**
 * Gate statuses
 */
export const GATE_STATUS = {
  PASS: 'PASS',
  WEAK_PASS: 'WEAK_PASS',
  FAIL: 'FAIL',
} as const;

/**
 * Tier 1 Constraints - IMMUTABLE per Phase 2
 * These constraints cannot be overridden by any party
 */
export const TIER1_CONSTRAINTS = {
  // Risk Gate FAIL conditions that block ALL trading
  RISK_GATE_FAIL_BLOCKS_TRADING: true,
  
  // Conditions that CANNOT be overridden
  NON_OVERRIDABLE_CONDITIONS: [
    'RISK_GATE_FAIL_EXTREME_CROWDING',
    'RISK_GATE_FAIL_STRESS_RANGE',
    'CRITICAL_DATA_QUALITY_FAILURE',
    'ALTCOIN_BTC_NO_TRADE',
  ] as const,
  
  // Actions that are NEVER automated per Phase 2 §2
  NEVER_AUTOMATE: [
    'ENTRY_SIGNAL_GENERATION',
    'EXIT_SIGNAL_GENERATION',
    'POSITION_SIZING',
    'DIRECTION_DECISION',
    'NEW_POSITION_OPENING',
    'REGIME_CLASSIFICATION',
    'CONFLICTING_SIGNAL_RESOLUTION',
  ] as const,
} as const;

/**
 * Timing defaults (can be overridden via environment)
 */
export const TIMING = {
  // How often gates are evaluated (1 minute)
  GATE_EVALUATION_INTERVAL_MS: 60000,
  
  // How long a permission assessment is considered valid (5 minutes)
  PERMISSION_VALIDITY_MS: 300000,
  
  // Order confirmation timeout (5 minutes)
  ORDER_EXPIRATION_MS: 300000,
  
  // Data staleness threshold (2 minutes)
  DATA_STALENESS_THRESHOLD_MS: 120000,
  
  // Auto-protect check interval (10 seconds)
  AUTO_PROTECT_CHECK_INTERVAL_MS: 10000,
  
  // Override cooling-off periods
  OVERRIDE_LEVEL2_COOLOFF_MS: 4 * 60 * 60 * 1000, // 4 hours
  OVERRIDE_LEVEL3_COOLOFF_MS: 24 * 60 * 60 * 1000, // 24 hours
} as const;

/**
 * Message tiers for Telegram notifications
 */
export const MESSAGE_TIERS = {
  T1_INFO: 'T1_INFO',
  T2_WARNING: 'T2_WARNING',
  T3_ALERT: 'T3_ALERT',
  T4_CRITICAL: 'T4_CRITICAL',
} as const;

/**
 * Override levels per Phase 3.5
 */
export const OVERRIDE_LEVELS = {
  LEVEL_1: 'LEVEL_1', // Contextual override
  LEVEL_2: 'LEVEL_2', // Contrary override
  LEVEL_3: 'LEVEL_3', // Emergency override
} as const;

/**
 * Override limits per Phase 3.5
 */
export const OVERRIDE_LIMITS = {
  LEVEL_2_MAX_PER_DAY: 3,
  LEVEL_2_COOLOFF_HOURS: 4,
} as const;

/**
 * Position states
 */
export const POSITION_STATES = {
  NO_POSITION: 'NO_POSITION',
  OPEN: 'OPEN',
  DEGRADED: 'DEGRADED',
  VIOLATION: 'VIOLATION',
  CLOSED: 'CLOSED',
} as const;

/**
 * Order statuses
 */
export const ORDER_STATUSES = {
  PREPARED: 'PREPARED',
  AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
  EXECUTING: 'EXECUTING',
  FILLED: 'FILLED',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  SUPERSEDED: 'SUPERSEDED',
} as const;

/**
 * Safety limits
 */
export const SAFETY_LIMITS = {
  // API rate limits
  BINANCE_WEIGHT_LIMIT_PER_MINUTE: 1200,
  TELEGRAM_MESSAGES_PER_SECOND: 1,
  
  // Circuit breaker
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: 3,
  CIRCUIT_BREAKER_RESET_TIMEOUT_MS: 60000,
} as const;

/**
 * Forbidden language patterns (per Phase 3 §3.3)
 * System messages must never contain these
 */
export const FORBIDDEN_LANGUAGE = [
  // Directional
  'bullish', 'bearish', 'will go up', 'will go down',
  // Recommendations
  'you should buy', 'you should sell', 'consider entering', 'consider exiting',
  // Certainty
  'will happen', 'guaranteed', 'certain',
  // Urgency
  'act now', "don't miss", 'last chance',
  // Signal language
  'buy signal', 'sell signal', 'entry point', 'exit point',
] as const;

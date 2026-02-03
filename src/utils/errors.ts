// src/utils/errors.ts
// Custom error classes for the system

/**
 * Base error class for the trading system
 */
export class TradingSystemError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'TradingSystemError';
    this.code = code;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when Tier 1 constraints are violated
 */
export class Tier1ConstraintError extends TradingSystemError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'TIER1_CONSTRAINT_VIOLATION', context);
    this.name = 'Tier1ConstraintError';
  }
}

/**
 * Error thrown when data validation fails
 */
export class ValidationError extends TradingSystemError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when execution is blocked
 */
export class ExecutionBlockedError extends TradingSystemError {
  public readonly blockedBy: string;

  constructor(message: string, blockedBy: string, context?: Record<string, unknown>) {
    super(message, 'EXECUTION_BLOCKED', context);
    this.name = 'ExecutionBlockedError';
    this.blockedBy = blockedBy;
  }
}

/**
 * Error thrown when an order is not found
 */
export class OrderNotFoundError extends TradingSystemError {
  constructor(orderId: string) {
    super(`Order not found: ${orderId}`, 'ORDER_NOT_FOUND', { orderId });
    this.name = 'OrderNotFoundError';
  }
}

/**
 * Error thrown when a position is not found
 */
export class PositionNotFoundError extends TradingSystemError {
  constructor(asset: string) {
    super(`Position not found for asset: ${asset}`, 'POSITION_NOT_FOUND', { asset });
    this.name = 'PositionNotFoundError';
  }
}

/**
 * Error thrown when data is stale or unavailable
 */
export class DataQualityError extends TradingSystemError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DATA_QUALITY_ERROR', context);
    this.name = 'DataQualityError';
  }
}

/**
 * Error thrown when API calls fail
 */
export class ApiError extends TradingSystemError {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number, context?: Record<string, unknown>) {
    super(message, 'API_ERROR', context);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/**
 * Error thrown when rate limits are exceeded
 */
export class RateLimitError extends TradingSystemError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', { retryAfter });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Error thrown when authorization fails
 */
export class AuthorizationError extends TradingSystemError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUTHORIZATION_ERROR', context);
    this.name = 'AuthorizationError';
  }
}

/**
 * Error thrown when the kill switch is active
 */
export class KillSwitchActiveError extends TradingSystemError {
  constructor() {
    super('Kill switch is active. All operations suspended.', 'KILL_SWITCH_ACTIVE');
    this.name = 'KillSwitchActiveError';
  }
}

/**
 * Error thrown when an override is not permitted
 */
export class OverrideNotPermittedError extends TradingSystemError {
  constructor(reason: string, context?: Record<string, unknown>) {
    super(`Override not permitted: ${reason}`, 'OVERRIDE_NOT_PERMITTED', context);
    this.name = 'OverrideNotPermittedError';
  }
}

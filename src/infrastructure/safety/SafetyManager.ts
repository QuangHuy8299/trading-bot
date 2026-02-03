// src/infrastructure/safety/SafetyManager.ts
// Central safety management orchestrator

import { KillSwitch } from './KillSwitch';
import { RateLimiter } from './RateLimiter';
import { CircuitBreaker } from './CircuitBreaker';
import { AuditLogger } from '../audit/AuditLogger';
import { env } from '../../config/environment';
import { SAFETY_LIMITS } from '../../config/constants';

/**
 * SafetyManager orchestrates all safety mechanisms.
 * 
 * Provides a single interface for:
 * - Kill switch control
 * - Rate limiting
 * - Circuit breaking
 * - Execution gating
 */
export class SafetyManager {
  private killSwitch: KillSwitch;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private auditLogger: AuditLogger;

  constructor(auditLogger: AuditLogger) {
    this.killSwitch = new KillSwitch();
    this.rateLimiter = new RateLimiter({
      maxRequests: env.MAX_DAILY_ORDERS,
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
    });
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: SAFETY_LIMITS.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      resetTimeout: SAFETY_LIMITS.CIRCUIT_BREAKER_RESET_TIMEOUT_MS,
    });
    this.auditLogger = auditLogger;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KILL SWITCH
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if kill switch is active
   */
  isKillswitchActive(): boolean {
    return this.killSwitch.isActive();
  }

  /**
   * Activate the kill switch - stops all operations
   */
  async activateKillswitch(activatedBy: string): Promise<void> {
    this.killSwitch.activate(activatedBy);
    
    this.auditLogger.logSecurityEvent({
      eventType: 'KILLSWITCH_ACTIVATED',
      userId: activatedBy,
      details: {
        activatedAt: new Date().toISOString(),
        reason: 'Manual activation',
      },
      timestamp: new Date(),
    });
  }

  /**
   * Deactivate the kill switch - allows operations to resume
   */
  deactivateKillswitch(deactivatedBy: string): void {
    this.killSwitch.deactivate(deactivatedBy);
    
    this.auditLogger.logSecurityEvent({
      eventType: 'KILLSWITCH_DEACTIVATED',
      userId: deactivatedBy,
      details: {
        deactivatedAt: new Date().toISOString(),
      },
      timestamp: new Date(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXECUTION CONTROL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if execution is allowed
   * This is the main gate for all execution attempts
   */
  canExecute(): boolean {
    // Kill switch blocks everything
    if (this.killSwitch.isActive()) {
      return false;
    }

    // Rate limit check
    if (!this.rateLimiter.canProceed()) {
      return false;
    }

    // Circuit breaker check
    if (this.circuitBreaker.isOpen()) {
      return false;
    }

    return true;
  }

  /**
   * Get reason why execution is blocked (if it is)
   */
  getExecutionBlockReason(): string | null {
    if (this.killSwitch.isActive()) {
      return 'Kill switch is active';
    }

    if (!this.rateLimiter.canProceed()) {
      return `Rate limit exceeded (${this.rateLimiter.getStatus().remaining} remaining)`;
    }

    if (this.circuitBreaker.isOpen()) {
      return `Circuit breaker is open (${this.circuitBreaker.getStatus().failures} failures)`;
    }

    return null;
  }

  /**
   * Record an execution attempt (for rate limiting and circuit breaker)
   */
  recordExecution(success: boolean): void {
    // Always record for rate limiting
    this.rateLimiter.record();
    
    // Record for circuit breaker
    if (success) {
      this.circuitBreaker.recordSuccess();
    } else {
      this.circuitBreaker.recordFailure();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RATE LIMITING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get rate limiter for external API calls
   */
  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  /**
   * Acquire rate limit slot for Binance API
   */
  async acquireBinanceSlot(type: 'read' | 'trade'): Promise<void> {
    // For now, use the same limiter
    // In production, you might have separate limiters for read vs trade
    if (!this.rateLimiter.canProceed()) {
      throw new Error('Rate limit exceeded');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get comprehensive safety status
   */
  getStatus(): {
    killswitch: {
      active: boolean;
      activatedAt: Date | null;
      activatedBy: string | null;
    };
    rateLimit: {
      remaining: number;
      used: number;
      resetsAt: Date;
    };
    circuitBreaker: {
      state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
      failures: number;
      lastFailure: Date | null;
    };
    canExecute: boolean;
    blockReason: string | null;
  } {
    return {
      killswitch: this.killSwitch.getStatus(),
      rateLimit: this.rateLimiter.getStatus(),
      circuitBreaker: this.circuitBreaker.getStatus(),
      canExecute: this.canExecute(),
      blockReason: this.getExecutionBlockReason(),
    };
  }

  /**
   * Reset all safety mechanisms (use with caution)
   */
  reset(resetBy: string): void {
    this.rateLimiter.reset();
    this.circuitBreaker.reset();
    // Note: Kill switch must be explicitly deactivated
    
    this.auditLogger.logSecurityEvent({
      eventType: 'SAFETY_RESET',
      userId: resetBy,
      details: {
        resetAt: new Date().toISOString(),
        components: ['rateLimiter', 'circuitBreaker'],
      },
      timestamp: new Date(),
    });
  }
}

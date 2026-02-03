// src/infrastructure/safety/RateLimiter.ts
// Rate limiting implementation

interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * RateLimiter prevents excessive API calls and order submissions.
 * 
 * Uses a sliding window approach to track requests.
 */
export class RateLimiter {
  private config: RateLimiterConfig;
  private requests: Date[] = [];

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  /**
   * Check if a new request is allowed
   */
  canProceed(): boolean {
    this.cleanup();
    return this.requests.length < this.config.maxRequests;
  }

  /**
   * Record a request
   */
  record(): void {
    this.cleanup();
    this.requests.push(new Date());
  }

  /**
   * Try to acquire a slot - records if successful
   */
  async acquire(key?: string): Promise<boolean> {
    if (this.canProceed()) {
      this.record();
      return true;
    }
    return false;
  }

  /**
   * Get current status
   */
  getStatus(): {
    remaining: number;
    used: number;
    resetsAt: Date;
  } {
    this.cleanup();
    
    const used = this.requests.length;
    const remaining = Math.max(0, this.config.maxRequests - used);
    
    // Calculate when the oldest request will expire
    const resetsAt = this.requests.length > 0
      ? new Date(this.requests[0].getTime() + this.config.windowMs)
      : new Date(Date.now() + this.config.windowMs);

    return {
      remaining,
      used,
      resetsAt,
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
  }

  /**
   * Clean up old requests outside the window
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.config.windowMs;
    this.requests = this.requests.filter(r => r.getTime() > cutoff);
  }

  /**
   * Get time until next slot is available
   */
  getTimeUntilAvailable(): number {
    this.cleanup();
    
    if (this.canProceed()) {
      return 0;
    }
    
    if (this.requests.length === 0) {
      return 0;
    }
    
    // Time until oldest request expires
    return Math.max(0, this.requests[0].getTime() + this.config.windowMs - Date.now());
  }
}

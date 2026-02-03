// src/infrastructure/safety/CircuitBreaker.ts
// Circuit breaker pattern implementation

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * CircuitBreaker prevents cascading failures.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is broken, requests are blocked
 * - HALF_OPEN: Testing if service has recovered
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private lastFailure: Date | null = null;
  private lastStateChange: Date = new Date();

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Check if circuit is open (blocking requests)
   */
  isOpen(): boolean {
    this.checkStateTransition();
    return this.state === 'OPEN';
  }

  /**
   * Check if circuit allows requests
   */
  isClosed(): boolean {
    this.checkStateTransition();
    return this.state === 'CLOSED';
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      // Recovery confirmed, close the circuit
      this.state = 'CLOSED';
      this.failures = 0;
      this.lastStateChange = new Date();
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.failures++;
    this.lastFailure = new Date();

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.lastStateChange = new Date();
    }
  }

  /**
   * Get current status
   */
  getStatus(): {
    state: CircuitState;
    failures: number;
    lastFailure: Date | null;
  } {
    this.checkStateTransition();
    
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure,
    };
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailure = null;
    this.lastStateChange = new Date();
  }

  /**
   * Force the circuit open
   */
  forceOpen(): void {
    this.state = 'OPEN';
    this.lastStateChange = new Date();
  }

  /**
   * Check if state should transition
   */
  private checkStateTransition(): void {
    if (this.state === 'OPEN') {
      // Check if reset timeout has passed
      const timeSinceOpen = Date.now() - this.lastStateChange.getTime();
      
      if (timeSinceOpen >= this.config.resetTimeout) {
        // Move to half-open to test
        this.state = 'HALF_OPEN';
        this.lastStateChange = new Date();
      }
    }
  }

  /**
   * Get time until circuit may reset
   */
  getTimeUntilReset(): number | null {
    if (this.state !== 'OPEN') {
      return null;
    }
    
    const timeSinceOpen = Date.now() - this.lastStateChange.getTime();
    return Math.max(0, this.config.resetTimeout - timeSinceOpen);
  }
}

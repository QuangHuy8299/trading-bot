// src/infrastructure/safety/KillSwitch.ts
// Emergency kill switch implementation

/**
 * KillSwitch provides emergency stop functionality.
 * 
 * When activated:
 * - All trading operations are suspended
 * - No orders can be executed
 * - Auto-Protect is disabled
 * - System requires manual restart
 */
export class KillSwitch {
  private active: boolean = false;
  private activatedAt: Date | null = null;
  private activatedBy: string | null = null;

  /**
   * Activate the kill switch
   */
  activate(by: string): void {
    this.active = true;
    this.activatedAt = new Date();
    this.activatedBy = by;
    
    console.error('🚨 KILL SWITCH ACTIVATED 🚨');
    console.error(`Activated by: ${by}`);
    console.error(`Time: ${this.activatedAt.toISOString()}`);
  }

  /**
   * Deactivate the kill switch
   */
  deactivate(by: string): void {
    console.log(`Kill switch deactivated by: ${by}`);
    console.log(`Was active since: ${this.activatedAt?.toISOString()}`);
    
    this.active = false;
    this.activatedAt = null;
    this.activatedBy = null;
  }

  /**
   * Check if kill switch is active
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Get kill switch status
   */
  getStatus(): {
    active: boolean;
    activatedAt: Date | null;
    activatedBy: string | null;
  } {
    return {
      active: this.active,
      activatedAt: this.activatedAt,
      activatedBy: this.activatedBy,
    };
  }

  /**
   * Get duration since activation (if active)
   */
  getActiveDuration(): number | null {
    if (!this.active || !this.activatedAt) {
      return null;
    }
    return Date.now() - this.activatedAt.getTime();
  }
}

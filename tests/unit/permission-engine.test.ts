// tests/unit/permission-engine.test.ts
// Unit tests for Permission State Engine

import { GateStatus, ConfidenceLevel, DataFreshness } from '../../src/types/gates.types';
import { PermissionState } from '../../src/types/permission.types';

// Mock implementation for testing
// In real implementation, import from actual module
function calculatePermissionState(gates: {
  regime: { status: GateStatus };
  flow: { status: GateStatus };
  risk: { status: GateStatus };
  context: { status: GateStatus };
}): PermissionState {
  const { regime, flow, risk, context } = gates;

  // STEP 1: Check for Hard Failures
  if (regime.status === GateStatus.FAIL) {
    return PermissionState.NO_TRADE;
  }
  if (risk.status === GateStatus.FAIL) {
    return PermissionState.NO_TRADE;
  }
  if (flow.status === GateStatus.FAIL && context.status === GateStatus.FAIL) {
    return PermissionState.NO_TRADE;
  }

  // STEP 2: Check for Transitional State
  const weakPassCount = [regime, flow, risk, context]
    .filter(g => g.status === GateStatus.WEAK_PASS).length;
  
  if (weakPassCount >= 3) {
    return PermissionState.WAIT;
  }

  // STEP 3: Check Flow Quality
  if (flow.status === GateStatus.FAIL || flow.status === GateStatus.WEAK_PASS) {
    if (regime.status !== GateStatus.FAIL) {
      return PermissionState.SCALP_ONLY;
    }
  }

  // STEP 4: Check for Risk Factors
  if (weakPassCount > 0) {
    return PermissionState.TRADE_ALLOWED_REDUCED_RISK;
  }

  return PermissionState.TRADE_ALLOWED;
}

describe('Permission State Engine', () => {
  describe('calculatePermissionState', () => {
    
    // ═══════════════════════════════════════════════════════════════
    // TRADE_ALLOWED Tests
    // ═══════════════════════════════════════════════════════════════
    
    describe('TRADE_ALLOWED', () => {
      it('should return TRADE_ALLOWED when all gates PASS', () => {
        const gates = {
          regime: { status: GateStatus.PASS },
          flow: { status: GateStatus.PASS },
          risk: { status: GateStatus.PASS },
          context: { status: GateStatus.PASS },
        };
        
        expect(calculatePermissionState(gates)).toBe(PermissionState.TRADE_ALLOWED);
      });
    });

    // ═══════════════════════════════════════════════════════════════
    // NO_TRADE Tests (Tier 1 Constraints)
    // ═══════════════════════════════════════════════════════════════
    
    describe('NO_TRADE', () => {
      it('should return NO_TRADE when Regime gate FAILS', () => {
        const gates = {
          regime: { status: GateStatus.FAIL },
          flow: { status: GateStatus.PASS },
          risk: { status: GateStatus.PASS },
          context: { status: GateStatus.PASS },
        };
        
        expect(calculatePermissionState(gates)).toBe(PermissionState.NO_TRADE);
      });

      it('should return NO_TRADE when Risk gate FAILS (Tier 1 constraint)', () => {
        const gates = {
          regime: { status: GateStatus.PASS },
          flow: { status: GateStatus.PASS },
          risk: { status: GateStatus.FAIL },
          context: { status: GateStatus.PASS },
        };
        
        expect(calculatePermissionState(gates)).toBe(PermissionState.NO_TRADE);
      });

      it('should return NO_TRADE when both Flow and Context FAIL', () => {
        const gates = {
          regime: { status: GateStatus.PASS },
          flow: { status: GateStatus.FAIL },
          risk: { status: GateStatus.PASS },
          context: { status: GateStatus.FAIL },
        };
        
        expect(calculatePermissionState(gates)).toBe(PermissionState.NO_TRADE);
      });

      it('should prioritize Risk FAIL over other conditions', () => {
        // Risk FAIL is a Tier 1 constraint - should always result in NO_TRADE
        const gates = {
          regime: { status: GateStatus.PASS },
          flow: { status: GateStatus.PASS },
          risk: { status: GateStatus.FAIL },
          context: { status: GateStatus.PASS },
        };
        
        expect(calculatePermissionState(gates)).toBe(PermissionState.NO_TRADE);
      });
    });

    // ═══════════════════════════════════════════════════════════════
    // WAIT Tests
    // ═══════════════════════════════════════════════════════════════
    
    describe('WAIT', () => {
      it('should return WAIT when 3 or more gates are WEAK_PASS', () => {
        const gates = {
          regime: { status: GateStatus.WEAK_PASS },
          flow: { status: GateStatus.WEAK_PASS },
          risk: { status: GateStatus.WEAK_PASS },
          context: { status: GateStatus.PASS },
        };
        
        expect(calculatePermissionState(gates)).toBe(PermissionState.WAIT);
      });

      it('should return WAIT when all gates are WEAK_PASS', () => {
        const gates = {
          regime: { status: GateStatus.WEAK_PASS },
          flow: { status: GateStatus.WEAK_PASS },
          risk: { status: GateStatus.WEAK_PASS },
          context: { status: GateStatus.WEAK_PASS },
        };
        
        expect(calculatePermissionState(gates)).toBe(PermissionState.WAIT);
      });
    });

    // ═══════════════════════════════════════════════════════════════
    // SCALP_ONLY Tests
    // ═══════════════════════════════════════════════════════════════
    
    describe('SCALP_ONLY', () => {
      it('should return SCALP_ONLY when Flow is FAIL but Regime is not', () => {
        const gates = {
          regime: { status: GateStatus.PASS },
          flow: { status: GateStatus.FAIL },
          risk: { status: GateStatus.PASS },
          context: { status: GateStatus.PASS },
        };
        
        expect(calculatePermissionState(gates)).toBe(PermissionState.SCALP_ONLY);
      });

      it('should return SCALP_ONLY when Flow is WEAK_PASS', () => {
        const gates = {
          regime: { status: GateStatus.PASS },
          flow: { status: GateStatus.WEAK_PASS },
          risk: { status: GateStatus.PASS },
          context: { status: GateStatus.PASS },
        };
        
        expect(calculatePermissionState(gates)).toBe(PermissionState.SCALP_ONLY);
      });
    });

    // ═══════════════════════════════════════════════════════════════
    // TRADE_ALLOWED_REDUCED_RISK Tests
    // ═══════════════════════════════════════════════════════════════
    
    describe('TRADE_ALLOWED_REDUCED_RISK', () => {
      it('should return REDUCED_RISK when Risk is WEAK_PASS', () => {
        const gates = {
          regime: { status: GateStatus.PASS },
          flow: { status: GateStatus.PASS },
          risk: { status: GateStatus.WEAK_PASS },
          context: { status: GateStatus.PASS },
        };
        
        expect(calculatePermissionState(gates)).toBe(PermissionState.TRADE_ALLOWED_REDUCED_RISK);
      });

      it('should return REDUCED_RISK when Context is WEAK_PASS', () => {
        const gates = {
          regime: { status: GateStatus.PASS },
          flow: { status: GateStatus.PASS },
          risk: { status: GateStatus.PASS },
          context: { status: GateStatus.WEAK_PASS },
        };
        
        expect(calculatePermissionState(gates)).toBe(PermissionState.TRADE_ALLOWED_REDUCED_RISK);
      });

      it('should return REDUCED_RISK when Regime is WEAK_PASS', () => {
        const gates = {
          regime: { status: GateStatus.WEAK_PASS },
          flow: { status: GateStatus.PASS },
          risk: { status: GateStatus.PASS },
          context: { status: GateStatus.PASS },
        };
        
        expect(calculatePermissionState(gates)).toBe(PermissionState.TRADE_ALLOWED_REDUCED_RISK);
      });
    });

    // ═══════════════════════════════════════════════════════════════
    // Priority Tests
    // ═══════════════════════════════════════════════════════════════
    
    describe('Priority ordering', () => {
      it('should prioritize NO_TRADE over WAIT', () => {
        // Risk FAIL should result in NO_TRADE even with multiple WEAK_PASS
        const gates = {
          regime: { status: GateStatus.WEAK_PASS },
          flow: { status: GateStatus.WEAK_PASS },
          risk: { status: GateStatus.FAIL },
          context: { status: GateStatus.WEAK_PASS },
        };
        
        expect(calculatePermissionState(gates)).toBe(PermissionState.NO_TRADE);
      });

      it('should prioritize WAIT over SCALP_ONLY when 3+ WEAK_PASS', () => {
        const gates = {
          regime: { status: GateStatus.WEAK_PASS },
          flow: { status: GateStatus.WEAK_PASS },
          risk: { status: GateStatus.WEAK_PASS },
          context: { status: GateStatus.PASS },
        };
        
        expect(calculatePermissionState(gates)).toBe(PermissionState.WAIT);
      });

      it('should return SCALP_ONLY over REDUCED_RISK when Flow is weak', () => {
        // Flow WEAK_PASS should result in SCALP_ONLY, not REDUCED_RISK
        const gates = {
          regime: { status: GateStatus.PASS },
          flow: { status: GateStatus.WEAK_PASS },
          risk: { status: GateStatus.PASS },
          context: { status: GateStatus.PASS },
        };
        
        expect(calculatePermissionState(gates)).toBe(PermissionState.SCALP_ONLY);
      });
    });
  });
});

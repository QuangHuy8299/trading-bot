// src/core/gate-evaluator/GateEvaluator.ts
// Main gate evaluator orchestrator

import { MarketData } from '../data-collector/types';
import { RegimeGate } from './RegimeGate';
import { FlowGate } from './FlowGate';
import { RiskGate } from './RiskGate';
import { ContextGate } from './ContextGate';
import {
  GateEvaluationResult,
  RegimeGateEvaluation,
  FlowGateEvaluation,
  RiskGateEvaluation,
  ContextGateEvaluation,
} from '../../types/gates.types';
import { AuditLogger } from '../../infrastructure/audit';
import { log } from '../../utils/logger';

/**
 * GateEvaluator orchestrates the four-gate evaluation system
 * 
 * Per Phase 2, the gates form a hierarchy:
 * 1. Regime (Gatekeeper) - Establishes macro context
 * 2. Flow - Determines what capital is doing
 * 3. Risk - Assesses positioning and eligibility
 * 4. Context - Provides spatial execution context
 */
export class GateEvaluator {
  private regimeGate: RegimeGate;
  private flowGate: FlowGate;
  private riskGate: RiskGate;
  private contextGate: ContextGate;
  private auditLogger: AuditLogger;

  constructor(auditLogger: AuditLogger) {
    this.regimeGate = new RegimeGate();
    this.flowGate = new FlowGate();
    this.riskGate = new RiskGate();
    this.contextGate = new ContextGate();
    this.auditLogger = auditLogger;
  }

  /**
   * Evaluate all four gates for given market data
   */
  evaluate(data: MarketData): GateEvaluationResult {
    const startTime = Date.now();
    const evaluatedAt = new Date();

    log.debug(`Evaluating gates for ${data.asset}`);

    // Evaluate each gate
    // Note: Gates are evaluated in order, with later gates potentially
    // using results from earlier gates for context
    
    const regime = this.regimeGate.evaluate(data);
    const flow = this.flowGate.evaluate(data);
    const risk = this.riskGate.evaluate(data);
    const context = this.contextGate.evaluate(data, { regime, flow, risk });

    const result: GateEvaluationResult = {
      regime,
      flow,
      risk,
      context,
      evaluatedAt,
    };

    // Log evaluation
    const duration = Date.now() - startTime;
    log.debug(`Gate evaluation complete for ${data.asset}`, {
      duration,
      regime: regime.status,
      flow: flow.status,
      risk: risk.status,
      context: context.status,
    });

    // Audit log
    this.auditLogger.logGateEvaluation({
      asset: data.asset,
      result,
      dataQuality: {
        overall: data.dataQuality.overall,
        binance: { fresh: data.dataQuality.binance.fresh },
        option: { 
          fresh: data.dataQuality.option.fresh, 
          available: data.dataQuality.option.available 
        },
        whale: { 
          fresh: data.dataQuality.whale.fresh, 
          available: data.dataQuality.whale.available 
        },
      },
      timestamp: evaluatedAt,
    });

    return result;
  }

  /**
   * Evaluate a single gate (for testing/debugging)
   */
  evaluateSingleGate(
    gateName: 'REGIME' | 'FLOW' | 'RISK' | 'CONTEXT',
    data: MarketData,
    priorResults?: Partial<GateEvaluationResult>
  ): RegimeGateEvaluation | FlowGateEvaluation | RiskGateEvaluation | ContextGateEvaluation {
    switch (gateName) {
      case 'REGIME':
        return this.regimeGate.evaluate(data);
      case 'FLOW':
        return this.flowGate.evaluate(data);
      case 'RISK':
        return this.riskGate.evaluate(data);
      case 'CONTEXT':
        return this.contextGate.evaluate(data, priorResults as any);
      default:
        throw new Error(`Unknown gate: ${gateName}`);
    }
  }

  /**
   * Get summary of gate evaluation
   */
  getSummary(result: GateEvaluationResult): {
    passCount: number;
    weakPassCount: number;
    failCount: number;
    overallHealth: 'GOOD' | 'CONCERNING' | 'CRITICAL';
  } {
    const gates = [result.regime, result.flow, result.risk, result.context];
    
    const passCount = gates.filter(g => g.status === 'PASS').length;
    const weakPassCount = gates.filter(g => g.status === 'WEAK_PASS').length;
    const failCount = gates.filter(g => g.status === 'FAIL').length;

    let overallHealth: 'GOOD' | 'CONCERNING' | 'CRITICAL';
    if (failCount > 0) {
      overallHealth = 'CRITICAL';
    } else if (weakPassCount >= 2) {
      overallHealth = 'CONCERNING';
    } else {
      overallHealth = 'GOOD';
    }

    return {
      passCount,
      weakPassCount,
      failCount,
      overallHealth,
    };
  }
}

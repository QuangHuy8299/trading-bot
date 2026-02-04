// src/core/gate-evaluator/GateEvaluator.ts
// Main coordinator for gate evaluation logic

import { AuditLogger } from '../../infrastructure/audit';
import { MarketData } from '../data-collector/types';
import { GateEvaluationResult, GateStatus } from '../../types/gates.types';
import { RegimeGate } from './RegimeGate';
import { FlowGate } from './FlowGate';
import { RiskGate } from './RiskGate';
import { ContextGate } from './ContextGate';
import { log } from '../../utils/logger';

/**
 * GateEvaluator coordinates the evaluation of all 4 gates:
 * 1. Regime Gate (Option Data)
 * 2. Flow Gate (Whale Data)
 * 3. Risk Gate (Futures Data)
 * 4. Context Gate (On-chain/Market Data)
 */
export class GateEvaluator {
  private regimeGate: RegimeGate;
  private flowGate: FlowGate;
  private riskGate: RiskGate;
  private contextGate: ContextGate;
  private auditLogger: AuditLogger;

  constructor(auditLogger: AuditLogger) {
    this.auditLogger = auditLogger;
    this.regimeGate = new RegimeGate();
    this.flowGate = new FlowGate();
    this.riskGate = new RiskGate();
    this.contextGate = new ContextGate();
  }

  /**
   * Evaluate all gates based on provided market data
   */
  evaluate(data: MarketData): GateEvaluationResult {
    log.debug(`Evaluating gates for ${data.asset}...`);

    // 1. Evaluate individual gates
    const regimeResult = this.regimeGate.evaluate(data);
    const flowResult = this.flowGate.evaluate(data);
    const riskResult = this.riskGate.evaluate(data);
    const contextResult = this.contextGate.evaluate(data, {
      regime: regimeResult,
      flow: flowResult,
      risk: riskResult,
    });

    // 2. Log evaluation for audit
    // FIXED: Xử lý mapping DataQualityReport an toàn với các trường optional
    const logEntry = {
      asset: data.asset,
      result: {
        regime: regimeResult,
        flow: flowResult,
        risk: riskResult,
        context: contextResult,
      },
      dataQuality: {
        overall: data.dataQuality.overall, // number

        // Kiểm tra tồn tại trước khi truy cập properties con
        binance: data.dataQuality.binance ? { fresh: data.dataQuality.binance.fresh } : undefined,

        option: data.dataQuality.option
          ? {
              fresh: data.dataQuality.option.fresh,
              available: data.dataQuality.option.available,
            }
          : undefined,

        whale: data.dataQuality.whale
          ? {
              fresh: data.dataQuality.whale.fresh,
              available: data.dataQuality.whale.available,
            }
          : undefined,
      },
      timestamp: new Date(),
    };

    this.auditLogger.logGateEvaluation(logEntry);

    // 3. Return aggregated result
    return {
      regime: regimeResult,
      flow: flowResult,
      risk: riskResult,
      context: contextResult,
      evaluatedAt: new Date(),
    };
  }
}

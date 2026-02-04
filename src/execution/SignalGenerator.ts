import { v4 as uuidv4 } from 'uuid';
import { TradeDirectionEngine } from './TradeDirectionEngine';
import { RiskEngine } from './RiskEngine';
import { RiskConfig, TradeSuggestion } from '@/types/execution.types';
import { GateEvaluationResult, PermissionAssessment, PermissionState } from '@/types';

export class SignalGenerator {
  private directionEngine: TradeDirectionEngine;
  private riskEngine: RiskEngine;

  constructor(riskConfig: RiskConfig) {
    this.directionEngine = new TradeDirectionEngine();
    this.riskEngine = new RiskEngine(riskConfig);
  }

  generate(
    asset: string,
    currentPrice: number,
    gates: GateEvaluationResult,
    permission: PermissionAssessment
  ): TradeSuggestion | null {
    // 1. Chỉ tạo signal nếu Permission Engine cho phép
    if (
      permission.permissionState === PermissionState.NO_TRADE ||
      permission.permissionState === PermissionState.WAIT
    ) {
      return null;
    }

    // 2. Xác định xu hướng (Direction)
    const direction = this.directionEngine.determine(gates);
    if (direction === 'NEUTRAL') return null;

    // 3. Tính toán Risk (SL/TP/Size)
    const riskParams = this.riskEngine.calculateParams(direction, currentPrice, gates);

    // 4. Tính toán Confidence Score (Dựa trên Gate Confidence)
    const confidenceScore = this.calculateConfidence(gates);

    // 5. Build Suggestion Object
    return {
      id: uuidv4(),
      asset,
      timestamp: new Date(),
      direction,
      entryPrice: currentPrice,
      ...riskParams,
      leverage: 1, // Logic leverage có thể phức tạp hơn, tạm để 1x hoặc tính theo Margin
      confidenceScore,
      reasons: [
        permission.explanation.currentObservation,
        permission.explanation.alignmentAssessment,
        permission.explanation.conflictAssessment,
        ...permission.explanation.riskFactors,
        ...permission.explanation.cautionPoints,
        `Direction determined by ${gates.flow.flowDirection} flow`,
        `SL set based on ${
          gates.regime.comfortRange ? 'Regime Comfort Range' : 'Percentage Fallback'
        }`,
      ],
    };
  }

  private calculateConfidence(gates: GateEvaluationResult): number {
    let score = 50; // Base
    if (gates.flow.confidence === 'HIGH') score += 20;
    if (gates.regime.confidence === 'HIGH') score += 15;
    if (gates.risk.confidence === 'HIGH') score += 15;
    return Math.min(score, 100);
  }
}

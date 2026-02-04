import { GateEvaluationResult } from '../types';
import { TradeDirection } from '../types/execution.types';

export class TradeDirectionEngine {
  determine(gates: GateEvaluationResult): TradeDirection {
    const { flow, regime, risk } = gates;

    // 1. Logic Flow (Ưu tiên cao nhất: Dòng tiền đi đâu đánh đó)
    const isAccumulation = flow.flowDirection === 'ACCUMULATION';
    const isDistribution = flow.flowDirection === 'DISTRIBUTION';

    // 2. Logic Regime (Option Volatility)
    // Long Vol: Ủng hộ Breakout mạnh. Short Vol: Ủng hộ Sideway/Reversal
    const isLongVol = regime.volStance === 'LONG_VOL';

    // 3. Logic Risk (Funding Rate Sentiment)
    // Funding Dương cao -> Long Crowded -> Cẩn thận Long (hoặc ưu tiên Short)
    const isLongCrowded = risk.fundingBias === 'LONG_CROWDED';
    const isShortCrowded = risk.fundingBias === 'SHORT_CROWDED';

    // --- DECISION MATRIX ---

    // Kịch bản LONG:
    // - Whale Gom hàng
    // - Không bị Long Crowded (Funding không quá cao)
    // - Volatility ủng hộ (hoặc Neutral)
    if (isAccumulation && !isLongCrowded) {
      return 'LONG';
    }

    // Kịch bản SHORT:
    // - Whale Xả hàng
    // - Không bị Short Crowded (Funding không quá âm)
    if (isDistribution && !isShortCrowded) {
      return 'SHORT';
    }

    // Nếu tín hiệu trái chiều (Ví dụ: Whale gom nhưng Funding Long quá cao -> Sợ Long Squeeze)
    return 'NEUTRAL';
  }
}

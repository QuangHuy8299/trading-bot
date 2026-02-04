import { GateEvaluationResult } from '@/types';
import { RiskConfig } from '@/types/execution.types';

export class RiskEngine {
  constructor(private config: RiskConfig) {}

  calculateParams(direction: 'LONG' | 'SHORT', entryPrice: number, gates: GateEvaluationResult) {
    const stopLoss = this.determineStopLoss(direction, entryPrice, gates);
    const takeProfit = this.calculateTakeProfit(direction, entryPrice, stopLoss);
    const positionSizeUsd = this.calculatePositionSize(entryPrice, stopLoss);

    return {
      stopLoss,
      takeProfit,
      positionSizeUsd,
      riskRewardRatio: this.config.rewardRatio,
    };
  }

  private determineStopLoss(
    direction: 'LONG' | 'SHORT',
    entryPrice: number,
    gates: GateEvaluationResult
  ): number {
    // Ưu tiên 1: Dùng Comfort/Stress Range từ Option Data (Theo Guidebook)
    const comfortRange = gates.regime.comfortRange;

    if (comfortRange) {
      if (direction === 'LONG') {
        // Long: SL đặt dưới mép dưới Comfort Range (vào vùng Stress Range)
        return comfortRange.lower * 0.995; // Buffer 0.5%
      } else {
        // Short: SL đặt trên mép trên Comfort Range
        return comfortRange.upper * 1.005; // Buffer 0.5%
      }
    }

    // Ưu tiên 2 (Fallback): Dùng % mặc định nếu không có Option Data
    const delta = entryPrice * this.config.defaultStopLossPercent;
    return direction === 'LONG' ? entryPrice - delta : entryPrice + delta;
  }

  private calculateTakeProfit(
    direction: 'LONG' | 'SHORT',
    entryPrice: number,
    stopLoss: number
  ): number {
    const riskDistance = Math.abs(entryPrice - stopLoss);
    const rewardDistance = riskDistance * this.config.rewardRatio;

    return direction === 'LONG' ? entryPrice + rewardDistance : entryPrice - rewardDistance;
  }

  private calculatePositionSize(entryPrice: number, stopLoss: number): number {
    const riskAmount = this.config.accountBalance * this.config.riskPerTradePercent;
    const priceDistance = Math.abs(entryPrice - stopLoss);

    // Công thức: Size = Risk Amount / (Distance per unit)
    // Ví dụ: Risk $100. Entry 100, SL 95 (Dist 5). Size = 100/5 = 20 units.
    // Value = 20 * 100 = $2000.

    if (priceDistance === 0) return 0;

    const quantity = riskAmount / priceDistance;
    return quantity * entryPrice; // Trả về Volume theo USD
  }
}

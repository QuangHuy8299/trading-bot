// src/core/gate-evaluator/FlowGate.ts
// Flow Gate - Determines what capital is actually doing

import { MarketData } from '../data-collector/types';
import {
  FlowGateEvaluation,
  GateStatus,
  ConfidenceLevel,
  DataFreshness,
  GateEvidence,
} from '../../types/gates.types';

/**
 * FlowGate evaluates liquidity and smart money behavior
 * 
 * Per Phase 2:
 * - Role: Determine what capital is actually doing
 * - Inputs: CVD Whale (BTC/ETH), Label balances (Altcoin), Exchange Netflow
 * - Output: Directional flow bias + flow quality score (Whale vs Retail driven)
 * 
 * Key thresholds from Phase 2:
 * - CVD/Volume > 0.3-0.4 = Whale-driven (swing eligible)
 * - CVD/Volume < 0.1 = Retail-driven (scalp only)
 */
export class FlowGate {
  // Thresholds per Phase 2
  private readonly WHALE_DRIVEN_THRESHOLD = 0.3;
  private readonly RETAIL_DRIVEN_THRESHOLD = 0.1;

  /**
   * Evaluate flow conditions
   */
  evaluate(data: MarketData): FlowGateEvaluation {
    const whaleData = data.whale;
    const currentPrice = data.price;

    // Determine flow direction
    const flowDirection = this.determineFlowDirection(whaleData);
    
    // Determine flow quality
    const flowQuality = this.determineFlowQuality(whaleData);
    
    // Assess CVD whale data
    const cvdWhale = this.assessCvdWhale(whaleData);
    
    // Assess whale VWAP position
    const whaleVwapPosition = this.assessWhaleVwapPosition(currentPrice, whaleData);
    
    // Determine gate status
    const status = this.determineStatus(flowDirection, flowQuality, cvdWhale);
    
    // Determine confidence
    const confidence = this.determineConfidence(data, flowQuality);
    
    // Build evidence
    const { supporting, conflicting } = this.buildEvidence(
      data, flowDirection, flowQuality, cvdWhale
    );
    
    // Generate human note
    const humanNote = this.generateHumanNote(status, flowDirection, flowQuality, cvdWhale);

    return {
      gateName: 'FLOW',
      status,
      confidence,
      supportingEvidence: supporting,
      conflictingEvidence: conflicting,
      dataFreshness: this.assessDataFreshness(data),
      humanNote,
      evaluatedAt: new Date(),
      flowDirection,
      flowQuality,
      cvdWhale,
      whaleVwapPosition,
    };
  }

  /**
   * Determine flow direction from CVD data
   */
  private determineFlowDirection(
    whaleData: MarketData['whale']
  ): 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' | 'UNCLEAR' {
    if (!whaleData) {
      return 'UNCLEAR';
    }

    const { cvdWhale24h, cvdWhale7d } = whaleData;
    
    // Both positive = accumulation
    if (cvdWhale24h > 0 && cvdWhale7d > 0) {
      return 'ACCUMULATION';
    }
    
    // Both negative = distribution
    if (cvdWhale24h < 0 && cvdWhale7d < 0) {
      return 'DISTRIBUTION';
    }
    
    // Mixed signals = check magnitude
    if (Math.abs(cvdWhale24h) < Math.abs(cvdWhale7d) * 0.1) {
      // 24h is insignificant compared to 7d, follow 7d
      return cvdWhale7d > 0 ? 'ACCUMULATION' : 'DISTRIBUTION';
    }
    
    // Truly conflicting signals
    if ((cvdWhale24h > 0 && cvdWhale7d < 0) || (cvdWhale24h < 0 && cvdWhale7d > 0)) {
      return 'UNCLEAR';
    }
    
    // Near zero = neutral
    return 'NEUTRAL';
  }

  /**
   * Determine flow quality from CVD/Volume ratio
   * Per Phase 2: >0.3-0.4 = Whale-driven, <0.1 = Retail-driven
   */
  private determineFlowQuality(
    whaleData: MarketData['whale']
  ): 'WHALE_DRIVEN' | 'MIXED' | 'RETAIL_DRIVEN' {
    if (!whaleData) {
      return 'RETAIL_DRIVEN'; // Default to conservative assumption
    }

    const ratio = whaleData.cvdVolumeRatio;

    if (ratio >= this.WHALE_DRIVEN_THRESHOLD) {
      return 'WHALE_DRIVEN';
    } else if (ratio <= this.RETAIL_DRIVEN_THRESHOLD) {
      return 'RETAIL_DRIVEN';
    }
    
    return 'MIXED';
  }

  /**
   * Assess CVD whale data
   */
  private assessCvdWhale(whaleData: MarketData['whale']): FlowGateEvaluation['cvdWhale'] {
    if (!whaleData) {
      return {
        h24: { direction: 'FLAT', magnitude: 'UNKNOWN' },
        d7: { direction: 'FLAT', magnitude: 'UNKNOWN' },
        alignment: 'DIVERGING',
      };
    }

    const h24Direction = this.getDirection(whaleData.cvdWhale24h);
    const d7Direction = this.getDirection(whaleData.cvdWhale7d);
    
    const h24Magnitude = this.getMagnitude(whaleData.cvdWhale24h);
    const d7Magnitude = this.getMagnitude(whaleData.cvdWhale7d);
    
    const alignment = h24Direction === d7Direction ? 'CONSISTENT' : 'DIVERGING';

    return {
      h24: { direction: h24Direction, magnitude: h24Magnitude },
      d7: { direction: d7Direction, magnitude: d7Magnitude },
      alignment,
    };
  }

  /**
   * Get direction from CVD value
   */
  private getDirection(cvd: number): 'POSITIVE' | 'NEGATIVE' | 'FLAT' {
    const threshold = 10000; // $10k minimum to be significant
    if (cvd > threshold) return 'POSITIVE';
    if (cvd < -threshold) return 'NEGATIVE';
    return 'FLAT';
  }

  /**
   * Get magnitude description
   */
  private getMagnitude(cvd: number): string {
    const abs = Math.abs(cvd);
    if (abs >= 10000000) return 'VERY_STRONG';
    if (abs >= 1000000) return 'STRONG';
    if (abs >= 100000) return 'MODERATE';
    if (abs >= 10000) return 'WEAK';
    return 'INSIGNIFICANT';
  }

  /**
   * Assess price position relative to whale VWAP
   */
  private assessWhaleVwapPosition(
    price: number,
    whaleData: MarketData['whale']
  ): FlowGateEvaluation['whaleVwapPosition'] {
    if (!whaleData || !whaleData.whaleVwap) {
      return {
        priceVsVwap: 'AT',
        bandPosition: 'MID_RANGE',
      };
    }

    const { whaleVwap, vwapBands } = whaleData;
    
    // Determine price vs VWAP
    let priceVsVwap: 'ABOVE' | 'BELOW' | 'AT';
    const vwapDiff = (price - whaleVwap) / whaleVwap;
    
    if (vwapDiff > 0.005) {
      priceVsVwap = 'ABOVE';
    } else if (vwapDiff < -0.005) {
      priceVsVwap = 'BELOW';
    } else {
      priceVsVwap = 'AT';
    }

    // Determine band position
    let bandPosition: 'LOWER_BAND' | 'MID_RANGE' | 'UPPER_BAND';
    
    if (price <= vwapBands.lower) {
      bandPosition = 'LOWER_BAND';
    } else if (price >= vwapBands.upper) {
      bandPosition = 'UPPER_BAND';
    } else {
      bandPosition = 'MID_RANGE';
    }

    return { priceVsVwap, bandPosition };
  }

  /**
   * Determine gate status
   */
  private determineStatus(
    flowDirection: string,
    flowQuality: string,
    cvdWhale: FlowGateEvaluation['cvdWhale']
  ): GateStatus {
    // FAIL: Flow contradicts or is retail-driven
    if (flowDirection === 'UNCLEAR') {
      return GateStatus.FAIL;
    }
    
    if (flowQuality === 'RETAIL_DRIVEN') {
      return GateStatus.FAIL;
    }

    // WEAK_PASS: Flow present but mixed quality or timeframe divergence
    if (flowQuality === 'MIXED') {
      return GateStatus.WEAK_PASS;
    }
    
    if (cvdWhale.alignment === 'DIVERGING') {
      return GateStatus.WEAK_PASS;
    }

    // PASS: Whale-driven flow with consistent timeframes
    return GateStatus.PASS;
  }

  /**
   * Determine confidence level
   */
  private determineConfidence(
    data: MarketData,
    flowQuality: string
  ): ConfidenceLevel {
    // No whale data = LOW confidence
    if (!data.whale) {
      return ConfidenceLevel.LOW;
    }

    // Stale data = LOW confidence
    if (!data.dataQuality.whale.fresh) {
      return ConfidenceLevel.LOW;
    }

    // Retail-driven = LOW confidence (in flow assessment)
    if (flowQuality === 'RETAIL_DRIVEN') {
      return ConfidenceLevel.LOW;
    }

    // Mixed flow = MEDIUM confidence
    if (flowQuality === 'MIXED') {
      return ConfidenceLevel.MEDIUM;
    }

    // Whale-driven with bubble signals = HIGH confidence
    if (data.whale.bubbleSignals && data.whale.bubbleSignals.length > 0) {
      return ConfidenceLevel.HIGH;
    }

    return ConfidenceLevel.MEDIUM;
  }

  /**
   * Build evidence arrays
   */
  private buildEvidence(
    data: MarketData,
    flowDirection: string,
    flowQuality: string,
    cvdWhale: FlowGateEvaluation['cvdWhale']
  ): { supporting: GateEvidence[]; conflicting: GateEvidence[] } {
    const supporting: GateEvidence[] = [];
    const conflicting: GateEvidence[] = [];
    const timestamp = new Date();

    if (!data.whale) {
      conflicting.push({
        observation: 'Whale data unavailable',
        source: 'Whale Data',
        timestamp,
      });
      return { supporting, conflicting };
    }

    // Flow direction evidence
    if (flowDirection !== 'UNCLEAR') {
      supporting.push({
        observation: `Flow direction: ${flowDirection}`,
        source: 'CVD Analysis',
        timestamp,
      });
    } else {
      conflicting.push({
        observation: 'Flow direction unclear - mixed signals',
        source: 'CVD Analysis',
        timestamp,
      });
    }

    // Flow quality evidence
    const ratio = data.whale.cvdVolumeRatio;
    if (flowQuality === 'WHALE_DRIVEN') {
      supporting.push({
        observation: `CVD/Volume ratio: ${(ratio * 100).toFixed(1)}% (Whale-driven)`,
        source: 'Volume Analysis',
        timestamp,
      });
    } else if (flowQuality === 'RETAIL_DRIVEN') {
      conflicting.push({
        observation: `CVD/Volume ratio: ${(ratio * 100).toFixed(1)}% (Retail-driven)`,
        source: 'Volume Analysis',
        timestamp,
      });
    }

    // CVD alignment evidence
    if (cvdWhale.alignment === 'CONSISTENT') {
      supporting.push({
        observation: `24H and 7D CVD aligned: both ${cvdWhale.h24.direction}`,
        source: 'Timeframe Analysis',
        timestamp,
      });
    } else {
      conflicting.push({
        observation: `Timeframe divergence: 24H ${cvdWhale.h24.direction}, 7D ${cvdWhale.d7.direction}`,
        source: 'Timeframe Analysis',
        timestamp,
      });
    }

    // Bubble signals evidence
    const bubbles = data.whale.bubbleSignals ?? [];
    if (bubbles.length > 0) {
      const buyBubbles = bubbles.filter(b => b.type === 'BUY').length;
      const sellBubbles = bubbles.filter(b => b.type === 'SELL').length;
      supporting.push({
        observation: `Bubble signals: ${buyBubbles} buy, ${sellBubbles} sell`,
        source: 'Whale Activity',
        timestamp,
      });
    }

    return { supporting, conflicting };
  }

  /**
   * Assess data freshness
   */
  private assessDataFreshness(data: MarketData): DataFreshness {
    if (!data.whale) {
      return DataFreshness.UNKNOWN;
    }

    return data.dataQuality.whale.fresh ? DataFreshness.CURRENT : DataFreshness.STALE;
  }

  /**
   * Generate human-readable note
   */
  private generateHumanNote(
    status: GateStatus,
    flowDirection: string,
    flowQuality: string,
    cvdWhale: FlowGateEvaluation['cvdWhale']
  ): string {
    if (status === GateStatus.FAIL) {
      if (flowDirection === 'UNCLEAR') {
        return 'Flow unclear: Mixed signals between 24H and 7D CVD. Wait for clarity.';
      }
      if (flowQuality === 'RETAIL_DRIVEN') {
        return 'Flow is Retail-driven (CVD/Volume < 10%). Scalp only if any. Wait for whale participation.';
      }
      return 'Flow conditions not favorable for position trades.';
    }

    if (status === GateStatus.WEAK_PASS) {
      if (cvdWhale.alignment === 'DIVERGING') {
        return `Flow shows ${flowDirection} but timeframes diverging. 24H may be reversing. Reduced conviction.`;
      }
      return `Flow is ${flowDirection} but Mixed quality. Not fully whale-driven. Use caution.`;
    }

    // PASS
    return `Flow is ${flowDirection}, Whale-driven, with consistent timeframes. Flow supports framework activity.`;
  }
}

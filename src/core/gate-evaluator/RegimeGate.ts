// src/core/gate-evaluator/RegimeGate.ts
// Regime Gate - Establishes macro context

import { MarketData } from '../data-collector/types';
import {
  RegimeGateEvaluation,
  GateStatus,
  ConfidenceLevel,
  DataFreshness,
  GateEvidence,
} from '../../types/gates.types';

/**
 * RegimeGate evaluates the macro market context
 * 
 * Per Phase 2:
 * - Role: Establish macro context governing all decisions
 * - Inputs: Option term structure, Comfort/Stress Range, Vol stance
 * - Output: Qualitative state filtering whether trading proceeds
 */
export class RegimeGate {
  /**
   * Evaluate regime conditions
   */
  evaluate(data: MarketData): RegimeGateEvaluation {
    const optionData = data.option;
    const currentPrice = data.price;

    // Determine vol stance
    const volStance = this.determineVolStance(optionData);
    
    // Get comfort range
    const comfortRange = optionData?.comfortRange ?? null;
    
    // Determine price position
    const pricePosition = this.determinePricePosition(currentPrice, comfortRange);
    
    // Get key expiries
    const keyExpiries = this.extractKeyExpiries(optionData);
    
    // Determine gate status
    const status = this.determineStatus(volStance, comfortRange, pricePosition);
    
    // Determine confidence
    const confidence = this.determineConfidence(data, volStance, comfortRange);
    
    // Build evidence
    const { supporting, conflicting } = this.buildEvidence(data, volStance, pricePosition);
    
    // Generate human note
    const humanNote = this.generateHumanNote(status, volStance, pricePosition, comfortRange);

    return {
      gateName: 'REGIME',
      status,
      confidence,
      supportingEvidence: supporting,
      conflictingEvidence: conflicting,
      dataFreshness: this.assessDataFreshness(data),
      humanNote,
      evaluatedAt: new Date(),
      volStance,
      comfortRange,
      pricePosition,
      keyExpiries,
    };
  }

  /**
   * Determine vol stance from option data
   * Per Phase 2: Long Vol = expect big moves, Short Vol = expect sideways
   */
  private determineVolStance(optionData: MarketData['option']): 'LONG_VOL' | 'SHORT_VOL' | 'UNCLEAR' {
    if (!optionData) {
      return 'UNCLEAR';
    }

    return optionData.volStance;
  }

  /**
   * Determine price position relative to comfort range
   */
  private determinePricePosition(
    price: number,
    comfortRange: { lower: number; upper: number } | null
  ): 'INSIDE_COMFORT' | 'AT_BOUNDARY' | 'IN_STRESS' | 'UNKNOWN' {
    if (!comfortRange) {
      return 'UNKNOWN';
    }

    const { lower, upper } = comfortRange;
    const rangeWidth = upper - lower;
    const boundaryThreshold = rangeWidth * 0.1; // 10% of range

    // Price outside comfort range = in stress
    if (price < lower || price > upper) {
      return 'IN_STRESS';
    }

    // Price near edges = at boundary
    if (price < lower + boundaryThreshold || price > upper - boundaryThreshold) {
      return 'AT_BOUNDARY';
    }

    return 'INSIDE_COMFORT';
  }

  /**
   * Extract key expiry information
   */
  private extractKeyExpiries(optionData: MarketData['option']): RegimeGateEvaluation['keyExpiries'] {
    if (!optionData?.keyExpiries) {
      return [];
    }

    return optionData.keyExpiries.slice(0, 3); // Top 3 expiries
  }

  /**
   * Determine gate status
   * Per Phase 3: PASS if clear vol stance + identifiable range
   */
  private determineStatus(
    volStance: 'LONG_VOL' | 'SHORT_VOL' | 'UNCLEAR',
    comfortRange: { lower: number; upper: number } | null,
    pricePosition: string
  ): GateStatus {
    // FAIL: No clear vol stance OR no comfort range identified
    if (volStance === 'UNCLEAR') {
      return GateStatus.FAIL;
    }

    if (!comfortRange) {
      return GateStatus.FAIL;
    }

    // WEAK_PASS: Vol stance present but narrow range or boundary position
    if (pricePosition === 'AT_BOUNDARY') {
      return GateStatus.WEAK_PASS;
    }

    // Price in stress is not a regime gate fail per se, but indicates concern
    // The regime exists, price is just outside comfort
    if (pricePosition === 'IN_STRESS') {
      return GateStatus.WEAK_PASS;
    }

    // PASS: Clear vol stance + identifiable range + price inside comfort
    return GateStatus.PASS;
  }

  /**
   * Determine confidence level
   */
  private determineConfidence(
    data: MarketData,
    volStance: string,
    comfortRange: { lower: number; upper: number } | null
  ): ConfidenceLevel {
    // No option data = LOW confidence
    if (!data.option) {
      return ConfidenceLevel.LOW;
    }

    // Stale data = LOW confidence
    if (!data.dataQuality.option.fresh) {
      return ConfidenceLevel.LOW;
    }

    // Unclear vol stance = LOW confidence
    if (volStance === 'UNCLEAR') {
      return ConfidenceLevel.LOW;
    }

    // No comfort range = MEDIUM confidence (vol stance exists but incomplete picture)
    if (!comfortRange) {
      return ConfidenceLevel.MEDIUM;
    }

    // Multiple expiries with consistent bias = HIGH confidence
    const expiries = data.option.keyExpiries ?? [];
    if (expiries.length >= 2) {
      return ConfidenceLevel.HIGH;
    }

    return ConfidenceLevel.MEDIUM;
  }

  /**
   * Build evidence arrays
   */
  private buildEvidence(
    data: MarketData,
    volStance: string,
    pricePosition: string
  ): { supporting: GateEvidence[]; conflicting: GateEvidence[] } {
    const supporting: GateEvidence[] = [];
    const conflicting: GateEvidence[] = [];
    const timestamp = new Date();

    // Add vol stance evidence
    if (volStance !== 'UNCLEAR') {
      supporting.push({
        observation: `Vol stance identified: ${volStance}`,
        source: 'Option Data',
        timestamp,
      });
    } else {
      conflicting.push({
        observation: 'Vol stance unclear from option data',
        source: 'Option Data',
        timestamp,
      });
    }

    // Add comfort range evidence
    if (data.option?.comfortRange) {
      const { lower, upper } = data.option.comfortRange;
      supporting.push({
        observation: `Comfort Range: ${lower.toFixed(0)} - ${upper.toFixed(0)}`,
        source: 'Option Data',
        timestamp,
      });
    }

    // Add price position evidence
    if (pricePosition === 'INSIDE_COMFORT') {
      supporting.push({
        observation: 'Price inside comfort range',
        source: 'Price Analysis',
        timestamp,
      });
    } else if (pricePosition === 'IN_STRESS') {
      conflicting.push({
        observation: 'Price in stress range - Big Player PnL deteriorating',
        source: 'Price Analysis',
        timestamp,
      });
    }

    // Add term structure evidence
    if (data.option?.termStructure && data.option.termStructure !== 'UNCLEAR') {
      supporting.push({
        observation: `Term structure: ${data.option.termStructure}`,
        source: 'Option Data',
        timestamp,
      });
    }

    return { supporting, conflicting };
  }

  /**
   * Assess data freshness
   */
  private assessDataFreshness(data: MarketData): DataFreshness {
    if (!data.option) {
      return DataFreshness.UNKNOWN;
    }

    return data.dataQuality.option.fresh ? DataFreshness.CURRENT : DataFreshness.STALE;
  }

  /**
   * Generate human-readable note
   */
  private generateHumanNote(
    status: GateStatus,
    volStance: string,
    pricePosition: string,
    comfortRange: { lower: number; upper: number } | null
  ): string {
    if (status === GateStatus.FAIL) {
      if (volStance === 'UNCLEAR') {
        return 'Regime unclear: Option data does not show clear Vol stance. Market direction ambiguous.';
      }
      return 'Regime unclear: Unable to identify Comfort/Stress Range from option positioning.';
    }

    if (status === GateStatus.WEAK_PASS) {
      if (pricePosition === 'IN_STRESS') {
        return `Regime identified (${volStance}) but price in Stress Range. Big Players may be hedging/rolling.`;
      }
      if (pricePosition === 'AT_BOUNDARY') {
        return `Regime identified (${volStance}) but price at Comfort Range boundary. Watch for breakout.`;
      }
    }

    // PASS
    const rangeStr = comfortRange 
      ? `Comfort Range: ${comfortRange.lower.toFixed(0)}-${comfortRange.upper.toFixed(0)}`
      : '';
    return `Regime clear: ${volStance}. ${rangeStr}. Conditions favor framework-guided activity.`;
  }
}

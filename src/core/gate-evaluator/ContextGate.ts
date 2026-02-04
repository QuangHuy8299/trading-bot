// src/core/gate-evaluator/ContextGate.ts
// Context Gate - Provides execution awareness (NOT signals)

import { MarketData } from '../data-collector/types';
import {
  ContextGateEvaluation,
  GateStatus,
  ConfidenceLevel,
  DataFreshness,
  GateEvidence,
  RegimeGateEvaluation,
  FlowGateEvaluation,
  RiskGateEvaluation,
} from '../../types/gates.types';

interface PreviousGates {
  regime: RegimeGateEvaluation;
  flow: FlowGateEvaluation;
  risk: RiskGateEvaluation;
}

export class ContextGate {
  /**
   * Evaluate Context Gate
   * 
   * Per Phase 2: Context Gate provides reference zones for AWARENESS, NOT signals.
   * This gate assesses spatial context relative to Whale VWAP and bands.
   * 
   * IMPORTANT: This is explicitly NOT a signal system.
   */
  evaluate(data: MarketData, previousGates: PreviousGates): ContextGateEvaluation {
    const { binance, whale } = data;
    
    // Reference levels (default to price-based if whale data unavailable)
    const referenceLevel = this.calculateReferenceLevel(binance.price, whale);
    
    // Determine current zone
    const currentZone = this.determineCurrentZone(binance.price, referenceLevel, previousGates.flow);
    
    // Assess price vs Whale VWAP
    const priceVsWhaleVwap = this.assessPriceVsVwap(binance.price, referenceLevel.whaleVwap);
    
    // Determine band position
    const bandPosition = this.determineBandPosition(binance.price, referenceLevel);
    
    // Assess zone/flow alignment
    const zoneFlowAlignment = this.assessZoneFlowAlignment(
      currentZone, 
      previousGates.flow.flowDirection
    );
    
    // Determine gate status
    const status = this.determineStatus(zoneFlowAlignment, bandPosition, previousGates);
    
    // Determine confidence
    const confidence = this.determineConfidence(data);
    
    // Build evidence
    const { supportingEvidence, conflictingEvidence } = this.buildEvidence(
      data,
      currentZone,
      priceVsWhaleVwap,
      bandPosition,
      zoneFlowAlignment
    );
    
    // Generate human note
    const humanNote = this.generateHumanNote(
      status, 
      currentZone, 
      priceVsWhaleVwap, 
      zoneFlowAlignment
    );

    return {
      gateName: 'CONTEXT',
      status,
      confidence,
      supportingEvidence,
      conflictingEvidence,
      dataFreshness: whale ? DataFreshness.CURRENT : DataFreshness.UNKNOWN,
      humanNote,
      evaluatedAt: new Date(),
      currentZone,
      priceVsWhaleVwap,
      bandPosition,
      zoneFlowAlignment,
      referenceLevel,
    };
  }

  /**
   * Calculate reference levels
   */
  private calculateReferenceLevel(
    currentPrice: number,
    whale: MarketData['whale']
  ): { whaleVwap: number; lowerBand: number; upperBand: number } {
    if (whale?.whaleVwap && whale?.vwapBands) {
      return {
        whaleVwap: whale.whaleVwap,
        lowerBand: whale.vwapBands.lower,
        upperBand: whale.vwapBands.upper,
      };
    }
    
    // Fallback: Use price-based estimation (less reliable)
    // This provides a baseline when whale data is unavailable
    const estimatedBandWidth = currentPrice * 0.03; // 3% bands
    
    return {
      whaleVwap: currentPrice,
      lowerBand: currentPrice - estimatedBandWidth,
      upperBand: currentPrice + estimatedBandWidth,
    };
  }

  /**
   * Determine current zone based on price position and flow
   */
  private determineCurrentZone(
    price: number,
    referenceLevel: { whaleVwap: number; lowerBand: number; upperBand: number },
    flowGate: FlowGateEvaluation
  ): 'ACCUMULATION_ZONE' | 'NEUTRAL_ZONE' | 'DISTRIBUTION_ZONE' {
    const { whaleVwap, lowerBand, upperBand } = referenceLevel;
    
    // Price in lower third of range with accumulation flow
    if (price < whaleVwap - (whaleVwap - lowerBand) * 0.5) {
      if (flowGate.flowDirection === 'ACCUMULATION') {
        return 'ACCUMULATION_ZONE';
      }
    }
    
    // Price in upper third of range with distribution flow
    if (price > whaleVwap + (upperBand - whaleVwap) * 0.5) {
      if (flowGate.flowDirection === 'DISTRIBUTION') {
        return 'DISTRIBUTION_ZONE';
      }
    }
    
    return 'NEUTRAL_ZONE';
  }

  /**
   * Assess price position vs Whale VWAP
   */
  private assessPriceVsVwap(
    price: number, 
    whaleVwap: number
  ): 'DISCOUNT' | 'FAIR' | 'PREMIUM' {
    const deviation = (price - whaleVwap) / whaleVwap;
    
    if (deviation < -0.01) return 'DISCOUNT';  // More than 1% below
    if (deviation > 0.01) return 'PREMIUM';    // More than 1% above
    return 'FAIR';
  }

  /**
   * Determine band position
   */
  private determineBandPosition(
    price: number,
    referenceLevel: { whaleVwap: number; lowerBand: number; upperBand: number }
  ): 'LOWER_BAND' | 'MID_BAND' | 'UPPER_BAND' {
    const { whaleVwap, lowerBand, upperBand } = referenceLevel;
    
    const lowerMid = lowerBand + (whaleVwap - lowerBand) * 0.5;
    const upperMid = whaleVwap + (upperBand - whaleVwap) * 0.5;
    
    if (price <= lowerMid) return 'LOWER_BAND';
    if (price >= upperMid) return 'UPPER_BAND';
    return 'MID_BAND';
  }

  /**
   * Assess alignment between zone and flow
   */
  private assessZoneFlowAlignment(
    zone: 'ACCUMULATION_ZONE' | 'NEUTRAL_ZONE' | 'DISTRIBUTION_ZONE',
    flowDirection: FlowGateEvaluation['flowDirection']
  ): 'ALIGNED' | 'NEUTRAL' | 'MISALIGNED' {
    // Aligned: Zone matches flow direction
    if (zone === 'ACCUMULATION_ZONE' && flowDirection === 'ACCUMULATION') {
      return 'ALIGNED';
    }
    if (zone === 'DISTRIBUTION_ZONE' && flowDirection === 'DISTRIBUTION') {
      return 'ALIGNED';
    }
    
    // Misaligned: Zone contradicts flow direction
    if (zone === 'ACCUMULATION_ZONE' && flowDirection === 'DISTRIBUTION') {
      return 'MISALIGNED';
    }
    if (zone === 'DISTRIBUTION_ZONE' && flowDirection === 'ACCUMULATION') {
      return 'MISALIGNED';
    }
    
    // Neutral: No clear alignment/conflict
    return 'NEUTRAL';
  }

  /**
   * Determine gate status
   */
  private determineStatus(
    zoneFlowAlignment: 'ALIGNED' | 'NEUTRAL' | 'MISALIGNED',
    bandPosition: 'LOWER_BAND' | 'MID_BAND' | 'UPPER_BAND',
    previousGates: PreviousGates
  ): GateStatus {
    // FAIL: Misalignment between zone and flow
    if (zoneFlowAlignment === 'MISALIGNED') {
      return GateStatus.FAIL;
    }
    
    // FAIL: At band extreme without supporting flow
    if (
      (bandPosition === 'UPPER_BAND' && previousGates.flow.flowDirection !== 'ACCUMULATION') ||
      (bandPosition === 'LOWER_BAND' && previousGates.flow.flowDirection !== 'DISTRIBUTION')
    ) {
      // At extreme without flow support is concerning
      if (previousGates.flow.status === GateStatus.FAIL) {
        return GateStatus.FAIL;
      }
    }
    
    // WEAK_PASS: Some concerns but not critical
    if (zoneFlowAlignment === 'NEUTRAL') {
      return GateStatus.WEAK_PASS;
    }
    
    if (bandPosition !== 'MID_BAND') {
      return GateStatus.WEAK_PASS;
    }
    
    // PASS: Good alignment and position
    return GateStatus.PASS;
  }

  /**
   * Determine confidence level
   */
  private determineConfidence(data: MarketData): ConfidenceLevel {
    // Without whale data, confidence is reduced
    if (!data.whale) {
      return ConfidenceLevel.LOW;
    }

    const whaleQuality = data.dataQuality.whale;

    // Missing or stale whale quality → medium confidence
    if (!whaleQuality || !whaleQuality.fresh) {
      return ConfidenceLevel.MEDIUM;
    }

    // Map numeric overall score (0‑100) to confidence
    const overallScore = data.dataQuality.overall;
    if (overallScore >= 80) {
      return ConfidenceLevel.HIGH;
    }

    return ConfidenceLevel.MEDIUM;
  }

  /**
   * Build evidence arrays
   */
  private buildEvidence(
    data: MarketData,
    currentZone: string,
    priceVsWhaleVwap: string,
    bandPosition: string,
    zoneFlowAlignment: string
  ): { supportingEvidence: GateEvidence[]; conflictingEvidence: GateEvidence[] } {
    const supportingEvidence: GateEvidence[] = [];
    const conflictingEvidence: GateEvidence[] = [];

    // Current price position
    supportingEvidence.push({
      observation: `Current price: ${data.binance.price.toLocaleString()} (${priceVsWhaleVwap} vs Whale VWAP)`,
      source: 'Binance',
      timestamp: data.binance.timestamp,
    });

    // Zone assessment
    supportingEvidence.push({
      observation: `Zone assessment: ${currentZone.replace(/_/g, ' ')}`,
      source: 'Calculated',
      timestamp: new Date(),
    });

    // Band position
    supportingEvidence.push({
      observation: `Band position: ${bandPosition.replace(/_/g, ' ')}`,
      source: 'Calculated',
      timestamp: new Date(),
    });

    // Whale VWAP data if available
    if (data.whale?.whaleVwap) {
      supportingEvidence.push({
        observation: `Whale VWAP: ${data.whale.whaleVwap.toLocaleString()}`,
        source: 'Whale Data',
        timestamp: data.whale.timestamp,
      });
    }

    // Zone/Flow alignment
    if (zoneFlowAlignment === 'MISALIGNED') {
      conflictingEvidence.push({
        observation: 'Zone position conflicts with flow direction',
        source: 'Analysis',
        timestamp: new Date(),
      });
    }

    return { supportingEvidence, conflictingEvidence };
  }

  /**
   * Generate human-readable note
   * 
   * Per Phase 3: Must NOT use directional language or signal terminology
   */
  private generateHumanNote(
    status: GateStatus,
    currentZone: string,
    priceVsWhaleVwap: string,
    zoneFlowAlignment: string
  ): string {
    const zoneName = currentZone.replace(/_/g, ' ').toLowerCase();
    
    if (status === GateStatus.FAIL) {
      if (zoneFlowAlignment === 'MISALIGNED') {
        return `Context Gate observation: Price position (${zoneName}) does not align with observed flow. Zone/flow divergence present.`;
      }
      return `Context Gate observation: Current position presents concerns. Reference zones do not support current flow.`;
    }
    
    if (status === GateStatus.WEAK_PASS) {
      return `Context Gate observation: Price at ${priceVsWhaleVwap.toLowerCase()} vs Whale VWAP in ${zoneName}. Some factors warrant attention.`;
    }
    
    return `Context Gate observation: Price position in ${zoneName} at ${priceVsWhaleVwap.toLowerCase()} vs Whale VWAP. Zone and flow are ${zoneFlowAlignment.toLowerCase()}.`;
  }
}

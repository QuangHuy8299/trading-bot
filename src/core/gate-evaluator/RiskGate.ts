// src/core/gate-evaluator/RiskGate.ts
// Risk Gate - Assesses positioning and leverage risk

import { MarketData } from '../data-collector/types';
import {
  RiskGateEvaluation,
  GateStatus,
  ConfidenceLevel,
  DataFreshness,
  GateEvidence,
} from '../../types/gates.types';

export class RiskGate {
  /**
   * Evaluate Risk Gate
   * 
   * Per Phase 2: Risk Gate FAIL is a Tier 1 constraint that blocks ALL trading.
   * 
   * Inputs:
   * - OI trend (expanding/stable/contracting)
   * - Funding rate (long crowded / short crowded / balanced)
   * - Crowding level
   * - Stress range status
   * - Liquidation context
   */
  evaluate(data: MarketData): RiskGateEvaluation {
    const { binance, option } = data;
    
    // Assess OI trend
    const oiTrend = this.assessOiTrend(binance.openInterest, binance.oiChange24h);
    
    // Assess funding bias
    const fundingBias = this.assessFundingBias(binance.fundingRate);
    
    // Assess crowding level
    const crowdingLevel = this.assessCrowding(binance.fundingRate, binance.openInterest);
    
    // Assess stress range (requires option data for Comfort/Stress Range)
    const stressRangeStatus = this.assessStressRange(
      binance.price, 
      option?.comfortRange ?? null
    );
    
    // Assess liquidation context
    const liquidationContext = this.assessLiquidationContext(
      binance.price,
      binance.liquidationLevels
    );

    // Determine gate status based on Phase 2 rules
    const status = this.determineStatus(crowdingLevel, stressRangeStatus);
    
    // Determine confidence based on data quality
    const confidence = this.determineConfidence(data);
    
    // Build evidence
    const { supportingEvidence, conflictingEvidence } = this.buildEvidence(
      data, 
      oiTrend, 
      fundingBias, 
      crowdingLevel
    );
    
    // Generate human-readable note
    const humanNote = this.generateHumanNote(status, crowdingLevel, stressRangeStatus, fundingBias);

    return {
      gateName: 'RISK',
      status,
      confidence,
      supportingEvidence,
      conflictingEvidence,
      dataFreshness: data.dataQuality.binance.fresh 
        ? DataFreshness.CURRENT 
        : DataFreshness.STALE,
      humanNote,
      evaluatedAt: new Date(),
      oiTrend,
      fundingBias,
      crowdingLevel,
      stressRangeStatus,
      liquidationContext,
    };
  }

  /**
   * Assess Open Interest trend
   */
  private assessOiTrend(
    currentOi: number, 
    oiChange24h?: number
  ): 'EXPANDING' | 'STABLE' | 'CONTRACTING' {
    if (!oiChange24h) {
      return 'STABLE'; // Default if no historical data
    }

    const changePercent = oiChange24h;
    
    if (changePercent > 5) return 'EXPANDING';
    if (changePercent < -5) return 'CONTRACTING';
    return 'STABLE';
  }

  /**
   * Assess funding rate bias
   * 
   * Per Phase 2: No exact thresholds defined, these are qualitative assessments
   */
  private assessFundingBias(
    fundingRate: number
  ): 'LONG_CROWDED' | 'SHORT_CROWDED' | 'BALANCED' {
    // Funding rate is typically expressed as a percentage (e.g., 0.01 = 0.01%)
    // Extreme funding: > 0.05% or < -0.05%
    // Elevated funding: > 0.02% or < -0.02%
    
    if (fundingRate > 0.0005) return 'LONG_CROWDED';  // 0.05%
    if (fundingRate < -0.0005) return 'SHORT_CROWDED';
    return 'BALANCED';
  }

  /**
   * Assess overall crowding level
   * 
   * Combines funding rate and OI to determine crowding severity
   */
  private assessCrowding(
    fundingRate: number,
    openInterest: number
  ): 'EXTREME' | 'ELEVATED' | 'NORMAL' | 'LOW' {
    const fundingExtreme = Math.abs(fundingRate) > 0.001; // 0.1%
    const fundingElevated = Math.abs(fundingRate) > 0.0005; // 0.05%
    
    // EXTREME: Very high funding indicating one-sided positioning
    if (fundingExtreme) {
      return 'EXTREME';
    }
    
    // ELEVATED: Moderate crowding
    if (fundingElevated) {
      return 'ELEVATED';
    }
    
    // NORMAL: Typical market conditions
    if (Math.abs(fundingRate) > 0.0001) {
      return 'NORMAL';
    }
    
    // LOW: Very balanced positioning
    return 'LOW';
  }

  /**
   * Assess stress range status
   * 
   * Per Phase 2:
   * - Comfort Range = Price zone where Big Player Option PnL is maximized
   * - Stress Range = Price zone where Big Player PnL deteriorates
   * 
   * If price is OUTSIDE comfort range, it's IN stress range
   */
  private assessStressRange(
    currentPrice: number,
    comfortRange: { lower: number; upper: number } | null
  ): 'OUTSIDE' | 'AT_BOUNDARY' | 'INSIDE' {
    if (!comfortRange) {
      // Cannot determine without option data - assume OUTSIDE (safe default)
      return 'OUTSIDE';
    }
    
    const { lower, upper } = comfortRange;
    const rangeWidth = upper - lower;
    const boundaryThreshold = rangeWidth * 0.1; // 10% of range width
    
    // Price is IN STRESS range (outside comfort range)
    if (currentPrice < lower || currentPrice > upper) {
      return 'INSIDE';
    }
    
    // Price is AT BOUNDARY of comfort range
    if (
      currentPrice < lower + boundaryThreshold ||
      currentPrice > upper - boundaryThreshold
    ) {
      return 'AT_BOUNDARY';
    }
    
    // Price is safely inside comfort range (OUTSIDE stress range)
    return 'OUTSIDE';
  }

  /**
   * Assess liquidation context
   */
  private assessLiquidationContext(
    currentPrice: number,
    liquidationLevels?: { longs: number[]; shorts: number[] }
  ): { nearestCluster: 'ABOVE' | 'BELOW'; distance: 'DISTANT' | 'MODERATE' | 'PROXIMATE' } {
    if (!liquidationLevels) {
      return { nearestCluster: 'ABOVE', distance: 'DISTANT' };
    }

    const { longs, shorts } = liquidationLevels;
    
    // Find nearest liquidation cluster
    const nearestLong = longs.length > 0 
      ? Math.min(...longs.filter(l => l < currentPrice)) 
      : 0;
    const nearestShort = shorts.length > 0 
      ? Math.min(...shorts.filter(s => s > currentPrice)) 
      : Infinity;
    
    const distanceToLong = nearestLong > 0 ? currentPrice - nearestLong : Infinity;
    const distanceToShort = nearestShort < Infinity ? nearestShort - currentPrice : Infinity;
    
    const nearestCluster = distanceToLong < distanceToShort ? 'BELOW' : 'ABOVE';
    const nearestDistance = Math.min(distanceToLong, distanceToShort);
    const distancePercent = (nearestDistance / currentPrice) * 100;
    
    let distance: 'DISTANT' | 'MODERATE' | 'PROXIMATE';
    if (distancePercent < 2) {
      distance = 'PROXIMATE';
    } else if (distancePercent < 5) {
      distance = 'MODERATE';
    } else {
      distance = 'DISTANT';
    }
    
    return { nearestCluster, distance };
  }

  /**
   * Determine gate status
   * 
   * Per Phase 2: Risk Gate FAIL on extreme crowding OR price in stress range
   */
  private determineStatus(
    crowdingLevel: 'EXTREME' | 'ELEVATED' | 'NORMAL' | 'LOW',
    stressRangeStatus: 'OUTSIDE' | 'AT_BOUNDARY' | 'INSIDE'
  ): GateStatus {
    // FAIL conditions (Tier 1 constraints)
    if (crowdingLevel === 'EXTREME') {
      return GateStatus.FAIL;
    }
    
    if (stressRangeStatus === 'INSIDE') {
      return GateStatus.FAIL;
    }
    
    // WEAK_PASS conditions
    if (crowdingLevel === 'ELEVATED' || stressRangeStatus === 'AT_BOUNDARY') {
      return GateStatus.WEAK_PASS;
    }
    
    // PASS: No significant risk factors
    return GateStatus.PASS;
  }

  /**
   * Determine confidence level based on data quality
   */
  private determineConfidence(data: MarketData): ConfidenceLevel {
    // CRITICAL or unavailable data → LOW confidence
    if (data.dataQuality.overall === 'CRITICAL') {
      return ConfidenceLevel.LOW;
    }
    
    // Missing Binance data → LOW confidence
    if (!data.dataQuality.binance.fresh) {
      return ConfidenceLevel.LOW;
    }
    
    // Missing option data (can't determine stress range) → MEDIUM confidence
    if (!data.option) {
      return ConfidenceLevel.MEDIUM;
    }
    
    // Good data quality → HIGH confidence
    if (data.dataQuality.overall === 'GOOD') {
      return ConfidenceLevel.HIGH;
    }
    
    return ConfidenceLevel.MEDIUM;
  }

  /**
   * Build evidence arrays
   */
  private buildEvidence(
    data: MarketData,
    oiTrend: string,
    fundingBias: string,
    crowdingLevel: string
  ): { supportingEvidence: GateEvidence[]; conflictingEvidence: GateEvidence[] } {
    const supportingEvidence: GateEvidence[] = [];
    const conflictingEvidence: GateEvidence[] = [];

    // Funding rate evidence
    supportingEvidence.push({
      observation: `Funding rate: ${(data.binance.fundingRate * 100).toFixed(4)}% (${fundingBias})`,
      source: 'Binance Futures',
      timestamp: data.binance.timestamp,
    });

    // Open Interest evidence
    supportingEvidence.push({
      observation: `Open Interest: ${data.binance.openInterest.toLocaleString()} (${oiTrend})`,
      source: 'Binance Futures',
      timestamp: data.binance.timestamp,
    });

    // Crowding level evidence
    supportingEvidence.push({
      observation: `Crowding assessment: ${crowdingLevel}`,
      source: 'Calculated',
      timestamp: new Date(),
    });

    // Option data evidence (if available)
    if (data.option?.comfortRange) {
      supportingEvidence.push({
        observation: `Comfort Range: ${data.option.comfortRange.lower.toLocaleString()} - ${data.option.comfortRange.upper.toLocaleString()}`,
        source: 'Option Data',
        timestamp: data.option.timestamp,
      });
    }

    return { supportingEvidence, conflictingEvidence };
  }

  /**
   * Generate human-readable note
   */
  private generateHumanNote(
    status: GateStatus,
    crowdingLevel: string,
    stressRangeStatus: string,
    fundingBias: string
  ): string {
    if (status === GateStatus.FAIL) {
      const reasons: string[] = [];
      
      if (crowdingLevel === 'EXTREME') {
        reasons.push('Extreme crowding detected');
      }
      if (stressRangeStatus === 'INSIDE') {
        reasons.push('Price in stress range');
      }
      
      return `Risk Gate FAIL: ${reasons.join(', ')}. This is a Tier 1 constraint - trading not permitted under framework rules.`;
    }
    
    if (status === GateStatus.WEAK_PASS) {
      const factors: string[] = [];
      
      if (crowdingLevel === 'ELEVATED') {
        factors.push(`elevated ${fundingBias.toLowerCase().replace('_', ' ')}`);
      }
      if (stressRangeStatus === 'AT_BOUNDARY') {
        factors.push('price approaching stress range boundary');
      }
      
      return `Risk factors present: ${factors.join(', ')}. Reduced position sizing recommended.`;
    }
    
    return 'Risk metrics within normal parameters. Positioning balanced and price within comfort range.';
  }
}

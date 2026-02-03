// src/core/permission-engine/ConflictDetector.ts
// Conflict Detector - Identifies disagreements between layers

import { 
  GateEvaluationResult, 
  GateStatus,
  ConfidenceLevel,
} from '../../types/gates.types';
import { LayerConflict } from '../../types/permission.types';

/**
 * ConflictDetector identifies and reports conflicts between evaluation layers.
 * 
 * Per Phase 3 §2.2: Conflicts are never averaged or hidden.
 * Both signals must be reported with severity assessment.
 */
export class ConflictDetector {
  /**
   * Detect all conflicts in gate evaluations
   */
  detect(gateResult: GateEvaluationResult): LayerConflict[] {
    const conflicts: LayerConflict[] = [];
    const { regime, flow, risk, context } = gateResult;

    // Check Regime vs Flow conflict
    const regimeFlowConflict = this.checkRegimeFlowConflict(regime, flow);
    if (regimeFlowConflict) conflicts.push(regimeFlowConflict);

    // Check Flow vs Risk conflict
    const flowRiskConflict = this.checkFlowRiskConflict(flow, risk);
    if (flowRiskConflict) conflicts.push(flowRiskConflict);

    // Check Risk vs Context conflict
    const riskContextConflict = this.checkRiskContextConflict(risk, context);
    if (riskContextConflict) conflicts.push(riskContextConflict);

    // Check Flow timeframe conflict (24H vs 7D)
    const timeframeConflict = this.checkFlowTimeframeConflict(flow);
    if (timeframeConflict) conflicts.push(timeframeConflict);

    // Check Zone vs Flow conflict
    const zoneFlowConflict = this.checkZoneFlowConflict(context, flow);
    if (zoneFlowConflict) conflicts.push(zoneFlowConflict);

    return conflicts;
  }

  /**
   * Check for Regime vs Flow conflict
   * 
   * HIGH severity: Option bias contradicts Whale flow direction
   */
  private checkRegimeFlowConflict(
    regime: GateEvaluationResult['regime'],
    flow: GateEvaluationResult['flow']
  ): LayerConflict | null {
    // Long Vol regime with Distribution flow
    if (regime.volStance === 'LONG_VOL' && flow.flowDirection === 'DISTRIBUTION') {
      return {
        conflictType: 'REGIME_FLOW_DIVERGENCE',
        layerA: {
          name: 'Regime',
          signal: `Vol stance: ${regime.volStance}`,
          confidence: regime.confidence,
        },
        layerB: {
          name: 'Flow',
          signal: `Direction: ${flow.flowDirection}`,
          confidence: flow.confidence,
        },
        severity: 'HIGH',
        description: 'Option stance (Long Vol) suggests preparing for movement, but whale flow shows distribution',
        detectedAt: new Date(),
      };
    }

    // Short Vol regime with strong Accumulation
    if (regime.volStance === 'SHORT_VOL' && flow.flowDirection === 'ACCUMULATION') {
      // This is less severe - could be positioning for range
      return {
        conflictType: 'REGIME_FLOW_DIVERGENCE',
        layerA: {
          name: 'Regime',
          signal: `Vol stance: ${regime.volStance}`,
          confidence: regime.confidence,
        },
        layerB: {
          name: 'Flow',
          signal: `Direction: ${flow.flowDirection}`,
          confidence: flow.confidence,
        },
        severity: 'MEDIUM',
        description: 'Option stance (Short Vol) suggests range expectations, but whale flow shows accumulation',
        detectedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * Check for Flow vs Risk conflict
   * 
   * MEDIUM severity: Accumulation with crowded longs (or vice versa)
   */
  private checkFlowRiskConflict(
    flow: GateEvaluationResult['flow'],
    risk: GateEvaluationResult['risk']
  ): LayerConflict | null {
    // Accumulation flow with long crowding
    if (flow.flowDirection === 'ACCUMULATION' && risk.fundingBias === 'LONG_CROWDED') {
      return {
        conflictType: 'FLOW_RISK_DIVERGENCE',
        layerA: {
          name: 'Flow',
          signal: 'Accumulation detected',
          confidence: flow.confidence,
        },
        layerB: {
          name: 'Risk',
          signal: 'Longs are crowded',
          confidence: risk.confidence,
        },
        severity: 'MEDIUM',
        description: 'Whale accumulation occurring but positioning is already long-crowded',
        detectedAt: new Date(),
      };
    }

    // Distribution flow with short crowding
    if (flow.flowDirection === 'DISTRIBUTION' && risk.fundingBias === 'SHORT_CROWDED') {
      return {
        conflictType: 'FLOW_RISK_DIVERGENCE',
        layerA: {
          name: 'Flow',
          signal: 'Distribution detected',
          confidence: flow.confidence,
        },
        layerB: {
          name: 'Risk',
          signal: 'Shorts are crowded',
          confidence: risk.confidence,
        },
        severity: 'MEDIUM',
        description: 'Whale distribution occurring but positioning is already short-crowded',
        detectedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * Check for Risk vs Context conflict
   * 
   * LOW severity: Low crowding but at band extremes
   */
  private checkRiskContextConflict(
    risk: GateEvaluationResult['risk'],
    context: GateEvaluationResult['context']
  ): LayerConflict | null {
    // Low crowding but at upper band (potential squeeze setup)
    if (
      risk.crowdingLevel === 'LOW' && 
      context.bandPosition === 'UPPER_BAND'
    ) {
      return {
        conflictType: 'RISK_CONTEXT_DIVERGENCE',
        layerA: {
          name: 'Risk',
          signal: 'Low crowding',
          confidence: risk.confidence,
        },
        layerB: {
          name: 'Context',
          signal: 'Upper band position',
          confidence: context.confidence,
        },
        severity: 'LOW',
        description: 'Low crowding but price at upper band - potential for squeeze or reversal',
        detectedAt: new Date(),
      };
    }

    // Low crowding but at lower band
    if (
      risk.crowdingLevel === 'LOW' && 
      context.bandPosition === 'LOWER_BAND'
    ) {
      return {
        conflictType: 'RISK_CONTEXT_DIVERGENCE',
        layerA: {
          name: 'Risk',
          signal: 'Low crowding',
          confidence: risk.confidence,
        },
        layerB: {
          name: 'Context',
          signal: 'Lower band position',
          confidence: context.confidence,
        },
        severity: 'LOW',
        description: 'Low crowding but price at lower band - potential for bounce or continuation',
        detectedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * Check for Flow timeframe conflict (24H vs 7D)
   * 
   * MEDIUM severity: Opposite CVD directions between timeframes
   */
  private checkFlowTimeframeConflict(
    flow: GateEvaluationResult['flow']
  ): LayerConflict | null {
    if (flow.cvdWhale.alignment === 'DIVERGING') {
      const h24Dir = flow.cvdWhale.h24.direction;
      const d7Dir = flow.cvdWhale.d7.direction;

      // Only flag if they're opposite (not just different)
      if (
        (h24Dir === 'POSITIVE' && d7Dir === 'NEGATIVE') ||
        (h24Dir === 'NEGATIVE' && d7Dir === 'POSITIVE')
      ) {
        return {
          conflictType: 'FLOW_TIMEFRAME_DIVERGENCE',
          layerA: {
            name: 'Flow (24H)',
            signal: `CVD direction: ${h24Dir}`,
            confidence: flow.confidence,
          },
          layerB: {
            name: 'Flow (7D)',
            signal: `CVD direction: ${d7Dir}`,
            confidence: flow.confidence,
          },
          severity: 'MEDIUM',
          description: `24H flow (${h24Dir}) contradicts 7D flow (${d7Dir}) - possible trend change`,
          detectedAt: new Date(),
        };
      }
    }

    return null;
  }

  /**
   * Check for Zone vs Flow conflict
   * 
   * HIGH severity: Zone position contradicts flow direction
   */
  private checkZoneFlowConflict(
    context: GateEvaluationResult['context'],
    flow: GateEvaluationResult['flow']
  ): LayerConflict | null {
    // Accumulation zone but distribution flow
    if (
      context.currentZone === 'ACCUMULATION_ZONE' && 
      flow.flowDirection === 'DISTRIBUTION'
    ) {
      return {
        conflictType: 'ZONE_FLOW_DIVERGENCE',
        layerA: {
          name: 'Context',
          signal: 'Accumulation zone',
          confidence: context.confidence,
        },
        layerB: {
          name: 'Flow',
          signal: 'Distribution detected',
          confidence: flow.confidence,
        },
        severity: 'HIGH',
        description: 'Price in accumulation zone but flow shows distribution - significant divergence',
        detectedAt: new Date(),
      };
    }

    // Distribution zone but accumulation flow
    if (
      context.currentZone === 'DISTRIBUTION_ZONE' && 
      flow.flowDirection === 'ACCUMULATION'
    ) {
      return {
        conflictType: 'ZONE_FLOW_DIVERGENCE',
        layerA: {
          name: 'Context',
          signal: 'Distribution zone',
          confidence: context.confidence,
        },
        layerB: {
          name: 'Flow',
          signal: 'Accumulation detected',
          confidence: flow.confidence,
        },
        severity: 'HIGH',
        description: 'Price in distribution zone but flow shows accumulation - significant divergence',
        detectedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * Get summary of all conflicts
   */
  summarize(conflicts: LayerConflict[]): {
    total: number;
    bySeverity: { HIGH: number; MEDIUM: number; LOW: number };
    mostSevere: LayerConflict | null;
  } {
    const bySeverity = {
      HIGH: conflicts.filter(c => c.severity === 'HIGH').length,
      MEDIUM: conflicts.filter(c => c.severity === 'MEDIUM').length,
      LOW: conflicts.filter(c => c.severity === 'LOW').length,
    };

    const severityOrder = ['HIGH', 'MEDIUM', 'LOW'] as const;
    const mostSevere = conflicts.length > 0
      ? conflicts.sort((a, b) => 
          severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
        )[0]
      : null;

    return {
      total: conflicts.length,
      bySeverity,
      mostSevere,
    };
  }
}

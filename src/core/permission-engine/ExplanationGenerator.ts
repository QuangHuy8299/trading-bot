// src/core/permission-engine/ExplanationGenerator.ts
// Explanation Generator - Creates human-readable explanations per Phase 3 §3

import { GateEvaluationResult, GateStatus } from '../../types/gates.types';
import { 
  PermissionState, 
  LayerConflict, 
  PermissionExplanation 
} from '../../types/permission.types';

/**
 * ExplanationGenerator creates the "Guide Brain" explanation layer.
 * 
 * Per Phase 3 §3.3, explanations must:
 * - NEVER use directional language (bullish/bearish)
 * - NEVER suggest specific actions (buy/sell)
 * - NEVER imply certainty (will happen)
 * - Focus on observations and conditions
 */
export class ExplanationGenerator {
  /**
   * Generate complete explanation for an assessment
   */
  generate(
    gateResult: GateEvaluationResult,
    permissionState: PermissionState,
    conflicts: LayerConflict[]
  ): PermissionExplanation {
    return {
      currentObservation: this.generateCurrentObservation(gateResult, permissionState),
      alignmentAssessment: this.generateAlignmentAssessment(gateResult),
      conflictAssessment: this.generateConflictAssessment(conflicts),
      riskFactors: this.generateRiskFactors(gateResult),
      cautionPoints: this.generateCautionPoints(gateResult, conflicts),
    };
  }

  /**
   * Generate current observation text
   * 
   * Per Phase 3 §3.3: Permitted language patterns
   */
  private generateCurrentObservation(
    gateResult: GateEvaluationResult,
    permissionState: PermissionState
  ): string {
    const { regime, flow, risk, context } = gateResult;

    // Build observation based on permission state
    switch (permissionState) {
      case PermissionState.TRADE_ALLOWED:
        return this.buildTradeAllowedObservation(gateResult);
      
      case PermissionState.TRADE_ALLOWED_REDUCED_RISK:
        return this.buildReducedRiskObservation(gateResult);
      
      case PermissionState.SCALP_ONLY:
        return this.buildScalpOnlyObservation(gateResult);
      
      case PermissionState.WAIT:
        return this.buildWaitObservation(gateResult);
      
      case PermissionState.NO_TRADE:
        return this.buildNoTradeObservation(gateResult);
      
      default:
        return 'Current market conditions are being assessed.';
    }
  }

  private buildTradeAllowedObservation(gateResult: GateEvaluationResult): string {
    const { regime, flow } = gateResult;
    
    let observation = 'System observes: ';
    
    // Regime context
    if (regime.volStance !== 'UNCLEAR') {
      observation += `Option market indicates ${regime.volStance.toLowerCase().replace('_', ' ')} stance. `;
    }
    
    // Flow context
    if (flow.flowDirection !== 'UNCLEAR') {
      observation += `Whale activity shows ${flow.flowDirection.toLowerCase()} pattern. `;
    }
    
    // Flow quality
    if (flow.flowQuality === 'WHALE_DRIVEN') {
      observation += 'Flow quality is whale-driven. ';
    }
    
    observation += 'All gates pass - full discretion permitted under framework.';
    
    return observation;
  }

  private buildReducedRiskObservation(gateResult: GateEvaluationResult): string {
    const weakGates = [
      gateResult.regime,
      gateResult.flow,
      gateResult.risk,
      gateResult.context,
    ].filter(g => g.status === GateStatus.WEAK_PASS);
    
    let observation = 'System observes: Core conditions met with some factors requiring attention. ';
    
    for (const gate of weakGates) {
      observation += `${gate.gateName} gate shows: ${gate.humanNote} `;
    }
    
    observation += 'Reduced exposure recommended.';
    
    return observation;
  }

  private buildScalpOnlyObservation(gateResult: GateEvaluationResult): string {
    const { flow } = gateResult;
    
    let observation = 'System observes: ';
    
    if (flow.status === GateStatus.FAIL) {
      observation += 'Flow gate indicates insufficient support for extended exposure. ';
    } else if (flow.status === GateStatus.WEAK_PASS) {
      observation += 'Flow quality is uncertain - ';
      if (flow.flowQuality === 'RETAIL_DRIVEN') {
        observation += 'activity appears retail-driven rather than whale-driven. ';
      } else if (flow.flowQuality === 'MIXED') {
        observation += 'mixed signals between timeframes. ';
      }
    }
    
    observation += 'Short-term activity only if any.';
    
    return observation;
  }

  private buildWaitObservation(gateResult: GateEvaluationResult): string {
    let observation = 'System observes: Multiple factors indicate transitional conditions. ';
    
    const weakGates = [
      gateResult.regime,
      gateResult.flow,
      gateResult.risk,
      gateResult.context,
    ].filter(g => g.status === GateStatus.WEAK_PASS);
    
    if (weakGates.length >= 3) {
      observation += `${weakGates.length} of 4 gates show weak conditions. `;
    }
    
    observation += 'Current environment does not support new position initiation.';
    
    return observation;
  }

  private buildNoTradeObservation(gateResult: GateEvaluationResult): string {
    const { regime, flow, risk, context } = gateResult;
    
    let observation = 'System observes: ';
    
    // Identify the blocking condition
    if (risk.status === GateStatus.FAIL) {
      observation += `Risk gate conditions not met - ${risk.humanNote} `;
      observation += 'This is a framework constraint that blocks exposure.';
    } else if (regime.status === GateStatus.FAIL) {
      observation += `Regime conditions unclear - ${regime.humanNote} `;
      observation += 'Cannot establish market context for framework application.';
    } else if (flow.status === GateStatus.FAIL && context.status === GateStatus.FAIL) {
      observation += 'Both flow and context gates indicate unfavorable conditions. ';
      observation += 'Multiple secondary gates failing blocks exposure under framework.';
    }
    
    return observation;
  }

  /**
   * Generate alignment assessment
   */
  private generateAlignmentAssessment(gateResult: GateEvaluationResult): string {
    const { regime, flow, risk, context } = gateResult;
    const gates = [regime, flow, risk, context];
    
    const passing = gates.filter(g => g.status === GateStatus.PASS).length;
    const weakPassing = gates.filter(g => g.status === GateStatus.WEAK_PASS).length;
    const failing = gates.filter(g => g.status === GateStatus.FAIL).length;
    
    if (failing === 0 && weakPassing === 0) {
      return 'All layers are aligned with passing conditions.';
    }
    
    if (failing > 0) {
      const failingGates = gates
        .filter(g => g.status === GateStatus.FAIL)
        .map(g => g.gateName);
      return `Layer misalignment detected. Failing gates: ${failingGates.join(', ')}.`;
    }
    
    if (weakPassing > 0) {
      const weakGates = gates
        .filter(g => g.status === GateStatus.WEAK_PASS)
        .map(g => g.gateName);
      return `Partial alignment. Weak conditions on: ${weakGates.join(', ')}.`;
    }
    
    return 'Layer alignment assessment complete.';
  }

  /**
   * Generate conflict assessment
   */
  private generateConflictAssessment(conflicts: LayerConflict[]): string {
    if (conflicts.length === 0) {
      return 'No significant conflicts detected between layers.';
    }
    
    const highSeverity = conflicts.filter(c => c.severity === 'HIGH');
    const mediumSeverity = conflicts.filter(c => c.severity === 'MEDIUM');
    
    let assessment = `${conflicts.length} conflict(s) identified. `;
    
    if (highSeverity.length > 0) {
      assessment += `High severity: ${highSeverity.map(c => c.conflictType).join(', ')}. `;
    }
    
    if (mediumSeverity.length > 0) {
      assessment += `Medium severity: ${mediumSeverity.map(c => c.conflictType).join(', ')}. `;
    }
    
    // Add most significant conflict description
    const mostSevere = highSeverity[0] || mediumSeverity[0] || conflicts[0];
    if (mostSevere) {
      assessment += mostSevere.description;
    }
    
    return assessment;
  }

  /**
   * Generate risk factors list
   */
  private generateRiskFactors(gateResult: GateEvaluationResult): string[] {
    const factors: string[] = [];
    const { risk, flow, context } = gateResult;
    
    // Risk gate factors
    if (risk.crowdingLevel === 'EXTREME') {
      factors.push('Extreme positioning crowding detected');
    } else if (risk.crowdingLevel === 'ELEVATED') {
      factors.push('Elevated positioning crowding');
    }
    
    if (risk.stressRangeStatus === 'INSIDE') {
      factors.push('Price currently in stress range');
    } else if (risk.stressRangeStatus === 'AT_BOUNDARY') {
      factors.push('Price approaching stress range boundary');
    }
    
    if (risk.fundingBias === 'LONG_CROWDED') {
      factors.push('Long positions are crowded (elevated funding)');
    } else if (risk.fundingBias === 'SHORT_CROWDED') {
      factors.push('Short positions are crowded (negative funding)');
    }
    
    // Flow quality factors
    if (flow.flowQuality === 'RETAIL_DRIVEN') {
      factors.push('Flow appears retail-driven, not whale-driven');
    }
    
    if (flow.cvdWhale.alignment === 'DIVERGING') {
      factors.push('Short-term and long-term flow are diverging');
    }
    
    // Context factors
    if (context.bandPosition === 'UPPER_BAND' || context.bandPosition === 'LOWER_BAND') {
      factors.push(`Price at ${context.bandPosition.toLowerCase().replace('_', ' ')}`);
    }
    
    if (context.zoneFlowAlignment === 'MISALIGNED') {
      factors.push('Zone position does not align with flow direction');
    }
    
    return factors;
  }

  /**
   * Generate caution points
   */
  private generateCautionPoints(
    gateResult: GateEvaluationResult,
    conflicts: LayerConflict[]
  ): string[] {
    const cautions: string[] = [];
    const { regime, flow, risk } = gateResult;
    
    // Data quality cautions
    if (regime.dataFreshness !== 'CURRENT') {
      cautions.push('Regime data may not be current');
    }
    
    if (flow.dataFreshness !== 'CURRENT') {
      cautions.push('Flow data may not be current');
    }
    
    // Confidence cautions
    if (regime.confidence === 'LOW') {
      cautions.push('Regime assessment has low confidence');
    }
    
    if (flow.confidence === 'LOW') {
      cautions.push('Flow assessment has low confidence');
    }
    
    // Conflict cautions
    for (const conflict of conflicts) {
      if (conflict.severity === 'HIGH') {
        cautions.push(`High severity conflict: ${conflict.layerA.name} vs ${conflict.layerB.name}`);
      }
    }
    
    // Regime-specific cautions
    if (regime.volStance === 'UNCLEAR') {
      cautions.push('Option market stance is unclear - context may shift');
    }
    
    // Add standard disclaimer if any cautions
    if (cautions.length > 0) {
      cautions.push('Human judgment remains the final authority on all decisions');
    }
    
    return cautions;
  }
}

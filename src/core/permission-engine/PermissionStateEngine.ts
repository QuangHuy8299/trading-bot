// src/core/permission-engine/PermissionStateEngine.ts
// Main Permission State Engine - Calculates permission states from gate evaluations

import { GateEvaluationResult } from '../../types/gates.types';
import { StateCalculator } from './StateCalculator';
import { ConflictDetector } from './ConflictDetector';
import { ExplanationGenerator } from './ExplanationGenerator';
import {
  PermissionState,
  PermissionAssessment,
  LayerConflict,
  PermissionExplanation,
  UncertaintyLevel,
} from '../../types/permission.types';
import { TIMING } from '../../config/constants';
import { v4 as uuidv4 } from 'uuid';

export class PermissionStateEngine {
  private stateCalculator: StateCalculator;
  private conflictDetector: ConflictDetector;
  private explanationGenerator: ExplanationGenerator;

  constructor() {
    this.stateCalculator = new StateCalculator();
    this.conflictDetector = new ConflictDetector();
    this.explanationGenerator = new ExplanationGenerator();
  }

  /**
   * Assess permission state for an asset based on gate evaluations
   * 
   * This is the main entry point for permission calculation.
   * 
   * @param asset - Asset symbol (e.g., 'BTCUSDT')
   * @param gateResult - Results from all four gates
   * @returns Full permission assessment with explanation
   */
  assess(asset: string, gateResult: GateEvaluationResult): PermissionAssessment {
    const assessedAt = new Date();
    
    // Step 1: Detect conflicts between layers
    const conflicts = this.conflictDetector.detect(gateResult);
    
    // Step 2: Calculate permission state using Phase 3 logic
    const permissionState = this.stateCalculator.calculate(gateResult, conflicts);
    
    // Step 3: Determine uncertainty level based on confidence and data quality
    const uncertaintyLevel = this.assessUncertainty(gateResult, conflicts);
    
    // Step 4: Generate human-readable explanation
    const explanation = this.explanationGenerator.generate(
      gateResult,
      permissionState,
      conflicts
    );

    // Step 5: Build and return complete assessment
    return {
      id: uuidv4(),
      asset: asset.toUpperCase(),
      permissionState,
      gateEvaluations: {
        regime: gateResult.regime,
        flow: gateResult.flow,
        risk: gateResult.risk,
        context: gateResult.context,
      },
      conflicts,
      uncertaintyLevel,
      explanation,
      assessedAt,
      validUntil: new Date(assessedAt.getTime() + TIMING.PERMISSION_VALIDITY_MS),
    };
  }

  /**
   * Assess overall uncertainty level
   * 
   * Per Phase 3 §2.3:
   * - LOW: All gates HIGH confidence
   * - MODERATE: Mixed confidence
   * - HIGH: Any LOW confidence
   * - CRITICAL: Data quality issues
   */
  private assessUncertainty(
    gateResult: GateEvaluationResult,
    conflicts: LayerConflict[]
  ): UncertaintyLevel {
    const gates = [
      gateResult.regime, 
      gateResult.flow, 
      gateResult.risk, 
      gateResult.context
    ];
    
    // Check for stale data (CRITICAL)
    const hasStaleData = gates.some(g => g.dataFreshness === 'STALE');
    if (hasStaleData) {
      return 'CRITICAL';
    }
    
    // Check for unknown data freshness (CRITICAL)
    const hasUnknownFreshness = gates.filter(g => g.dataFreshness === 'UNKNOWN').length >= 2;
    if (hasUnknownFreshness) {
      return 'CRITICAL';
    }
    
    // Count low confidence gates
    const lowConfidenceCount = gates.filter(g => g.confidence === 'LOW').length;
    if (lowConfidenceCount >= 2) {
      return 'HIGH';
    }
    if (lowConfidenceCount === 1) {
      return 'MODERATE';
    }
    
    // Check for high severity conflicts
    const hasHighSeverityConflict = conflicts.some(c => c.severity === 'HIGH');
    if (hasHighSeverityConflict) {
      return 'HIGH';
    }
    
    // Any medium severity conflicts
    const hasMediumConflict = conflicts.some(c => c.severity === 'MEDIUM');
    if (hasMediumConflict) {
      return 'MODERATE';
    }
    
    // Any conflicts at all
    if (conflicts.length > 0) {
      return 'MODERATE';
    }
    
    // Count medium confidence gates
    const mediumConfidenceCount = gates.filter(g => g.confidence === 'MEDIUM').length;
    if (mediumConfidenceCount >= 2) {
      return 'MODERATE';
    }
    
    // All gates high confidence, no conflicts
    return 'LOW';
  }

  /**
   * Quick check for specific permission state
   */
  isTradeAllowed(assessment: PermissionAssessment): boolean {
    return assessment.permissionState === PermissionState.TRADE_ALLOWED ||
           assessment.permissionState === PermissionState.TRADE_ALLOWED_REDUCED_RISK;
  }

  /**
   * Check if any trading is permitted (including scalp)
   */
  isAnyTradingPermitted(assessment: PermissionAssessment): boolean {
    return assessment.permissionState !== PermissionState.NO_TRADE &&
           assessment.permissionState !== PermissionState.WAIT;
  }

  /**
   * Check if it's a blocking state
   */
  isBlocking(assessment: PermissionAssessment): boolean {
    return assessment.permissionState === PermissionState.NO_TRADE;
  }
}

// src/types/permission.types.ts
// Type definitions for permission state engine

import { 
  RegimeGateEvaluation, 
  FlowGateEvaluation, 
  RiskGateEvaluation, 
  ContextGateEvaluation,
  ConfidenceLevel 
} from './gates.types';

export enum PermissionState {
  TRADE_ALLOWED = 'TRADE_ALLOWED',
  TRADE_ALLOWED_REDUCED_RISK = 'TRADE_ALLOWED_REDUCED_RISK',
  SCALP_ONLY = 'SCALP_ONLY',
  WAIT = 'WAIT',
  NO_TRADE = 'NO_TRADE'
}

export type UncertaintyLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface LayerConflict {
  conflictType: string;
  layerA: { 
    name: string; 
    signal: string; 
    confidence: ConfidenceLevel;
  };
  layerB: { 
    name: string; 
    signal: string; 
    confidence: ConfidenceLevel;
  };
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  detectedAt: Date;
}

export interface PermissionExplanation {
  currentObservation: string;
  alignmentAssessment: string;
  conflictAssessment: string;
  riskFactors: string[];
  cautionPoints: string[];
}

export interface PermissionAssessment {
  id: string;
  asset: string;
  permissionState: PermissionState;
  gateEvaluations: {
    regime: RegimeGateEvaluation;
    flow: FlowGateEvaluation;
    risk: RiskGateEvaluation;
    context: ContextGateEvaluation;
  };
  conflicts: LayerConflict[];
  uncertaintyLevel: UncertaintyLevel;
  explanation: PermissionExplanation;
  assessedAt: Date;
  validUntil: Date;
}

export interface PermissionStateChange {
  asset: string;
  previousState: PermissionState;
  currentState: PermissionState;
  trigger: string;
  changedAt: Date;
}

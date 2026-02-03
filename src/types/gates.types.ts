// src/types/gates.types.ts
// Type definitions for gate evaluation system

export enum GateStatus {
  PASS = 'PASS',
  WEAK_PASS = 'WEAK_PASS',
  FAIL = 'FAIL'
}

export enum ConfidenceLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export enum DataFreshness {
  CURRENT = 'CURRENT',
  STALE = 'STALE',
  UNKNOWN = 'UNKNOWN'
}

export interface GateEvidence {
  observation: string;
  source: string;
  timestamp: Date;
}

export interface BaseGateEvaluation {
  gateName: 'REGIME' | 'FLOW' | 'RISK' | 'CONTEXT';
  status: GateStatus;
  confidence: ConfidenceLevel;
  supportingEvidence: GateEvidence[];
  conflictingEvidence: GateEvidence[];
  dataFreshness: DataFreshness;
  humanNote: string;
  evaluatedAt: Date;
}

export interface RegimeGateEvaluation extends BaseGateEvaluation {
  gateName: 'REGIME';
  volStance: 'LONG_VOL' | 'SHORT_VOL' | 'UNCLEAR';
  comfortRange: { lower: number; upper: number } | null;
  pricePosition: 'INSIDE_COMFORT' | 'AT_BOUNDARY' | 'IN_STRESS' | 'UNKNOWN';
  keyExpiries: Array<{
    date: Date;
    bias: string;
    notional: string;
  }>;
}

export interface FlowGateEvaluation extends BaseGateEvaluation {
  gateName: 'FLOW';
  flowDirection: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' | 'UNCLEAR';
  flowQuality: 'WHALE_DRIVEN' | 'MIXED' | 'RETAIL_DRIVEN';
  cvdWhale: {
    h24: { direction: 'POSITIVE' | 'NEGATIVE' | 'FLAT'; magnitude: string };
    d7: { direction: 'POSITIVE' | 'NEGATIVE' | 'FLAT'; magnitude: string };
    alignment: 'CONSISTENT' | 'DIVERGING';
  };
  whaleVwapPosition: {
    priceVsVwap: 'ABOVE' | 'BELOW' | 'AT';
    bandPosition: 'LOWER_BAND' | 'MID_RANGE' | 'UPPER_BAND';
  };
}

export interface RiskGateEvaluation extends BaseGateEvaluation {
  gateName: 'RISK';
  oiTrend: 'EXPANDING' | 'STABLE' | 'CONTRACTING';
  fundingBias: 'LONG_CROWDED' | 'SHORT_CROWDED' | 'BALANCED';
  crowdingLevel: 'EXTREME' | 'ELEVATED' | 'NORMAL' | 'LOW';
  stressRangeStatus: 'OUTSIDE' | 'AT_BOUNDARY' | 'INSIDE';
  liquidationContext: {
    nearestCluster: 'ABOVE' | 'BELOW';
    distance: 'DISTANT' | 'MODERATE' | 'PROXIMATE';
  };
}

export interface ContextGateEvaluation extends BaseGateEvaluation {
  gateName: 'CONTEXT';
  currentZone: 'ACCUMULATION_ZONE' | 'NEUTRAL_ZONE' | 'DISTRIBUTION_ZONE';
  priceVsWhaleVwap: 'DISCOUNT' | 'FAIR' | 'PREMIUM';
  bandPosition: 'LOWER_BAND' | 'MID_BAND' | 'UPPER_BAND';
  zoneFlowAlignment: 'ALIGNED' | 'NEUTRAL' | 'MISALIGNED';
  referenceLevel: {
    whaleVwap: number;
    lowerBand: number;
    upperBand: number;
  };
}

export type AnyGateEvaluation = 
  | RegimeGateEvaluation 
  | FlowGateEvaluation 
  | RiskGateEvaluation 
  | ContextGateEvaluation;

export interface GateEvaluationResult {
  regime: RegimeGateEvaluation;
  flow: FlowGateEvaluation;
  risk: RiskGateEvaluation;
  context: ContextGateEvaluation;
  evaluatedAt: Date;
}

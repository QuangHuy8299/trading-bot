// src/types/position.types.ts
// Type definitions for position tracking

import { PermissionState } from './permission.types';

export enum PositionState {
  NO_POSITION = 'NO_POSITION',
  OPEN = 'OPEN',
  DEGRADED = 'DEGRADED',
  VIOLATION = 'VIOLATION',
  CLOSED = 'CLOSED'
}

export type PositionSide = 'LONG' | 'SHORT';
export type ExecutionMode = 'A' | 'B' | 'C';
export type AutoProtectAction = 'CLOSE' | 'REDUCE_50';

export interface TrackedPosition {
  id: string;
  asset: string;
  state: PositionState;
  side: PositionSide;
  size: number;
  entryPrice: number;
  currentPrice: number;
  permissionStateAtEntry: PermissionState;
  currentPermissionState: PermissionState;
  autoProtectEnabled: boolean;
  autoProtectAction: AutoProtectAction | null;
  mode: ExecutionMode;
  traderId: string;
  openedAt: Date;
  lastUpdated: Date;
}

export interface PositionStateTransition {
  positionId: string;
  asset: string;
  fromState: PositionState;
  toState: PositionState;
  trigger: string;
  transitionedAt: Date;
}

export interface AutoProtectConfig {
  enabled: boolean;
  action: AutoProtectAction;
  enabledAt: Date;
  enabledBy: string;
}

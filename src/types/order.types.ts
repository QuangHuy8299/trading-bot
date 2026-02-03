// src/types/order.types.ts
// Type definitions for order preparation and execution

import { PermissionState } from './permission.types';
import { GateEvaluationResult } from './gates.types';

export enum OrderStatus {
  PREPARED = 'PREPARED',
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',
  CONFIRMED = 'CONFIRMED',
  EXECUTING = 'EXECUTING',
  FILLED = 'FILLED',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  SUPERSEDED = 'SUPERSEDED'
}

export type OrderAction = 'REDUCE' | 'CLOSE';
export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT';

export interface PreparedOrder {
  id: string;
  asset: string;
  action: OrderAction;
  side: OrderSide;
  size: number;
  sizePercent: number;
  traderReason: string;
  status: OrderStatus;
  permissionStateAtPreparation: PermissionState;
  gateSnapshotAtPreparation: GateEvaluationResult;
  preparedAt: Date;
  expiresAt: Date;
  confirmedAt: Date | null;
  executedAt: Date | null;
  executionResult: ExecutionResult | null;
  traderId: string;
}

export interface ExecutionResult {
  success: boolean;
  exchangeOrderId: string | null;
  fillPrice: number | null;
  fillSize: number | null;
  status: 'FILLED' | 'PARTIAL' | 'FAILED';
  failureReason: string | null;
  executedAt: Date;
}

export interface OrderPreparationRequest {
  asset: string;
  action: OrderAction;
  sizePercent: number;
  reason: string;
  traderId: string;
}

export interface OrderConfirmation {
  orderId: string;
  traderId: string;
  confirmedAt: Date;
}

export interface BinanceOrderPayload {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
}

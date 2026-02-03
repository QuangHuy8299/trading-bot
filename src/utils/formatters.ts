// src/utils/formatters.ts
// Data formatting utilities

import { GateStatus, ConfidenceLevel } from '../types/gates.types';
import { PermissionState } from '../types/permission.types';
import { OrderStatus } from '../types/order.types';
import { PositionState } from '../types/position.types';

/**
 * Format permission state with emoji
 */
export function formatPermissionState(state: PermissionState): string {
  const icons: Record<PermissionState, string> = {
    [PermissionState.TRADE_ALLOWED]: '🟢',
    [PermissionState.TRADE_ALLOWED_REDUCED_RISK]: '🟡',
    [PermissionState.SCALP_ONLY]: '🟠',
    [PermissionState.WAIT]: '⏸️',
    [PermissionState.NO_TRADE]: '🔴',
  };
  return `${icons[state]} ${state}`;
}

/**
 * Format gate status with emoji
 */
export function formatGateStatus(status: GateStatus): string {
  const icons: Record<GateStatus, string> = {
    [GateStatus.PASS]: '✅',
    [GateStatus.WEAK_PASS]: '⚠️',
    [GateStatus.FAIL]: '❌',
  };
  return `${icons[status]} ${status}`;
}

/**
 * Format confidence level
 */
export function formatConfidence(level: ConfidenceLevel): string {
  const icons: Record<ConfidenceLevel, string> = {
    [ConfidenceLevel.HIGH]: '🔷',
    [ConfidenceLevel.MEDIUM]: '🔶',
    [ConfidenceLevel.LOW]: '🔸',
  };
  return `${icons[level]} ${level}`;
}

/**
 * Format order status
 */
export function formatOrderStatus(status: OrderStatus): string {
  const icons: Record<OrderStatus, string> = {
    [OrderStatus.PREPARED]: '📝',
    [OrderStatus.AWAITING_CONFIRMATION]: '⏳',
    [OrderStatus.CONFIRMED]: '✅',
    [OrderStatus.EXECUTING]: '⚡',
    [OrderStatus.FILLED]: '✅',
    [OrderStatus.PARTIALLY_FILLED]: '⚠️',
    [OrderStatus.FAILED]: '❌',
    [OrderStatus.CANCELLED]: '🚫',
    [OrderStatus.EXPIRED]: '⏰',
    [OrderStatus.SUPERSEDED]: '🔄',
  };
  return `${icons[status]} ${status}`;
}

/**
 * Format position state
 */
export function formatPositionState(state: PositionState): string {
  const icons: Record<PositionState, string> = {
    [PositionState.NO_POSITION]: '⬜',
    [PositionState.OPEN]: '🟢',
    [PositionState.DEGRADED]: '🟡',
    [PositionState.VIOLATION]: '🔴',
    [PositionState.CLOSED]: '⬛',
  };
  return `${icons[state]} ${state}`;
}

/**
 * Format number as currency
 */
export function formatCurrency(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format number with commas
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19) + 'Z';
}

/**
 * Format duration in human readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 60000) {
    return `${Math.round(ms / 1000)}s`;
  }
  if (ms < 3600000) {
    return `${Math.round(ms / 60000)}m`;
  }
  return `${Math.round(ms / 3600000)}h`;
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Format order ID for display (first 8 characters)
 */
export function formatOrderId(id: string): string {
  return id.slice(0, 8);
}

/**
 * Escape HTML for Telegram messages
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

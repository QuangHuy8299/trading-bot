export type TradeDirection = 'LONG' | 'SHORT' | 'NEUTRAL';

export interface RiskConfig {
  accountBalance: number;
  riskPerTradePercent: number; // e.g., 1% = 0.01
  rewardRatio: number; // e.g., 2.0 (R:R 1:2)
  maxLeverage: number;
  defaultStopLossPercent: number; // Fallback nếu không có Stress Range
}

export interface TradeSuggestion {
  id: string;
  asset: string;
  timestamp: Date;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSizeUsd: number; // Kích thước vị thế tính theo USD
  leverage: number;
  confidenceScore: number; // 0 - 100
  riskRewardRatio: number;
  reasons: string[];
}

export interface MarketProvider {
  getWhaleData(asset: string): Promise<any>;
  getOptionData(asset: string): Promise<any>;
  getPrice(asset: string): Promise<number>;
  getADV30(asset: string): Promise<number>; // Average Daily Volume 30 days
}

// src/core/data-collector/types.ts
// Data collector specific types

export interface MarketData {
  asset: string;
  price: number;
  timestamp: Date;
  binance: BinanceData;
  option: OptionData | null;
  whale: WhaleData | null;
  dataQuality: DataQualityReport;
}

export interface BinanceData {
  price: number;
  openInterest: number;
  openInterestValue: number;
  oiChange24h: number;
  fundingRate: number;
  nextFundingTime: Date;
  volume24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  highPrice24h: number;
  lowPrice24h: number;
  liquidationLevels: {
    longs: number[];
    shorts: number[];
  };
  timestamp: Date;
}

export interface OptionData {
  volStance: 'LONG_VOL' | 'SHORT_VOL' | 'UNCLEAR';
  comfortRange: { lower: number; upper: number } | null;
  stressRangeUpper: number | null;
  stressRangeLower: number | null;
  keyExpiries: Array<{
    date: Date;
    bias: string;
    notional: string;
    maxPain: number;
  }>;
  termStructure: 'CONTANGO' | 'BACKWARDATION' | 'FLAT' | 'UNCLEAR';
  impliedVolatility: number;
  putCallRatio: number;
  timestamp: Date;
}

export interface WhaleData {
  cvdWhale24h: number;
  cvdWhale7d: number;
  cvdTotal24h: number;
  cvdVolumeRatio: number;
  whaleVwap: number;
  vwapBands: { 
    lower: number; 
    upper: number;
    bandWidth: number;
  };
  bubbleSignals: Array<{ 
    price: number; 
    type: 'BUY' | 'SELL'; 
    size: string;
    timestamp: Date;
  }>;
  netWhaleFlow24h: number;
  netWhaleFlow7d: number;
  timestamp: Date;
}

export interface DataQualityReport {
  overall: 'GOOD' | 'DEGRADED' | 'CRITICAL';
  binance: { 
    fresh: boolean; 
    lastUpdate: Date;
    latencyMs: number;
  };
  option: { 
    fresh: boolean; 
    lastUpdate: Date | null; 
    available: boolean;
    source: string;
  };
  whale: { 
    fresh: boolean; 
    lastUpdate: Date | null; 
    available: boolean;
    source: string;
  };
  issues: string[];
}

export interface DataCollectorConfig {
  assets: string[];
  refreshIntervalMs: number;
  stalenessThresholdMs: number;
  enableOptionData: boolean;
  enableWhaleData: boolean;
}

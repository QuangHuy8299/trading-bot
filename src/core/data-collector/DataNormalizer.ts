// src/core/data-collector/DataNormalizer.ts
import { OptionData, WhaleData, BinanceData, MarketData } from './types';

export class DataNormalizer {
  /**
   * Main normalization method: Aggregates all data sources into a single MarketData object
   */
  normalize(
    asset: string,
    binanceData: BinanceData,
    whaleData: WhaleData | null,
    optionData: OptionData | null
  ): MarketData {
    // 1. Normalize sub-components
    // FIX: Sử dụng null thay vì undefined để khớp với interface MarketData
    const normalizedWhale = whaleData ? this.normalizeWhaleData(whaleData) : null;
    const normalizedOption = optionData ? this.normalizeOptionData(optionData) : null;

    // 2. Calculate Data Quality Score (0 - 100)
    const qualityScore = this.calculateDataQuality(binanceData, normalizedWhale, normalizedOption);

    // 3. Construct Final MarketData Object
    return {
      asset,
      price: binanceData.price,

      // Source Data
      binance: binanceData,
      whale: normalizedWhale,
      option: normalizedOption,

      // Metadata
      timestamp: new Date(),
      dataQuality: {
        overall: qualityScore,
        details: {
          hasPrice: true,
          hasVolume: true,
          hasWhaleData: !!normalizedWhale,
          hasOptionData: !!normalizedOption,
        },
      },
    };
  }

  private calculateDataQuality(
    binance: BinanceData,
    whale?: WhaleData | null,
    option?: OptionData | null
  ): number {
    let score = 50; // Base score for having Binance data
    if (whale) score += 30;
    if (option) score += 20;
    return score;
  }

  /**
   * Normalize option data to standard format
   */
  normalizeOptionData(data: any): OptionData {
    return {
      volStance: this.normalizeVolStance(data.volStance),
      comfortRange: this.normalizeRange(data.comfortRange),
      stressRangeUpper: data.stressRangeUpper ?? null,
      stressRangeLower: data.stressRangeLower ?? null,
      keyExpiries: this.normalizeExpiries(data.keyExpiries ?? []),
      termStructure: this.normalizeTermStructure(data.termStructure),
      impliedVolatility: this.normalizeNumber(data.impliedVolatility, 0),
      putCallRatio: this.normalizeNumber(data.putCallRatio, 1),
      timestamp: this.normalizeTimestamp(data.timestamp),
    };
  }

  normalizeWhaleData(data: any): WhaleData {
    return {
      cvdWhale24h: this.normalizeNumber(data.cvdWhale24h, 0),
      cvdWhale7d: this.normalizeNumber(data.cvdWhale7d, 0),
      cvdTotal24h: this.normalizeNumber(data.cvdTotal24h, 0),
      cvdVolumeRatio: this.normalizeNumber(data.cvdVolumeRatio, 0),
      whaleVwap: this.normalizeNumber(data.whaleVwap, 0),
      vwapBands: this.normalizeVwapBands(data.vwapBands),
      bubbleSignals: this.normalizeBubbles(data.bubbleSignals ?? []),
      netWhaleFlow24h: this.normalizeNumber(data.netWhaleFlow24h, 0),
      netWhaleFlow7d: this.normalizeNumber(data.netWhaleFlow7d, 0),
      timestamp: this.normalizeTimestamp(data.timestamp),
    };
  }

  // --- Helper Methods (Private) ---

  private normalizeVolStance(value: any): 'LONG_VOL' | 'SHORT_VOL' | 'UNCLEAR' {
    if (!value) return 'UNCLEAR';
    const normalized = String(value)
      .toUpperCase()
      .replace(/[^A-Z]/g, '');
    if (normalized.includes('LONG')) return 'LONG_VOL';
    if (normalized.includes('SHORT')) return 'SHORT_VOL';
    return 'UNCLEAR';
  }

  private normalizeRange(range: any): { lower: number; upper: number } | null {
    if (!range) return null;
    const lower = this.normalizeNumber(range.lower ?? range.low ?? range.min, null);
    const upper = this.normalizeNumber(range.upper ?? range.high ?? range.max, null);
    if (lower === null || upper === null) return null;
    if (lower >= upper) return null;
    return { lower, upper };
  }

  private normalizeTermStructure(value: any): 'CONTANGO' | 'BACKWARDATION' | 'FLAT' | 'UNCLEAR' {
    if (!value) return 'UNCLEAR';
    const normalized = String(value).toUpperCase();
    if (normalized.includes('CONTANGO')) return 'CONTANGO';
    if (normalized.includes('BACKWARDATION') || normalized.includes('BACKWARD'))
      return 'BACKWARDATION';
    if (normalized.includes('FLAT')) return 'FLAT';
    return 'UNCLEAR';
  }

  private normalizeExpiries(expiries: any[]): OptionData['keyExpiries'] {
    if (!Array.isArray(expiries)) return [];
    return expiries
      .filter((e) => e && e.date)
      .map((e) => ({
        date: this.normalizeTimestamp(e.date),
        bias: this.normalizeBias(e.bias),
        notional: this.normalizeNotional(e.notional),
        maxPain: this.normalizeNumber(e.maxPain, 0),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private normalizeBias(value: any): string {
    if (!value) return 'NEUTRAL';
    return String(value).toUpperCase();
  }

  private normalizeNotional(value: any): string {
    if (!value) return 'UNKNOWN';
    if (typeof value === 'number') {
      if (value >= 1e9) return 'MASSIVE';
      if (value >= 500e6) return 'VERY_LARGE';
      if (value >= 100e6) return 'LARGE';
      if (value >= 50e6) return 'MODERATE';
      return 'SMALL';
    }
    return String(value).toUpperCase();
  }

  private normalizeVwapBands(bands: any): WhaleData['vwapBands'] {
    const defaultBands = { lower: 0, upper: 0, bandWidth: 0 };
    if (!bands) return defaultBands;
    return {
      lower: this.normalizeNumber(bands.lower, 0),
      upper: this.normalizeNumber(bands.upper, 0),
      bandWidth: this.normalizeNumber(bands.bandWidth, 0),
    };
  }

  private normalizeBubbles(bubbles: any[]): WhaleData['bubbleSignals'] {
    if (!Array.isArray(bubbles)) return [];
    return bubbles
      .filter((b) => b && b.price)
      .map((b) => ({
        price: this.normalizeNumber(b.price, 0),
        type: this.normalizeBubbleType(b.type ?? b.side),
        size: this.normalizeSize(b.size),
        timestamp: this.normalizeTimestamp(b.timestamp),
      }));
  }

  private normalizeBubbleType(value: any): 'BUY' | 'SELL' {
    if (!value) return 'BUY';
    const normalized = String(value).toUpperCase();
    if (normalized.includes('SELL') || normalized.includes('ASK')) return 'SELL';
    return 'BUY';
  }

  private normalizeSize(value: any): string {
    if (!value) return 'UNKNOWN';
    if (typeof value === 'number') {
      if (value >= 10e6) return 'WHALE';
      if (value >= 1e6) return 'LARGE';
      if (value >= 100e3) return 'MEDIUM';
      return 'SMALL';
    }
    return String(value).toUpperCase();
  }

  private normalizeNumber(value: any, defaultValue: number): number;
  private normalizeNumber(value: any, defaultValue: null): number | null;
  private normalizeNumber(value: any, defaultValue: number | null): number | null {
    if (value === null || value === undefined) return defaultValue;
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num) || !isFinite(num)) return defaultValue;
    return num;
  }

  private normalizeTimestamp(value: any): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date() : date;
  }
}

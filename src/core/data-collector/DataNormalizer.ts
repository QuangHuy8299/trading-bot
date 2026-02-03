// src/core/data-collector/DataNormalizer.ts
// Data normalization and standardization utilities

import { OptionData, WhaleData } from './types';

/**
 * DataNormalizer standardizes data from various sources
 * into consistent formats for gate evaluation
 */
export class DataNormalizer {
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

  /**
   * Normalize whale data to standard format
   */
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

  /**
   * Normalize vol stance to enum value
   */
  private normalizeVolStance(value: any): 'LONG_VOL' | 'SHORT_VOL' | 'UNCLEAR' {
    if (!value) return 'UNCLEAR';
    
    const normalized = String(value).toUpperCase().replace(/[^A-Z]/g, '');
    
    if (normalized.includes('LONG')) return 'LONG_VOL';
    if (normalized.includes('SHORT')) return 'SHORT_VOL';
    
    return 'UNCLEAR';
  }

  /**
   * Normalize price range
   */
  private normalizeRange(range: any): { lower: number; upper: number } | null {
    if (!range) return null;
    
    const lower = this.normalizeNumber(range.lower ?? range.low ?? range.min, null);
    const upper = this.normalizeNumber(range.upper ?? range.high ?? range.max, null);
    
    if (lower === null || upper === null) return null;
    if (lower >= upper) return null;
    
    return { lower, upper };
  }

  /**
   * Normalize term structure
   */
  private normalizeTermStructure(value: any): 'CONTANGO' | 'BACKWARDATION' | 'FLAT' | 'UNCLEAR' {
    if (!value) return 'UNCLEAR';
    
    const normalized = String(value).toUpperCase();
    
    if (normalized.includes('CONTANGO')) return 'CONTANGO';
    if (normalized.includes('BACKWARDATION') || normalized.includes('BACKWARD')) return 'BACKWARDATION';
    if (normalized.includes('FLAT')) return 'FLAT';
    
    return 'UNCLEAR';
  }

  /**
   * Normalize expiry data
   */
  private normalizeExpiries(expiries: any[]): OptionData['keyExpiries'] {
    if (!Array.isArray(expiries)) return [];
    
    return expiries
      .filter(e => e && e.date)
      .map(e => ({
        date: this.normalizeTimestamp(e.date),
        bias: this.normalizeBias(e.bias),
        notional: this.normalizeNotional(e.notional),
        maxPain: this.normalizeNumber(e.maxPain, 0),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Normalize bias string
   */
  private normalizeBias(value: any): string {
    if (!value) return 'NEUTRAL';
    return String(value).toUpperCase();
  }

  /**
   * Normalize notional to category
   */
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

  /**
   * Normalize VWAP bands
   */
  private normalizeVwapBands(bands: any): WhaleData['vwapBands'] {
    const defaultBands = { lower: 0, upper: 0, bandWidth: 0 };
    
    if (!bands) return defaultBands;
    
    return {
      lower: this.normalizeNumber(bands.lower, 0),
      upper: this.normalizeNumber(bands.upper, 0),
      bandWidth: this.normalizeNumber(bands.bandWidth, 0),
    };
  }

  /**
   * Normalize bubble signals
   */
  private normalizeBubbles(bubbles: any[]): WhaleData['bubbleSignals'] {
    if (!Array.isArray(bubbles)) return [];
    
    return bubbles
      .filter(b => b && b.price)
      .map(b => ({
        price: this.normalizeNumber(b.price, 0),
        type: this.normalizeBubbleType(b.type ?? b.side),
        size: this.normalizeSize(b.size),
        timestamp: this.normalizeTimestamp(b.timestamp),
      }));
  }

  /**
   * Normalize bubble type
   */
  private normalizeBubbleType(value: any): 'BUY' | 'SELL' {
    if (!value) return 'BUY';
    
    const normalized = String(value).toUpperCase();
    
    if (normalized.includes('SELL') || normalized.includes('ASK')) return 'SELL';
    return 'BUY';
  }

  /**
   * Normalize size label
   */
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

  /**
   * Normalize number value
   */
  private normalizeNumber(value: any, defaultValue: number): number;
  private normalizeNumber(value: any, defaultValue: null): number | null;
  private normalizeNumber(value: any, defaultValue: number | null): number | null {
    if (value === null || value === undefined) return defaultValue;
    
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    
    if (isNaN(num) || !isFinite(num)) return defaultValue;
    
    return num;
  }

  /**
   * Normalize timestamp to Date
   */
  private normalizeTimestamp(value: any): Date {
    if (!value) return new Date();
    
    if (value instanceof Date) return value;
    
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date() : date;
  }

  /**
   * Calculate flow direction from CVD
   */
  calculateFlowDirection(cvd24h: number, cvd7d: number): 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' | 'UNCLEAR' {
    const threshold = 0.1; // 10% of typical daily flow
    
    // Both positive = accumulation
    if (cvd24h > 0 && cvd7d > 0) {
      return 'ACCUMULATION';
    }
    
    // Both negative = distribution
    if (cvd24h < 0 && cvd7d < 0) {
      return 'DISTRIBUTION';
    }
    
    // Conflicting signals
    if ((cvd24h > 0 && cvd7d < 0) || (cvd24h < 0 && cvd7d > 0)) {
      // If magnitudes are similar, it's unclear
      const ratio = Math.abs(cvd24h / cvd7d);
      if (ratio > 0.5 && ratio < 2) {
        return 'UNCLEAR';
      }
      // Otherwise, follow the 7D trend
      return cvd7d > 0 ? 'ACCUMULATION' : 'DISTRIBUTION';
    }
    
    return 'NEUTRAL';
  }

  /**
   * Determine price position relative to comfort range
   */
  determinePricePosition(
    price: number,
    comfortRange: { lower: number; upper: number } | null
  ): 'INSIDE_COMFORT' | 'AT_BOUNDARY' | 'IN_STRESS' | 'UNKNOWN' {
    if (!comfortRange) return 'UNKNOWN';
    
    const { lower, upper } = comfortRange;
    const rangeWidth = upper - lower;
    const boundaryThreshold = rangeWidth * 0.1; // 10% of range
    
    if (price < lower || price > upper) {
      return 'IN_STRESS';
    }
    
    if (price < lower + boundaryThreshold || price > upper - boundaryThreshold) {
      return 'AT_BOUNDARY';
    }
    
    return 'INSIDE_COMFORT';
  }
}

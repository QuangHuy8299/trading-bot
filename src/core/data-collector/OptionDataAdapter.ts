// src/core/data-collector/OptionDataAdapter.ts
// Adapter for option data from external sources

import { OptionData } from './types';
import { env } from '../../config/environment';
import { log } from '../../utils/logger';
import { DataQualityError } from '../../utils/errors';

/**
 * OptionDataAdapter fetches option market data from external sources
 * 
 * This is a placeholder implementation. In production, this would connect to:
 * - Deribit API for crypto options
 * - Laevitas or similar for aggregated data
 * - Custom data provider
 */
export class OptionDataAdapter {
  private apiUrl: string | undefined;
  private lastFetchTime: Map<string, Date> = new Map();
  private cache: Map<string, OptionData> = new Map();
  private cacheDurationMs: number = 60000; // 1 minute cache

  constructor() {
    this.apiUrl = env.OPTION_DATA_API_URL;
    
    if (!this.apiUrl) {
      log.warn('OPTION_DATA_API_URL not configured - option data will use mock data');
    }
  }

  /**
   * Get option data for an asset
   */
  async getOptionData(asset: string): Promise<OptionData> {
    const symbol = this.normalizeSymbol(asset);
    
    // Check cache
    const cached = this.cache.get(symbol);
    const lastFetch = this.lastFetchTime.get(symbol);
    
    if (cached && lastFetch && Date.now() - lastFetch.getTime() < this.cacheDurationMs) {
      return cached;
    }

    try {
      const data = this.apiUrl 
        ? await this.fetchFromApi(symbol)
        : this.generateMockData(symbol);

      this.cache.set(symbol, data);
      this.lastFetchTime.set(symbol, new Date());

      return data;
    } catch (error) {
      log.error('Failed to fetch option data', { symbol, error });
      throw new DataQualityError(`Option data unavailable for ${symbol}`);
    }
  }

  /**
   * Fetch from external API
   */
  private async fetchFromApi(symbol: string): Promise<OptionData> {
    if (!this.apiUrl) {
      throw new Error('Option API URL not configured');
    }

    const response = await fetch(`${this.apiUrl}/options/${symbol}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Option API returned ${response.status}`);
    }

    const data = await response.json();
    return this.parseApiResponse(data);
  }

  /**
   * Parse API response into OptionData format
   */
  private parseApiResponse(data: any): OptionData {
    // This would be customized based on actual API response format
    return {
      volStance: this.determineVolStance(data),
      comfortRange: this.calculateComfortRange(data),
      stressRangeUpper: data.stressRangeUpper ?? null,
      stressRangeLower: data.stressRangeLower ?? null,
      keyExpiries: this.parseExpiries(data.expiries ?? []),
      termStructure: this.determineTermStructure(data),
      impliedVolatility: data.iv ?? 0,
      putCallRatio: data.pcRatio ?? 1,
      timestamp: new Date(),
    };
  }

  /**
   * Generate mock data for development/testing
   */
  private generateMockData(symbol: string): OptionData {
    // Generate realistic mock data based on symbol
    const basePrice = symbol.includes('BTC') ? 95000 : 3500;
    const comfortWidth = basePrice * 0.1; // 10% range

    return {
      volStance: this.randomVolStance(),
      comfortRange: {
        lower: basePrice - comfortWidth / 2,
        upper: basePrice + comfortWidth / 2,
      },
      stressRangeUpper: basePrice + comfortWidth,
      stressRangeLower: basePrice - comfortWidth,
      keyExpiries: this.generateMockExpiries(basePrice),
      termStructure: 'CONTANGO',
      impliedVolatility: 0.45 + Math.random() * 0.3,
      putCallRatio: 0.8 + Math.random() * 0.4,
      timestamp: new Date(),
    };
  }

  /**
   * Determine vol stance from data
   */
  private determineVolStance(data: any): 'LONG_VOL' | 'SHORT_VOL' | 'UNCLEAR' {
    // Logic to determine if Big Players are positioned for volatility
    // This would analyze term structure, skew, and positioning
    
    if (data.volStance) {
      return data.volStance;
    }

    // Default analysis logic
    const ivPercentile = data.ivPercentile ?? 50;
    const skew = data.skew ?? 0;

    if (ivPercentile > 70 && skew > 0.1) {
      return 'LONG_VOL';
    } else if (ivPercentile < 30 && skew < -0.1) {
      return 'SHORT_VOL';
    }

    return 'UNCLEAR';
  }

  /**
   * Calculate comfort range from option data
   */
  private calculateComfortRange(data: any): { lower: number; upper: number } | null {
    // Comfort range is where Big Player option PnL is maximized
    // Typically derived from max pain, gamma exposure, etc.

    if (data.comfortRange) {
      return data.comfortRange;
    }

    const maxPain = data.maxPain;
    const gammaFlip = data.gammaFlip;

    if (maxPain && gammaFlip) {
      const center = (maxPain + gammaFlip) / 2;
      const width = Math.abs(maxPain - gammaFlip) * 1.5;
      
      return {
        lower: center - width / 2,
        upper: center + width / 2,
      };
    }

    return null;
  }

  /**
   * Determine term structure
   */
  private determineTermStructure(data: any): 'CONTANGO' | 'BACKWARDATION' | 'FLAT' | 'UNCLEAR' {
    if (data.termStructure) {
      return data.termStructure;
    }

    const frontIV = data.frontIV ?? 0;
    const backIV = data.backIV ?? 0;

    if (frontIV === 0 || backIV === 0) {
      return 'UNCLEAR';
    }

    const ratio = frontIV / backIV;

    if (ratio > 1.05) {
      return 'BACKWARDATION';
    } else if (ratio < 0.95) {
      return 'CONTANGO';
    }

    return 'FLAT';
  }

  /**
   * Parse expiry data
   */
  private parseExpiries(expiries: any[]): OptionData['keyExpiries'] {
    return expiries.map(exp => ({
      date: new Date(exp.date),
      bias: exp.bias ?? 'NEUTRAL',
      notional: exp.notional ?? 'UNKNOWN',
      maxPain: exp.maxPain ?? 0,
    }));
  }

  /**
   * Generate mock expiries
   */
  private generateMockExpiries(basePrice: number): OptionData['keyExpiries'] {
    const now = new Date();
    
    return [
      {
        date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week
        bias: 'NEUTRAL',
        notional: 'MODERATE',
        maxPain: basePrice * (0.98 + Math.random() * 0.04),
      },
      {
        date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 1 month
        bias: 'NEUTRAL',
        notional: 'LARGE',
        maxPain: basePrice * (0.95 + Math.random() * 0.1),
      },
    ];
  }

  /**
   * Random vol stance for mock data
   */
  private randomVolStance(): 'LONG_VOL' | 'SHORT_VOL' | 'UNCLEAR' {
    const rand = Math.random();
    if (rand < 0.33) return 'LONG_VOL';
    if (rand < 0.66) return 'SHORT_VOL';
    return 'UNCLEAR';
  }

  /**
   * Normalize symbol format
   */
  private normalizeSymbol(asset: string): string {
    // Convert BTCUSDT to BTC, etc.
    return asset.replace(/USDT$|USD$|BUSD$/, '').toUpperCase();
  }

  /**
   * Check if adapter is configured
   */
  isConfigured(): boolean {
    return !!this.apiUrl;
  }
}

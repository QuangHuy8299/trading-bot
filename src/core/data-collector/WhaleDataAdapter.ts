// src/core/data-collector/WhaleDataAdapter.ts
// Adapter for whale/smart money data from external sources

import { WhaleData } from './types';
import { env } from '../../config/environment';
import { log } from '../../utils/logger';
import { DataQualityError } from '../../utils/errors';

/**
 * WhaleDataAdapter fetches whale activity data from external sources
 * 
 * This is a placeholder implementation. In production, this would connect to:
 * - On-chain analytics providers (Glassnode, Nansen, etc.)
 * - CEX whale tracking services
 * - Custom data aggregators
 */
export class WhaleDataAdapter {
  private apiUrl: string | undefined;
  private lastFetchTime: Map<string, Date> = new Map();
  private cache: Map<string, WhaleData> = new Map();
  private cacheDurationMs: number = 30000; // 30 second cache

  constructor() {
    this.apiUrl = env.WHALE_DATA_API_URL;
    
    if (!this.apiUrl) {
      log.warn('WHALE_DATA_API_URL not configured - whale data will use mock data');
    }
  }

  /**
   * Get whale data for an asset
   */
  async getWhaleData(asset: string): Promise<WhaleData> {
    const symbol = asset.toUpperCase();
    
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
      log.error('Failed to fetch whale data', { symbol, error });
      throw new DataQualityError(`Whale data unavailable for ${symbol}`);
    }
  }

  /**
   * Fetch from external API
   */
  private async fetchFromApi(symbol: string): Promise<WhaleData> {
    if (!this.apiUrl) {
      throw new Error('Whale API URL not configured');
    }

    const response = await fetch(`${this.apiUrl}/whale/${symbol}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Whale API returned ${response.status}`);
    }

    const data = await response.json();
    return this.parseApiResponse(data, symbol);
  }

  /**
   * Parse API response into WhaleData format
   */
  private parseApiResponse(data: any, symbol: string): WhaleData {
    const basePrice = data.price ?? 0;

    return {
      cvdWhale24h: data.cvdWhale24h ?? 0,
      cvdWhale7d: data.cvdWhale7d ?? 0,
      cvdTotal24h: data.cvdTotal24h ?? 0,
      cvdVolumeRatio: this.calculateCvdVolumeRatio(data),
      whaleVwap: data.whaleVwap ?? basePrice,
      vwapBands: this.calculateVwapBands(data.whaleVwap ?? basePrice, data),
      bubbleSignals: this.parseBubbleSignals(data.bubbles ?? []),
      netWhaleFlow24h: data.netFlow24h ?? 0,
      netWhaleFlow7d: data.netFlow7d ?? 0,
      timestamp: new Date(),
    };
  }

  /**
   * Generate mock data for development/testing
   */
  private generateMockData(symbol: string): WhaleData {
    const basePrice = symbol.includes('BTC') ? 95000 : 3500;
    
    // Generate somewhat realistic mock values
    const cvdWhale24h = (Math.random() - 0.5) * 1000000; // +/- 1M USD
    const cvdWhale7d = cvdWhale24h * (2 + Math.random() * 3); // 7d is typically larger
    const cvdTotal24h = cvdWhale24h * (3 + Math.random() * 5); // Total includes retail
    
    // CVD/Volume ratio: >0.3-0.4 = Whale-driven, <0.1 = Retail-driven
    const cvdVolumeRatio = 0.1 + Math.random() * 0.5;
    
    // VWAP with bands
    const whaleVwap = basePrice * (0.99 + Math.random() * 0.02);
    const bandWidth = basePrice * 0.02; // 2% bands

    return {
      cvdWhale24h,
      cvdWhale7d,
      cvdTotal24h,
      cvdVolumeRatio,
      whaleVwap,
      vwapBands: {
        lower: whaleVwap - bandWidth,
        upper: whaleVwap + bandWidth,
        bandWidth,
      },
      bubbleSignals: this.generateMockBubbles(basePrice),
      netWhaleFlow24h: cvdWhale24h * 0.8,
      netWhaleFlow7d: cvdWhale7d * 0.7,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate CVD/Volume ratio
   * Per Phase 2: >0.3-0.4 = Whale-driven, <0.1 = Retail-driven
   */
  private calculateCvdVolumeRatio(data: any): number {
    const cvdWhale = Math.abs(data.cvdWhale24h ?? 0);
    const totalVolume = data.totalVolume24h ?? 1;
    
    if (totalVolume === 0) return 0;
    
    return cvdWhale / totalVolume;
  }

  /**
   * Calculate VWAP bands
   */
  private calculateVwapBands(vwap: number, data: any): WhaleData['vwapBands'] {
    // Default to 2% bands if not provided
    const bandPercent = data.bandPercent ?? 0.02;
    const bandWidth = vwap * bandPercent;

    return {
      lower: data.vwapLower ?? vwap - bandWidth,
      upper: data.vwapUpper ?? vwap + bandWidth,
      bandWidth,
    };
  }

  /**
   * Parse bubble signals
   */
  private parseBubbleSignals(bubbles: any[]): WhaleData['bubbleSignals'] {
    return bubbles.map(b => ({
      price: b.price ?? 0,
      type: b.side === 'buy' ? 'BUY' as const : 'SELL' as const,
      size: this.categorizeSize(b.size ?? 0),
      timestamp: new Date(b.timestamp ?? Date.now()),
    }));
  }

  /**
   * Generate mock bubble signals
   */
  private generateMockBubbles(basePrice: number): WhaleData['bubbleSignals'] {
    const bubbles: WhaleData['bubbleSignals'] = [];
    const numBubbles = Math.floor(Math.random() * 5);

    for (let i = 0; i < numBubbles; i++) {
      bubbles.push({
        price: basePrice * (0.98 + Math.random() * 0.04),
        type: Math.random() > 0.5 ? 'BUY' : 'SELL',
        size: this.randomSize(),
        timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      });
    }

    return bubbles.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Categorize size into labels
   */
  private categorizeSize(sizeUsd: number): string {
    if (sizeUsd >= 10000000) return 'WHALE';
    if (sizeUsd >= 1000000) return 'LARGE';
    if (sizeUsd >= 100000) return 'MEDIUM';
    return 'SMALL';
  }

  /**
   * Random size for mock data
   */
  private randomSize(): string {
    const rand = Math.random();
    if (rand < 0.1) return 'WHALE';
    if (rand < 0.3) return 'LARGE';
    if (rand < 0.6) return 'MEDIUM';
    return 'SMALL';
  }

  /**
   * Check if adapter is configured
   */
  isConfigured(): boolean {
    return !!this.apiUrl;
  }

  /**
   * Get flow quality assessment
   * Per Phase 2: CVD/Volume ratio determines flow quality
   */
  assessFlowQuality(whaleData: WhaleData): 'WHALE_DRIVEN' | 'MIXED' | 'RETAIL_DRIVEN' {
    const ratio = whaleData.cvdVolumeRatio;

    if (ratio >= 0.35) {
      return 'WHALE_DRIVEN';
    } else if (ratio >= 0.15) {
      return 'MIXED';
    }
    
    return 'RETAIL_DRIVEN';
  }

  /**
   * Determine if 24H and 7D CVD are aligned
   */
  assessCvdAlignment(whaleData: WhaleData): 'CONSISTENT' | 'DIVERGING' {
    const sign24h = Math.sign(whaleData.cvdWhale24h);
    const sign7d = Math.sign(whaleData.cvdWhale7d);

    return sign24h === sign7d ? 'CONSISTENT' : 'DIVERGING';
  }
}

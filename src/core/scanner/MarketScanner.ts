// src/core/scanner/MarketScanner.ts
// Market Scanner - Scans top assets for trading opportunities

import Binance, { Binance as BinanceClient } from 'binance-api-node';
import { env } from '../../config/environment';
import { RateLimiter } from '../../infrastructure/safety/RateLimiter';
import { log } from '../../utils/logger';
import { ApiError } from '../../utils/errors';

export interface AssetScore {
  symbol: string;
  priceChangePercent: number;
  volume24h: number;
  volumeUsd: number;
  hotScore: number;
}

export class MarketScanner {
  private client: BinanceClient;
  private rateLimiter: RateLimiter;
  private isTestnet: boolean;

  // Minimum volume threshold (default $50M)
  private readonly MIN_VOLUME_USD = 50_000_000;

  constructor(rateLimiter: RateLimiter) {
    this.isTestnet = env.BINANCE_TESTNET;
    this.rateLimiter = rateLimiter;

    // Initialize Binance client
    const clientConfig: any = {
      apiKey: env.BINANCE_API_KEY,
      apiSecret: env.BINANCE_API_SECRET,
    };

    // Configure for testnet if enabled
    if (this.isTestnet) {
      clientConfig.httpBase = 'https://testnet.binancefuture.com';
      clientConfig.wsBase = 'wss://stream.binancefuture.com';
      log.info('MarketScanner initialized with TESTNET');
    } else {
      log.info('MarketScanner initialized with LIVE exchange');
    }

    this.client = Binance(clientConfig);
  }

  /**
   * Scan top assets and return the most promising ones
   * 
   * @param limit - Maximum number of assets to return (default: 5)
   * @returns Array of asset symbols sorted by hot score
   */
  async scanTopAssets(limit: number = 5): Promise<string[]> {
    await this.rateLimiter.acquire('binance-read');

    try {
      log.info(`Scanning top assets (limit: ${limit})...`);

      // Fetch 24hr ticker statistics for all USDT futures pairs
      // Use direct HTTP call since binance-api-node doesn't expose this endpoint
      const baseUrl = this.isTestnet 
        ? 'https://testnet.binancefuture.com'
        : 'https://fapi.binance.com';
      
      const response = await fetch(`${baseUrl}/fapi/v1/ticker/24hr`);
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }
      const tickers = await response.json() as any[];

      if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
        log.warn('No ticker data received from Binance');
        return [];
      }

      // Filter and score assets
      const scoredAssets = this.scoreAssets(tickers);

      // Sort by hot score (descending) and take top N
      const topAssets = scoredAssets
        .sort((a, b) => b.hotScore - a.hotScore)
        .slice(0, limit)
        .map(asset => asset.symbol);

      log.info(`Scan complete. Top ${topAssets.length} assets: ${topAssets.join(', ')}`);

      return topAssets;
    } catch (error) {
      log.error('MarketScanner scanTopAssets failed', { error });
      throw new ApiError(
        `Failed to scan top assets: ${error instanceof Error ? error.message : 'Unknown'}`,
        undefined,
        { originalError: error instanceof Error ? error.message : 'Unknown' }
      );
    }
  }

  /**
   * Score assets based on price change and volume
   * 
   * Scoring formula:
   * - Price Change Score: abs(priceChangePercent) * 0.6
   * - Volume Score: log10(volumeUsd / MIN_VOLUME_USD) * 0.4
   * - Hot Score = Price Change Score + Volume Score
   */
  private scoreAssets(tickers: any[]): AssetScore[] {
    const scored: AssetScore[] = [];

    for (const ticker of tickers) {
      // Only process USDT futures pairs
      if (!ticker.symbol.endsWith('USDT')) {
        continue;
      }

      const priceChangePercent = parseFloat(ticker.priceChangePercent || '0');
      const volume24h = parseFloat(ticker.volume || '0');
      const quoteVolume24h = parseFloat(ticker.quoteVolume || '0'); // Volume in USDT

      // Filter by minimum volume (quoteVolume is in USDT)
      if (quoteVolume24h < this.MIN_VOLUME_USD) {
        continue;
      }

      // Calculate hot score
      const priceChangeScore = Math.abs(priceChangePercent) * 0.6;
      
      // Volume score: logarithmic scale to prevent huge volumes from dominating
      // Normalize by MIN_VOLUME_USD and apply log10
      const volumeRatio = quoteVolume24h / this.MIN_VOLUME_USD;
      const volumeScore = Math.log10(Math.max(1, volumeRatio)) * 0.4;

      const hotScore = priceChangeScore + volumeScore;

      scored.push({
        symbol: ticker.symbol,
        priceChangePercent,
        volume24h,
        volumeUsd: quoteVolume24h,
        hotScore,
      });
    }

    log.debug(`Scored ${scored.length} assets after filtering`);

    return scored;
  }

  /**
   * Get detailed score information for debugging
   */
  async getDetailedScores(limit: number = 10): Promise<AssetScore[]> {
    await this.rateLimiter.acquire('binance-read');

    try {
      // Fetch 24hr ticker statistics
      const baseUrl = this.isTestnet 
        ? 'https://testnet.binancefuture.com'
        : 'https://fapi.binance.com';
      
      const response = await fetch(`${baseUrl}/fapi/v1/ticker/24hr`);
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }
      const tickers = await response.json() as any[];
      if (!Array.isArray(tickers)) {
        throw new Error('Invalid ticker data format from Binance');
      }
      const scored = this.scoreAssets(tickers);

      return scored
        .sort((a, b) => b.hotScore - a.hotScore)
        .slice(0, limit);
    } catch (error) {
      log.error('MarketScanner getDetailedScores failed', { error });
      throw new ApiError(
        `Failed to get detailed scores: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }
}


// src/core/data-collector/DataCollector.ts
import { EventEmitter } from 'events'; // <--- THÊM IMPORT
import { MarketData } from './types';
import { BinanceConnector } from './BinanceConnector';
import { OptionDataAdapter } from './OptionDataAdapter';
import { DataNormalizer } from './DataNormalizer';
import { RateLimiter } from '../../infrastructure/safety/RateLimiter';
import { AuditLogger } from '../../infrastructure/audit';
import { log } from '../../utils/logger';
import { DataQualityError } from '../../utils/errors';
import { BinanceWhaleProvider } from './provider/BinanceWhaleProvider';

// Thêm extends EventEmitter
export class DataCollector extends EventEmitter {
  private binanceConnector: BinanceConnector;
  private whaleProvider: BinanceWhaleProvider;
  private optionProvider: OptionDataAdapter;
  private normalizer: DataNormalizer;
  private auditLogger: AuditLogger;
  
  // Track currently active assets
  private activeAssets: Set<string> = new Set();

  constructor(rateLimiter: RateLimiter, auditLogger: AuditLogger) {
    super(); // <--- GỌI SUPER()
    this.binanceConnector = new BinanceConnector(rateLimiter);
    this.whaleProvider = new BinanceWhaleProvider();
    this.optionProvider = new OptionDataAdapter();
    this.normalizer = new DataNormalizer();
    this.auditLogger = auditLogger;
  }

  async start(assets: string[]): Promise<void> {
    log.info('Initializing Realtime Data Streams...');
    for (const asset of assets) {
      try {
        await this.whaleProvider.startStream(asset);
        this.activeAssets.add(asset);
        log.info(`Started Whale Stream for ${asset}`);
      } catch (error) {
        log.error(`Failed to start Whale Stream for ${asset}`, { error });
        // Emit error event
        this.emit('data:error', { asset, error });
      }
    }
  }

  /**
   * Update watchlist dynamically (hot swap assets)
   * 
   * This method:
   * - Stops streams for assets no longer in the list
   * - Starts streams for new assets
   * - Keeps streams for assets that remain
   */
  async updateWatchlist(newAssets: string[]): Promise<void> {
    log.info(`Updating watchlist. Current: ${Array.from(this.activeAssets).join(', ')}, New: ${newAssets.join(', ')}`);

    const newAssetsSet = new Set(newAssets);
    const assetsToRemove: string[] = [];
    const assetsToAdd: string[] = [];

    // Find assets to remove (in current but not in new)
    for (const asset of this.activeAssets) {
      if (!newAssetsSet.has(asset)) {
        assetsToRemove.push(asset);
      }
    }

    // Find assets to add (in new but not in current)
    for (const asset of newAssets) {
      if (!this.activeAssets.has(asset)) {
        assetsToAdd.push(asset);
      }
    }

    // Stop streams for removed assets
    for (const asset of assetsToRemove) {
      try {
        await this.whaleProvider.stopStream(asset);
        this.activeAssets.delete(asset);
        log.info(`Stopped stream for removed asset: ${asset}`);
      } catch (error) {
        log.error(`Failed to stop stream for ${asset}`, { error });
      }
    }

    // Start streams for new assets
    for (const asset of assetsToAdd) {
      try {
        await this.whaleProvider.startStream(asset);
        this.activeAssets.add(asset);
        log.info(`Started stream for new asset: ${asset}`);
      } catch (error) {
        log.error(`Failed to start stream for ${asset}`, { error });
        this.emit('data:error', { asset, error });
      }
    }

    if (assetsToRemove.length > 0 || assetsToAdd.length > 0) {
      log.info(`Watchlist updated. Active assets: ${Array.from(this.activeAssets).join(', ')}`);
    } else {
      log.debug('Watchlist unchanged, no updates needed');
    }
  }

  /**
   * Get currently active assets
   */
  getActiveAssets(): string[] {
    return Array.from(this.activeAssets);
  }

  /**
   * Get BinanceConnector instance (for execution layer)
   */
  getBinanceConnector(): BinanceConnector {
    return this.binanceConnector;
  }

  async collect(asset: string): Promise<MarketData> {
    const startTime = Date.now();
    log.debug(`Collecting data for ${asset}...`);

    try {
      const [binanceData, whaleData, optionData] = await Promise.allSettled([
        this.binanceConnector.getMarketData(asset),
        this.whaleProvider.getWhaleData(asset),
        this.optionProvider.getOptionData(asset),
      ]);

      const binanceResult = binanceData.status === 'fulfilled' ? binanceData.value : null;
      const whaleResult = whaleData.status === 'fulfilled' ? whaleData.value : null;
      const optionResult = optionData.status === 'fulfilled' ? optionData.value : null;

      if (binanceData.status === 'rejected') {
        log.error(`Binance data fetch failed for ${asset}`, { error: binanceData.reason });
        this.emit('data:error', { asset, error: binanceData.reason }); // <--- EMIT ERROR
      }

      if (!binanceResult) {
        throw new DataQualityError(`Critical: Failed to fetch Binance market data for ${asset}`);
      }

      const marketData = this.normalizer.normalize(asset, binanceResult, whaleResult, optionResult);

      this.auditLogger.logDataCollection({
        asset,
        sources: {
          binance: !!binanceResult,
          whale: !!whaleResult,
          option: !!optionResult,
        },
        dataQuality: marketData.dataQuality.overall,
        duration: Date.now() - startTime,
      });

      // Emit data updated event
      this.emit('data:updated', { asset, data: marketData }); // <--- EMIT UPDATE

      return marketData;
    } catch (error) {
      log.error(`Data collection failed for ${asset}`, { error });
      this.emit('data:error', { asset, error });
      throw error;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    const binanceHealth = await this.binanceConnector.healthCheck();
    const whaleHealth = { healthy: true };

    return {
      healthy: binanceHealth.healthy,
      details: {
        binance: binanceHealth,
        whale: whaleHealth,
        option: this.optionProvider.isConfigured() ? 'CONFIGURED' : 'MOCK_MODE',
      },
    };
  }
}

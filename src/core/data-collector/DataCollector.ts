// src/core/data-collector/DataCollector.ts
// Main data aggregator - collects from all sources

import { EventEmitter } from 'events';
import { BinanceConnector } from './BinanceConnector';
import { OptionDataAdapter } from './OptionDataAdapter';
import { WhaleDataAdapter } from './WhaleDataAdapter';
import { DataNormalizer } from './DataNormalizer';
import { MarketData, DataQualityReport, DataCollectorConfig } from './types';
import { AuditLogger } from '../../infrastructure/audit';
import { TIMING } from '../../config/constants';
import { log } from '../../utils/logger';

export class DataCollector extends EventEmitter {
  private binanceConnector: BinanceConnector;
  private optionAdapter: OptionDataAdapter;
  private whaleAdapter: WhaleDataAdapter;
  private normalizer: DataNormalizer;
  private auditLogger: AuditLogger;
  
  private dataCache: Map<string, MarketData> = new Map();
  private collectionInterval: NodeJS.Timeout | null = null;
  private config: DataCollectorConfig;
  private isRunning: boolean = false;

  constructor(
    binanceConnector: BinanceConnector,
    optionAdapter: OptionDataAdapter,
    whaleAdapter: WhaleDataAdapter,
    auditLogger: AuditLogger,
    config?: Partial<DataCollectorConfig>
  ) {
    super();
    this.binanceConnector = binanceConnector;
    this.optionAdapter = optionAdapter;
    this.whaleAdapter = whaleAdapter;
    this.normalizer = new DataNormalizer();
    this.auditLogger = auditLogger;
    
    this.config = {
      assets: config?.assets ?? ['BTCUSDT', 'ETHUSDT'],
      refreshIntervalMs: config?.refreshIntervalMs ?? TIMING.GATE_EVALUATION_INTERVAL_MS,
      stalenessThresholdMs: config?.stalenessThresholdMs ?? TIMING.DATA_STALENESS_THRESHOLD_MS,
      enableOptionData: config?.enableOptionData ?? true,
      enableWhaleData: config?.enableWhaleData ?? true,
    };
  }

  /**
   * Start data collection for specified assets
   */
  async start(assets?: string[]): Promise<void> {
    if (this.isRunning) {
      log.warn('DataCollector already running');
      return;
    }

    const targetAssets = assets ?? this.config.assets;
    this.config.assets = targetAssets;

    log.info('Starting DataCollector', { assets: targetAssets });

    // Initial collection
    await this.collectAll(targetAssets);
    
    // Start periodic collection
    this.collectionInterval = setInterval(
      () => this.collectAll(targetAssets),
      this.config.refreshIntervalMs
    );
    
    this.isRunning = true;

    this.auditLogger.logSystemEvent({
      eventType: 'DATA_COLLECTOR_STARTED',
      details: {
        assets: targetAssets,
        refreshIntervalMs: this.config.refreshIntervalMs,
      },
      timestamp: new Date(),
    });

    this.emit('started', { assets: targetAssets });
  }

  /**
   * Stop data collection
   */
  stop(): void {
    if (!this.isRunning) {
      log.warn('DataCollector not running');
      return;
    }

    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    
    this.isRunning = false;

    this.auditLogger.logSystemEvent({
      eventType: 'DATA_COLLECTOR_STOPPED',
      details: {},
      timestamp: new Date(),
    });

    log.info('DataCollector stopped');
    this.emit('stopped');
  }

  /**
   * Collect data for all tracked assets
   */
  async collectAll(assets: string[]): Promise<void> {
    const startTime = Date.now();
    const results: { asset: string; success: boolean; error?: string }[] = [];

    for (const asset of assets) {
      try {
        const data = await this.collectAsset(asset);
        this.dataCache.set(asset, data);
        results.push({ asset, success: true });
        this.emit('data:updated', { asset, data });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({ asset, success: false, error: errorMsg });
        
        log.error(`Data collection failed for ${asset}`, { error: errorMsg });
        
        this.auditLogger.logSystemEvent({
          eventType: 'DATA_COLLECTION_ERROR',
          details: { asset, error: errorMsg },
          timestamp: new Date(),
        });
        
        this.emit('data:error', { asset, error });
      }
    }

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    
    log.debug('Data collection cycle complete', { 
      duration, 
      successCount, 
      totalAssets: assets.length 
    });
  }

  /**
   * Collect all data for a single asset
   */
  private async collectAsset(asset: string): Promise<MarketData> {
    const startTime = Date.now();

    // Collect from all sources in parallel
    const [binanceData, optionData, whaleData] = await Promise.all([
      this.binanceConnector.getMarketData(asset),
      this.config.enableOptionData 
        ? this.optionAdapter.getOptionData(asset).catch((e) => {
            log.warn(`Option data unavailable for ${asset}`, { error: e.message });
            return null;
          })
        : Promise.resolve(null),
      this.config.enableWhaleData
        ? this.whaleAdapter.getWhaleData(asset).catch((e) => {
            log.warn(`Whale data unavailable for ${asset}`, { error: e.message });
            return null;
          })
        : Promise.resolve(null),
    ]);

    // Assess data quality
    const dataQuality = this.assessDataQuality(binanceData, optionData, whaleData);

    // Normalize and combine data
    const marketData: MarketData = {
      asset,
      price: binanceData.price,
      timestamp: new Date(),
      binance: binanceData,
      option: optionData ? this.normalizer.normalizeOptionData(optionData) : null,
      whale: whaleData ? this.normalizer.normalizeWhaleData(whaleData) : null,
      dataQuality,
    };

    const duration = Date.now() - startTime;
    log.debug(`Collected data for ${asset}`, { duration, quality: dataQuality.overall });

    return marketData;
  }

  /**
   * Assess overall data quality
   */
  private assessDataQuality(
    binance: any,
    option: any | null,
    whale: any | null
  ): DataQualityReport {
    const now = Date.now();
    const threshold = this.config.stalenessThresholdMs;
    const issues: string[] = [];

    // Check Binance data freshness
    const binanceFresh = binance?.timestamp 
      ? now - new Date(binance.timestamp).getTime() < threshold 
      : false;
    
    if (!binanceFresh) {
      issues.push('Binance data is stale');
    }

    // Check Option data
    const optionFresh = option?.timestamp 
      ? now - new Date(option.timestamp).getTime() < threshold * 2 // Allow longer for option data
      : false;

    // Check Whale data
    const whaleFresh = whale?.timestamp
      ? now - new Date(whale.timestamp).getTime() < threshold
      : false;

    // Determine overall quality
    let overall: 'GOOD' | 'DEGRADED' | 'CRITICAL';
    
    if (!binanceFresh) {
      overall = 'CRITICAL';
      issues.push('Primary data source (Binance) unavailable or stale');
    } else if (!option && !whale) {
      overall = 'DEGRADED';
      issues.push('Supplementary data sources unavailable');
    } else if (!optionFresh && !whaleFresh) {
      overall = 'DEGRADED';
      issues.push('Supplementary data is stale');
    } else {
      overall = 'GOOD';
    }

    return {
      overall,
      binance: { 
        fresh: binanceFresh, 
        lastUpdate: binance?.timestamp ?? new Date(),
        latencyMs: binance?.timestamp ? now - new Date(binance.timestamp).getTime() : 0,
      },
      option: { 
        fresh: optionFresh, 
        lastUpdate: option?.timestamp ?? null, 
        available: !!option,
        source: 'external',
      },
      whale: { 
        fresh: whaleFresh, 
        lastUpdate: whale?.timestamp ?? null, 
        available: !!whale,
        source: 'external',
      },
      issues,
    };
  }

  /**
   * Get cached data for an asset
   */
  getData(asset: string): MarketData | null {
    return this.dataCache.get(asset.toUpperCase()) ?? null;
  }

  /**
   * Get all cached data
   */
  getAllData(): Map<string, MarketData> {
    return new Map(this.dataCache);
  }

  /**
   * Force refresh data for an asset
   */
  async refreshAsset(asset: string): Promise<MarketData> {
    const data = await this.collectAsset(asset);
    this.dataCache.set(asset, data);
    this.emit('data:updated', { asset, data });
    return data;
  }

  /**
   * Check if collector is running
   */
  isCollecting(): boolean {
    return this.isRunning;
  }

  /**
   * Get current configuration
   */
  getConfig(): DataCollectorConfig {
    return { ...this.config };
  }
}

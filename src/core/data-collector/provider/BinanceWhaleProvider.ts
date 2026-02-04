// src/core/data-collector/providers/BinanceWhaleProvider.ts
import Binance, { Binance as BinanceClient } from 'binance-api-node';
import { WhaleData } from '../types';
import { env } from '../../../config/environment';
import { log } from '../../../utils/logger';

export class BinanceWhaleProvider {
  private client: BinanceClient;
  // Track multiple streams: Map<symbol, cleanupFunction>
  private activeStreams: Map<string, Function> = new Map();

  // Cache dữ liệu tính toán per symbol
  private whaleDataCache: Map<string, {
    whaleCvdAccumulator: number;
    totalCvdAccumulator: number;
    largeTrades: Array<{
      price: number;
      type: 'BUY' | 'SELL';
      size: string;
      timestamp: Date;
      valueUsd: number;
    }>;
  }> = new Map();

  // Config ngưỡng Whale (ví dụ: $100k)
  private readonly WHALE_THRESHOLD_USD = 100_000;

  constructor() {
    this.client = Binance({
      apiKey: env.BINANCE_API_KEY,
      apiSecret: env.BINANCE_API_SECRET,
      // Dùng Websocket thật kể cả khi trade testnet để lấy data thị trường thật
      wsBase: 'wss://stream.binance.com:9443',
    });
  }

  /**
   * Bắt đầu lắng nghe thị trường (Realtime)
   */
  async startStream(symbol: string) {
    // Skip if stream already exists
    if (this.activeStreams.has(symbol)) {
      log.debug(`[WhaleProvider] Stream for ${symbol} already active`);
      return;
    }

    log.info(`[WhaleProvider] Starting stream for ${symbol}...`);

    // Initialize cache for this symbol
    if (!this.whaleDataCache.has(symbol)) {
      this.whaleDataCache.set(symbol, {
        whaleCvdAccumulator: 0,
        totalCvdAccumulator: 0,
        largeTrades: [],
      });
    }

    // Subscribe vào aggTrade (Aggregated Trades)
    const cleanup = this.client.ws.aggTrades([symbol], (trade) => {
      this.processTrade(symbol, trade);
    });

    this.activeStreams.set(symbol, cleanup);
  }

  /**
   * Stop stream for a specific symbol
   */
  async stopStream(symbol: string) {
    const cleanup = this.activeStreams.get(symbol);
    if (cleanup) {
      log.info(`[WhaleProvider] Stopping stream for ${symbol}...`);
      cleanup();
      this.activeStreams.delete(symbol);
      // Optionally clear cache for this symbol
      // this.whaleDataCache.delete(symbol);
    } else {
      log.debug(`[WhaleProvider] No active stream found for ${symbol}`);
    }
  }

  /**
   * Stop all streams
   */
  async stopAllStreams() {
    log.info(`[WhaleProvider] Stopping all streams (${this.activeStreams.size} active)...`);
    for (const [symbol, cleanup] of this.activeStreams.entries()) {
      cleanup();
    }
    this.activeStreams.clear();
  }

  /**
   * Get list of active symbols
   */
  getActiveSymbols(): string[] {
    return Array.from(this.activeStreams.keys());
  }

  /**
   * Xử lý từng lệnh khớp trên thị trường
   */
  private processTrade(symbol: string, trade: any) {
    const cache = this.whaleDataCache.get(symbol);
    if (!cache) {
      log.warn(`[WhaleProvider] No cache found for ${symbol}, initializing...`);
      this.whaleDataCache.set(symbol, {
        whaleCvdAccumulator: 0,
        totalCvdAccumulator: 0,
        largeTrades: [],
      });
      return;
    }

    const price = parseFloat(trade.price);
    const quantity = parseFloat(trade.quantity);
    const valueUsd = price * quantity;
    const isBuyerMaker = trade.maker; // True = Sell (Taker là Seller), False = Buy (Taker là Buyer)

    // Taker Buy: isBuyerMaker = false -> Cộng Dương (+)
    // Taker Sell: isBuyerMaker = true -> Trừ Âm (-)
    const direction = isBuyerMaker ? -1 : 1;
    const signedValue = valueUsd * direction;

    // 1. Cộng dồn Total CVD
    cache.totalCvdAccumulator += signedValue;

    // 2. Lọc Whale CVD
    if (valueUsd >= this.WHALE_THRESHOLD_USD) {
      cache.whaleCvdAccumulator += signedValue;

      // Lưu lại Bubble Signal (Lệnh cá voi)
      cache.largeTrades.push({
        price,
        type: direction === 1 ? 'BUY' : 'SELL',
        size: this.categorizeSize(valueUsd),
        timestamp: new Date(trade.eventTime),
        valueUsd,
      });

      // Giữ lại 50 lệnh lớn gần nhất thôi
      if (cache.largeTrades.length > 50) cache.largeTrades.shift();

      log.debug(`🐳 WHALE DETECTED [${symbol}]: ${direction === 1 ? 'BUY' : 'SELL'} $${Math.round(valueUsd)}`);
    }
  }

  /**
   * API cho Bot gọi để lấy dữ liệu hiện tại
   */
  async getWhaleData(symbol: string): Promise<WhaleData> {
    // Lưu ý: VWAP cần tính phức tạp hơn, ở đây ta dùng giá hiện tại làm fallback
    const prices = await this.client.futuresPrices({ symbol });
    const currentPrice = parseFloat(prices[symbol]);

    // Get cache for this symbol, or initialize if missing
    let cache = this.whaleDataCache.get(symbol);
    if (!cache) {
      cache = {
        whaleCvdAccumulator: 0,
        totalCvdAccumulator: 0,
        largeTrades: [],
      };
      this.whaleDataCache.set(symbol, cache);
    }

    return {
      timestamp: new Date(),

      // Data tự tính
      cvdWhale24h: cache.whaleCvdAccumulator,
      cvdTotal24h: cache.totalCvdAccumulator,

      // Data phái sinh
      // Nếu không có API lịch sử 7 ngày, ta tạm dùng số liệu 24h nhân hệ số (hoặc phải lưu DB)
      cvdWhale7d: cache.whaleCvdAccumulator * 3, // Mock logic: tạm estimate
      netWhaleFlow24h: cache.whaleCvdAccumulator,
      netWhaleFlow7d: cache.whaleCvdAccumulator * 3,

      // Metrics
      cvdVolumeRatio: this.calculateRatio(cache),

      // Signals
      bubbleSignals: cache.largeTrades.map((t) => ({
        price: t.price,
        type: t.type,
        size: t.size,
        timestamp: t.timestamp,
      })),

      // VWAP (Cần module riêng, tạm mock quanh giá)
      whaleVwap: currentPrice,
      vwapBands: {
        lower: currentPrice * 0.98,
        upper: currentPrice * 1.02,
        bandWidth: currentPrice * 0.04,
      },
    };
  }

  private calculateRatio(cache: { whaleCvdAccumulator: number; totalCvdAccumulator: number }): number {
    if (Math.abs(cache.totalCvdAccumulator) === 0) return 0;
    return Math.abs(cache.whaleCvdAccumulator) / Math.abs(cache.totalCvdAccumulator);
  }

  private categorizeSize(value: number): string {
    if (value > 1_000_000) return 'MEGA_WHALE';
    if (value > 500_000) return 'WHALE';
    return 'SHARK';
  }
}

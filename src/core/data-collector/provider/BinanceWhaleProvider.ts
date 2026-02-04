// src/core/data-collector/providers/BinanceWhaleProvider.ts
import Binance, { Binance as BinanceClient } from 'binance-api-node';
import { WhaleData } from '../types';
import { env } from '../../../config/environment';
import { log } from '../../../utils/logger';

export class BinanceWhaleProvider {
  private client: BinanceClient;
  private wsCleanup: Function | null = null;

  // Cache dữ liệu tính toán
  private whaleCvdAccumulator: number = 0;
  private totalCvdAccumulator: number = 0;
  private largeTrades: Array<{
    price: number;
    type: 'BUY' | 'SELL';
    size: string;
    timestamp: Date;
    valueUsd: number;
  }> = [];

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
    log.info(`[WhaleProvider] Starting stream for ${symbol}...`);

    // Clean up stream cũ nếu có
    if (this.wsCleanup) this.wsCleanup();

    // Subscribe vào aggTrade (Aggregated Trades)
    this.wsCleanup = this.client.ws.aggTrades([symbol], (trade) => {
      this.processTrade(trade);
    });
  }

  /**
   * Xử lý từng lệnh khớp trên thị trường
   */
  private processTrade(trade: any) {
    const price = parseFloat(trade.price);
    const quantity = parseFloat(trade.quantity);
    const valueUsd = price * quantity;
    const isBuyerMaker = trade.maker; // True = Sell (Taker là Seller), False = Buy (Taker là Buyer)

    // Taker Buy: isBuyerMaker = false -> Cộng Dương (+)
    // Taker Sell: isBuyerMaker = true -> Trừ Âm (-)
    const direction = isBuyerMaker ? -1 : 1;
    const signedValue = valueUsd * direction;

    // 1. Cộng dồn Total CVD
    this.totalCvdAccumulator += signedValue;

    // 2. Lọc Whale CVD
    if (valueUsd >= this.WHALE_THRESHOLD_USD) {
      this.whaleCvdAccumulator += signedValue;

      // Lưu lại Bubble Signal (Lệnh cá voi)
      this.largeTrades.push({
        price,
        type: direction === 1 ? 'BUY' : 'SELL',
        size: this.categorizeSize(valueUsd),
        timestamp: new Date(trade.eventTime),
        valueUsd,
      });

      // Giữ lại 50 lệnh lớn gần nhất thôi
      if (this.largeTrades.length > 50) this.largeTrades.shift();

      log.debug(`🐳 WHALE DETECTED: ${direction === 1 ? 'BUY' : 'SELL'} $${Math.round(valueUsd)}`);
    }
  }

  /**
   * API cho Bot gọi để lấy dữ liệu hiện tại
   */
  async getWhaleData(symbol: string): Promise<WhaleData> {
    // Lưu ý: VWAP cần tính phức tạp hơn, ở đây ta dùng giá hiện tại làm fallback
    const prices = await this.client.futuresPrices({ symbol });
    const currentPrice = parseFloat(prices[symbol]);

    return {
      timestamp: new Date(),

      // Data tự tính
      cvdWhale24h: this.whaleCvdAccumulator,
      cvdTotal24h: this.totalCvdAccumulator,

      // Data phái sinh
      // Nếu không có API lịch sử 7 ngày, ta tạm dùng số liệu 24h nhân hệ số (hoặc phải lưu DB)
      cvdWhale7d: this.whaleCvdAccumulator * 3, // Mock logic: tạm estimate
      netWhaleFlow24h: this.whaleCvdAccumulator,
      netWhaleFlow7d: this.whaleCvdAccumulator * 3,

      // Metrics
      cvdVolumeRatio: this.calculateRatio(),

      // Signals
      bubbleSignals: this.largeTrades.map((t) => ({
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

  private calculateRatio(): number {
    if (Math.abs(this.totalCvdAccumulator) === 0) return 0;
    return Math.abs(this.whaleCvdAccumulator) / Math.abs(this.totalCvdAccumulator);
  }

  private categorizeSize(value: number): string {
    if (value > 1_000_000) return 'MEGA_WHALE';
    if (value > 500_000) return 'WHALE';
    return 'SHARK';
  }
}

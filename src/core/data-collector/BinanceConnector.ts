// src/core/data-collector/BinanceConnector.ts
// Binance API connector for market data and execution

import Binance, { Binance as BinanceClient, FuturesAccountInfoResult } from 'binance-api-node';
import { env } from '../../config/environment';
import { RateLimiter } from '../../infrastructure/safety/RateLimiter';
import { BinanceData } from './types';
import { log } from '../../utils/logger';
import { ApiError, RateLimitError } from '../../utils/errors';

export interface BinanceAccountInfo {
  totalBalance: number;
  availableBalance: number;
  unrealizedPnL: number;
  positions: Array<{
    symbol: string;
    size: number;
    entryPrice: number;
    markPrice: number;
    unrealizedPnL: number;
    side: 'LONG' | 'SHORT';
    leverage: number;
  }>;
}

export interface BinanceOrderResult {
  orderId: string;
  clientOrderId: string;
  status: string;
  symbol: string;
  side: string;
  type: string;
  executedQty: string;
  avgPrice: string;
  timestamp: Date;
}

export class BinanceConnector {
  private client: BinanceClient;
  private rateLimiter: RateLimiter;
  private isTestnet: boolean;

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
      log.info('BinanceConnector initialized with TESTNET');
    } else {
      log.warn('BinanceConnector initialized with LIVE exchange');
    }

    this.client = Binance(clientConfig);
  }

  /**
   * Get market data for a symbol
   */
  async getMarketData(symbol: string): Promise<BinanceData> {
    await this.rateLimiter.acquire('binance-read');

    try {
      // Fetch multiple data points in parallel
      const [ticker, fundingRate] = await Promise.all([
        this.client.futuresPrices({ symbol }),
        this.client.futuresFundingRate({ symbol, limit: 1 }),
      ]);

      const price = parseFloat(ticker[symbol] || '0');
      
      return {
        price,
        openInterest: 0, // Would need openInterest endpoint
        openInterestValue: 0, // Calculated as openInterest * price
        oiChange24h: 0, // Would need OI history data
        fundingRate: fundingRate[0] ? parseFloat(fundingRate[0].fundingRate) : 0,
        nextFundingTime: fundingRate[0] ? new Date(fundingRate[0].fundingTime) : new Date(),
        volume24h: 0, // Would need 24hr ticker call
        priceChange24h: 0,
        priceChangePercent24h: 0,
        highPrice24h: 0,
        lowPrice24h: 0,
        liquidationLevels: {
          longs: [],
          shorts: [],
        },
        timestamp: new Date(),
      };
    } catch (error) {
      log.error('Binance getMarketData failed', { symbol, error });
      throw new ApiError(
        `Failed to fetch market data for ${symbol}`,
        undefined,
        { symbol, originalError: error instanceof Error ? error.message : 'Unknown' }
      );
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<BinanceAccountInfo> {
    await this.rateLimiter.acquire('binance-read');

    try {
      const account = await this.client.futuresAccountInfo();
      
      return {
        totalBalance: parseFloat(account.totalWalletBalance),
        availableBalance: parseFloat(account.availableBalance),
        unrealizedPnL: parseFloat(account.totalUnrealizedProfit),
        positions: account.positions
          .filter((p: any) => parseFloat(p.positionAmt) !== 0)
          .map((p: any) => ({
            symbol: p.symbol,
            size: Math.abs(parseFloat(p.positionAmt)),
            entryPrice: parseFloat(p.entryPrice),
            markPrice: parseFloat(p.markPrice || '0'),
            unrealizedPnL: parseFloat(p.unrealizedProfit),
            side: parseFloat(p.positionAmt) > 0 ? 'LONG' as const : 'SHORT' as const,
            leverage: parseInt(p.leverage),
          })),
      };
    } catch (error) {
      log.error('Binance getAccountInfo failed', { error });
      throw new ApiError(
        'Failed to fetch account info',
        undefined,
        { originalError: error instanceof Error ? error.message : 'Unknown' }
      );
    }
  }

  /**
   * Get position for a specific symbol
   */
  async getPosition(symbol: string): Promise<{
    exists: boolean;
    size: number;
    side: 'LONG' | 'SHORT' | null;
    entryPrice: number;
    unrealizedPnL: number;
  }> {
    const accountInfo = await this.getAccountInfo();
    const position = accountInfo.positions.find(p => p.symbol === symbol);

    if (!position) {
      return {
        exists: false,
        size: 0,
        side: null,
        entryPrice: 0,
        unrealizedPnL: 0,
      };
    }

    return {
      exists: true,
      size: position.size,
      side: position.side,
      entryPrice: position.entryPrice,
      unrealizedPnL: position.unrealizedPnL,
    };
  }

  /**
   * Execute a market order
   * CRITICAL: Only called after all safety checks pass
   */
  async executeOrder(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    reduceOnly?: boolean;
    type?: 'MARKET' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
    stopPrice?: number;
  }): Promise<BinanceOrderResult> {
    await this.rateLimiter.acquire('binance-trade');

    log.info('Executing Binance order', {
      symbol: params.symbol,
      side: params.side,
      type: params.type || 'MARKET',
      quantity: params.quantity,
      stopPrice: params.stopPrice,
      reduceOnly: params.reduceOnly,
      testnet: this.isTestnet,
    });

    try {
      const orderParams: any = {
        symbol: params.symbol,
        side: params.side,
        type: params.type || 'MARKET',
        quantity: params.quantity.toString(),
      };

      if (params.reduceOnly) {
        orderParams.reduceOnly = 'true';
      }

      // Add stopPrice for STOP_MARKET and TAKE_PROFIT_MARKET orders
      if (params.stopPrice && (params.type === 'STOP_MARKET' || params.type === 'TAKE_PROFIT_MARKET')) {
        orderParams.stopPrice = params.stopPrice.toString();
      }

      const order = await this.client.futuresOrder(orderParams);

      const result: BinanceOrderResult = {
        orderId: order.orderId.toString(),
        clientOrderId: order.clientOrderId,
        status: order.status,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        executedQty: order.executedQty,
        avgPrice: order.avgPrice,
        timestamp: new Date(),
      };

      log.info('Binance order executed', result);

      return result;
    } catch (error) {
      log.error('Binance executeOrder failed', { params, error });
      throw new ApiError(
        `Failed to execute order: ${error instanceof Error ? error.message : 'Unknown'}`,
        undefined,
        { params, originalError: error instanceof Error ? error.message : 'Unknown' }
      );
    }
  }

  /**
   * Cancel an open order
   */
  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    await this.rateLimiter.acquire('binance-trade');

    log.info('Cancelling Binance order', { symbol, orderId });

    try {
      await this.client.futuresCancelOrder({
        symbol,
        orderId: parseInt(orderId),
      });

      log.info('Binance order cancelled', { symbol, orderId });
    } catch (error) {
      log.error('Binance cancelOrder failed', { symbol, orderId, error });
      throw new ApiError(
        `Failed to cancel order: ${error instanceof Error ? error.message : 'Unknown'}`,
        undefined,
        { symbol, orderId, originalError: error instanceof Error ? error.message : 'Unknown' }
      );
    }
  }

  /**
   * Get current price for a symbol
   */
  async getPrice(symbol: string): Promise<number> {
    await this.rateLimiter.acquire('binance-read');

    try {
      const prices = await this.client.futuresPrices({ symbol });
      return parseFloat(prices[symbol] || '0');
    } catch (error) {
      log.error('Binance getPrice failed', { symbol, error });
      throw new ApiError(`Failed to get price for ${symbol}`);
    }
  }

  /**
   * Check API connectivity
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      await this.client.futuresTime();
      return {
        healthy: true,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if using testnet
   */
  isUsingTestnet(): boolean {
    return this.isTestnet;
  }
}

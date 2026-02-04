// src/execution/TPSLManager.ts
// Manages Take Profit and Stop Loss order placement

import { env } from '../config/environment';
import { log } from '../utils/logger';
import { BinanceConnector } from '../core/data-collector/BinanceConnector';

export interface TPSLOrders {
  stopLossOrderId?: string;
  takeProfitOrderId?: string;
}

export interface TPSLParams {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  stopLossPrice: number;
  takeProfitPrice: number;
}

export class TPSLManager {
  constructor(private binanceConnector: BinanceConnector) {}

  /**
   * Place TP/SL orders based on TPSL_MODE configuration
   */
  async placeTpSlOrders(params: TPSLParams): Promise<TPSLOrders> {
    const tpslMode = env.TPSL_MODE;

    log.info('TPSLManager: Placing TP/SL orders', {
      mode: tpslMode,
      symbol: params.symbol,
      side: params.side,
      sl: params.stopLossPrice,
      tp: params.takeProfitPrice,
    });

    const orders: TPSLOrders = {};

    try {
      // Always place Stop Loss (unless MANUAL mode)
      if (tpslMode !== 'MANUAL') {
        orders.stopLossOrderId = await this.placeStopLoss(params);
      }

      // Place Take Profit only in AUTO_TPSL mode
      if (tpslMode === 'AUTO_TPSL') {
        orders.takeProfitOrderId = await this.placeTakeProfit(params);
      }

      log.info('TPSLManager: Successfully placed orders', orders);
      return orders;
    } catch (error) {
      log.error('TPSLManager: Failed to place TP/SL orders', { params, error });
      throw error;
    }
  }

  /**
   * Place Stop Loss order
   */
  private async placeStopLoss(params: TPSLParams): Promise<string> {
    const { symbol, side, quantity, stopLossPrice } = params;

    // For LONG: SL is SELL below entry
    // For SHORT: SL is BUY above entry
    const stopSide = side === 'LONG' ? 'SELL' : 'BUY';

    log.info('TPSLManager: Placing Stop Loss', {
      symbol,
      stopSide,
      stopPrice: stopLossPrice,
      quantity,
    });

    // Use Binance STOP_MARKET order type
    // This order will trigger when mark price reaches stopPrice
    const result = await this.binanceConnector.executeOrder({
      symbol,
      side: stopSide,
      quantity,
      reduceOnly: true,
      type: 'STOP_MARKET',
      stopPrice: stopLossPrice,
    });

    return result.orderId;
  }

  /**
   * Place Take Profit order
   */
  private async placeTakeProfit(params: TPSLParams): Promise<string> {
    const { symbol, side, quantity, takeProfitPrice } = params;

    // For LONG: TP is SELL above entry
    // For SHORT: TP is BUY below entry
    const tpSide = side === 'LONG' ? 'SELL' : 'BUY';

    log.info('TPSLManager: Placing Take Profit', {
      symbol,
      tpSide,
      tpPrice: takeProfitPrice,
      quantity,
    });

    // Use Binance TAKE_PROFIT_MARKET order type
    const result = await this.binanceConnector.executeOrder({
      symbol,
      side: tpSide,
      quantity,
      reduceOnly: true,
      type: 'TAKE_PROFIT_MARKET',
      stopPrice: takeProfitPrice,
    });

    return result.orderId;
  }

  /**
   * Cancel existing TP/SL orders (useful for position management)
   */
  async cancelOrders(symbol: string, orders: TPSLOrders): Promise<void> {
    const orderIds = [orders.stopLossOrderId, orders.takeProfitOrderId].filter(Boolean);

    if (orderIds.length === 0) {
      return;
    }

    log.info('TPSLManager: Cancelling TP/SL orders', { symbol, orderIds });

    try {
      await Promise.all(
        orderIds.map(orderId => this.binanceConnector.cancelOrder(symbol, orderId!))
      );
      log.info('TPSLManager: Successfully cancelled orders');
    } catch (error) {
      log.error('TPSLManager: Failed to cancel orders', { symbol, orderIds, error });
      throw error;
    }
  }
}

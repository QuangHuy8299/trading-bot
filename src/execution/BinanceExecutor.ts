// src/execution/BinanceExecutor.ts
// Orchestrates entry order + TP/SL placement on Binance

import { BinanceConnector, BinanceOrderResult } from '../core/data-collector/BinanceConnector';
import { TPSLManager, TPSLOrders } from './TPSLManager';
import { TradeSuggestion } from '../types/execution.types';
import { log } from '../utils/logger';
import { ApiError } from '../utils/errors';

export interface ExecutionResult {
  success: boolean;
  entryOrder: BinanceOrderResult;
  tpslOrders: TPSLOrders;
  error?: string;
}

export class BinanceExecutor {
  private tpslManager: TPSLManager;

  constructor(private binanceConnector: BinanceConnector) {
    this.tpslManager = new TPSLManager(binanceConnector);
  }

  /**
   * Execute a complete trade: Entry + TP/SL
   * This is the main entry point for auto-execution
   */
  async executeTradeWithTpSl(suggestion: TradeSuggestion): Promise<ExecutionResult> {
    log.info('BinanceExecutor: Starting trade execution', {
      asset: suggestion.asset,
      direction: suggestion.direction,
      entryPrice: suggestion.entryPrice,
      stopLoss: suggestion.stopLoss,
      takeProfit: suggestion.takeProfit,
    });

    try {
      // Step 1: Calculate quantity in base asset (e.g., BTC amount for BTCUSDT)
      const quantity = this.calculateQuantity(
        suggestion.positionSizeUsd,
        suggestion.entryPrice
      );

      // Step 2: Determine side (LONG = BUY, SHORT = SELL)
      const entrySide = suggestion.direction === 'LONG' ? 'BUY' : 'SELL';

      // Step 3: Execute entry order
      log.info('BinanceExecutor: Placing entry order', {
        symbol: suggestion.asset,
        side: entrySide,
        quantity,
      });

      const entryOrder = await this.binanceConnector.executeOrder({
        symbol: suggestion.asset,
        side: entrySide,
        quantity,
        type: 'MARKET',
      });

      log.info('BinanceExecutor: Entry order filled', {
        orderId: entryOrder.orderId,
        executedQty: entryOrder.executedQty,
        avgPrice: entryOrder.avgPrice,
      });

      // Step 4: Place TP/SL orders
      // Note: direction cannot be NEUTRAL here because SignalGenerator filters it out
      if (suggestion.direction === 'NEUTRAL') {
        throw new ApiError('Cannot execute NEUTRAL direction');
      }

      const tpslOrders = await this.tpslManager.placeTpSlOrders({
        symbol: suggestion.asset,
        side: suggestion.direction, // TypeScript now knows this is 'LONG' | 'SHORT'
        quantity: parseFloat(entryOrder.executedQty),
        stopLossPrice: suggestion.stopLoss,
        takeProfitPrice: suggestion.takeProfit,
      });

      log.info('BinanceExecutor: Trade execution completed successfully', {
        entryOrderId: entryOrder.orderId,
        stopLossOrderId: tpslOrders.stopLossOrderId,
        takeProfitOrderId: tpslOrders.takeProfitOrderId,
      });

      return {
        success: true,
        entryOrder,
        tpslOrders,
      };
    } catch (error) {
      log.error('BinanceExecutor: Trade execution failed', {
        suggestion,
        error,
      });

      return {
        success: false,
        entryOrder: {} as BinanceOrderResult, // Empty placeholder
        tpslOrders: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculate quantity in base asset
   * Example: If positionSizeUsd = 1000 and entryPrice = 50000, quantity = 0.02 BTC
   */
  private calculateQuantity(positionSizeUsd: number, entryPrice: number): number {
    const quantity = positionSizeUsd / entryPrice;

    // Round to appropriate precision (Binance typically uses 3 decimals for BTC, 2 for ETH)
    // This should be enhanced with symbol-specific precision lookup
    return parseFloat(quantity.toFixed(3));
  }

  /**
   * Close a position manually (for position management)
   */
  async closePosition(symbol: string, side: 'LONG' | 'SHORT'): Promise<BinanceOrderResult> {
    log.info('BinanceExecutor: Closing position', { symbol, side });

    try {
      // Get current position size
      const position = await this.binanceConnector.getPosition(symbol);

      if (!position.exists) {
        throw new ApiError(`No position found for ${symbol}`);
      }

      // Determine close side (opposite of position side)
      const closeSide = position.side === 'LONG' ? 'SELL' : 'BUY';

      // Execute close order (reduceOnly = true)
      const closeOrder = await this.binanceConnector.executeOrder({
        symbol,
        side: closeSide,
        quantity: position.size,
        reduceOnly: true,
        type: 'MARKET',
      });

      log.info('BinanceExecutor: Position closed', {
        orderId: closeOrder.orderId,
        size: position.size,
      });

      return closeOrder;
    } catch (error) {
      log.error('BinanceExecutor: Failed to close position', { symbol, side, error });
      throw error;
    }
  }
}

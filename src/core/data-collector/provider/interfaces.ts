// src/core/data-collector/providers/interfaces.ts
import { WhaleData, OptionData } from '../types';

export interface IMarketDataProvider {
  getWhaleData(asset: string): Promise<WhaleData>;
  getOptionData(asset: string): Promise<OptionData>;
  getMarketPrice(asset: string): Promise<number>;
  getADV30(asset: string): Promise<number>;
}

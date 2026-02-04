// src/core/data-collector/LiquidityClassifier.ts
export type LiquidityTier = 'T1_MAJOR' | 'T2_LARGE' | 'T3_MID' | 'T4_MICRO';

export class LiquidityClassifier {
  // Config threshold động, có thể inject từ ngoài
  private thresholds = {
    T1: 500_000_000, // > 500M ADV
    T2: 100_000_000, // > 100M ADV
    T3: 10_000_000, // > 10M ADV
  };

  classify(adv30: number): LiquidityTier {
    if (adv30 >= this.thresholds.T1) return 'T1_MAJOR';
    if (adv30 >= this.thresholds.T2) return 'T2_LARGE';
    if (adv30 >= this.thresholds.T3) return 'T3_MID';
    return 'T4_MICRO';
  }

  // Lấy ngưỡng Whale động dựa trên Tier
  getWhaleThreshold(tier: LiquidityTier): number {
    switch (tier) {
      case 'T1_MAJOR':
        return 1_000_000; // $1M cho BTC/ETH
      case 'T2_LARGE':
        return 500_000;
      case 'T3_MID':
        return 100_000;
      case 'T4_MICRO':
        return 50_000;
    }
  }
}

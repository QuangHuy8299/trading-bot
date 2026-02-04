# Auto-Entry Feature Guide

## Overview

The TK Trading System now supports **automatic order entry** with **automatic TP/SL placement**. This feature allows the system to automatically execute trades when high-quality signals are detected, with full risk management included.

## Architecture

### Components

1. **TPSLManager** (`src/execution/TPSLManager.ts`)
   - Manages Take Profit and Stop Loss order placement
   - Supports 3 modes: AUTO_TPSL, SL_ONLY, MANUAL
   - Places STOP_MARKET and TAKE_PROFIT_MARKET orders on Binance

2. **BinanceExecutor** (`src/execution/BinanceExecutor.ts`)
   - Orchestrates entry order + TP/SL placement
   - Calculates quantity based on USD position size
   - Provides position closing functionality

3. **OrderExecutionService** (`src/execution/OrderExecutionService.ts`)
   - Main service managing auto-entry flow
   - Maintains pending orders queue with expiration
   - Supports 3 execution modes: AUTO, SAFE, HYBRID
   - Emits events for Telegram notifications

4. **Integration**
   - App.ts: Initializes services and processes signals in evaluation cycle
   - CommandHandler.ts: Handles `/confirm` and `/cancel` commands
   - TelegramNotifier.ts: Sends order notifications
   - MessageTemplates.ts: Formats order messages

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# ─────────────────────────────────────────────────────────────────────────────────
# AUTO-ENTRY CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────────

# Master switch - Enable automatic entry
AUTO_ENTRY_ENABLED=false

# Execution mode (SAFE recommended for beginners)
# SAFE   = Requires manual /confirm via Telegram before executing
# AUTO   = Executes immediately without confirmation (risky)
# HYBRID = Auto-executes high-confidence signals (≥80%), asks confirmation for others
AUTO_ENTRY_MODE=SAFE

# TP/SL mode
# AUTO_TPSL  = Automatically set both TP and SL orders (recommended)
# SL_ONLY    = Only set Stop Loss, no Take Profit
# MANUAL     = No automatic TP/SL, you manage manually
TPSL_MODE=AUTO_TPSL

# Risk management
RISK_PER_TRADE_PERCENT=0.01      # 1% of account balance per trade
RISK_REWARD_RATIO=2.0             # Target 2x profit vs risk (1:2 R/R)
DEFAULT_STOP_LOSS_PERCENT=0.02    # 2% stop loss fallback
MAX_LEVERAGE=1                    # No leverage (spot-like)

# Quality control
MIN_CONFIDENCE_SCORE=60           # Minimum signal quality (0-100)
MAX_CONCURRENT_POSITIONS=3        # Maximum open positions at once
```

### Risk Configuration Examples

**Conservative (Recommended for beginners)**
```bash
RISK_PER_TRADE_PERCENT=0.01  # 1% risk
RISK_REWARD_RATIO=2.0         # 1:2 R/R
MIN_CONFIDENCE_SCORE=80       # High quality only
MAX_CONCURRENT_POSITIONS=2    # Limited exposure
```

**Moderate**
```bash
RISK_PER_TRADE_PERCENT=0.02  # 2% risk
RISK_REWARD_RATIO=2.0         # 1:2 R/R
MIN_CONFIDENCE_SCORE=60       # Moderate quality
MAX_CONCURRENT_POSITIONS=3    # Balanced exposure
```

**Aggressive**
```bash
RISK_PER_TRADE_PERCENT=0.03  # 3% risk
RISK_REWARD_RATIO=3.0         # 1:3 R/R
MIN_CONFIDENCE_SCORE=50       # Lower quality threshold
MAX_CONCURRENT_POSITIONS=5    # Higher exposure
```

## How It Works

### Signal Processing Flow

1. **Signal Generation**
   - Every evaluation cycle (default: 60 seconds)
   - GateEvaluator evaluates market conditions
   - PermissionEngine determines if trading is allowed
   - SignalGenerator creates TradeSuggestion if conditions met

2. **Mode-Based Processing**

   **SAFE Mode (Recommended)**
   ```
   Signal Generated
   → Check confidence threshold (MIN_CONFIDENCE_SCORE)
   → Check max concurrent positions
   → Create pending order
   → Send Telegram notification with /confirm command
   → Wait for user confirmation (expires in 5 minutes)
   → Execute on /confirm
   ```

   **AUTO Mode**
   ```
   Signal Generated
   → Check confidence threshold
   → Check max concurrent positions
   → Execute immediately
   → Send Telegram notification
   ```

   **HYBRID Mode**
   ```
   Signal Generated
   → Check confidence score
   → If confidence ≥ 80: Execute immediately
   → If confidence < 80: Queue for confirmation (SAFE mode)
   ```

3. **Order Execution**
   ```
   Entry Order (MARKET)
   ├─ Calculate position size based on risk
   ├─ Execute market buy/sell
   └─ Wait for fill

   TP/SL Orders (if TPSL_MODE = AUTO_TPSL)
   ├─ Place STOP_MARKET at stop loss price
   └─ Place TAKE_PROFIT_MARKET at take profit price
   ```

4. **Position Tracking**
   - Active positions tracked in `OrderExecutionService`
   - Prevents duplicate entries for same asset
   - Respects MAX_CONCURRENT_POSITIONS limit

## Telegram Commands

### `/confirm [ORDER_ID]`

**Without ORDER_ID**: List all pending orders
```
User: /confirm
Bot:
Pending Orders:

• a1b2c3d4 - BTCUSDT LONG (expires in 4m)
• e5f6g7h8 - ETHUSDT SHORT (expires in 3m)

Use /confirm ORDER_ID to confirm a specific order.
```

**With ORDER_ID**: Confirm and execute order
```
User: /confirm a1b2c3d4
Bot:
✅ Order confirmed and executed!

Entry Order ID: 123456789
Status: FILLED

Check your exchange for full details.
```

### `/cancel <ORDER_ID>`

Cancel a pending order before it expires
```
User: /cancel a1b2c3d4
Bot:
✅ Order a1b2c3d4 cancelled successfully.
```

## Telegram Notifications

### Order Pending (SAFE Mode)

```
━━━━━━━━━━━━━━━━━━━━━━━
🔔 ORDER CONFIRMATION REQUIRED
BTCUSDT | 2025-02-05 10:30:00
━━━━━━━━━━━━━━━━━━━━━━━

ORDER DETAILS
├ Order ID: a1b2c3d4
├ Direction: LONG
├ Entry Price: $45,000.00
└ Position Size: $1,000.00

RISK MANAGEMENT
├ Stop Loss: $44,100.00
├ Take Profit: $46,800.00
└ R:R Ratio: 1:2.0

CONFIDENCE
Score: 75/100

REASONS
• Direction determined by ACCUMULATION flow
• SL set based on Regime Comfort Range
• Funding Rate not crowded

ACTION REQUIRED
Reply with: /confirm a1b2c3d4
⏰ Expires in 5 minutes

━━━━━━━━━━━━━━━━━━━━━━━
Confirm to execute this order.
━━━━━━━━━━━━━━━━━━━━━━━
```

### Order Executed

```
━━━━━━━━━━━━━━━━━━━━━━━
✅ ORDER EXECUTED
BTCUSDT | 2025-02-05 10:35:00
━━━━━━━━━━━━━━━━━━━━━━━

POSITION
├ Direction: LONG
├ Entry Price: $45,000.00
├ Position Size: $1,000.00
└ Order ID: 123456789

RISK MANAGEMENT
├ Stop Loss: $44,100.00
├ Take Profit: $46,800.00
└ R:R Ratio: 1:2.0

EXECUTION DETAILS
├ Filled: 0.0222 BTC
├ Avg Price: $45,000.00
└ Status: FILLED

REASONS
• Direction determined by ACCUMULATION flow
• SL set based on Regime Comfort Range
• Funding Rate not crowded

━━━━━━━━━━━━━━━━━━━━━━━
Position opened. TP/SL orders active.
━━━━━━━━━━━━━━━━━━━━━━━
```

### Order Expired

```
━━━━━━━━━━━━━━━━━━━━━━━
⏰ ORDER EXPIRED
2025-02-05 10:35:00
━━━━━━━━━━━━━━━━━━━━━━━

ORDER ID: a1b2c3d4

STATUS
Order confirmation timeout reached.
Order has been automatically cancelled.

━━━━━━━━━━━━━━━━━━━━━━━
No action taken. Order expired.
━━━━━━━━━━━━━━━━━━━━━━━
```

## Risk Management

### Position Sizing

Position size is calculated automatically based on:

```javascript
const riskAmount = accountBalance * RISK_PER_TRADE_PERCENT;
const stopLossDistance = Math.abs(entryPrice - stopLossPrice);
const stopLossPercent = stopLossDistance / entryPrice;
const positionSizeUsd = riskAmount / stopLossPercent;
```

**Example:**
- Account Balance: $10,000
- Risk Per Trade: 1% (0.01)
- Entry Price: $45,000
- Stop Loss: $44,100 (2% away)

```
Risk Amount = $10,000 × 0.01 = $100
SL Distance = $45,000 - $44,100 = $900
SL Percent = $900 / $45,000 = 0.02 (2%)
Position Size = $100 / 0.02 = $5,000
```

So you'll enter a $5,000 position, risking $100 (1% of account).

### Stop Loss Calculation

Stop Loss is determined by (in order of priority):

1. **Stress Range** (from Regime Gate option data)
   - Uses implied volatility comfort range
   - Most accurate, market-condition-aware

2. **Fallback** (if no option data)
   - Uses DEFAULT_STOP_LOSS_PERCENT
   - Default: 2% from entry

### Take Profit Calculation

```javascript
const slDistance = Math.abs(entryPrice - stopLoss);
const tpDistance = slDistance * RISK_REWARD_RATIO;
const takeProfit = entryPrice + (direction === 'LONG' ? tpDistance : -tpDistance);
```

**Example:**
- Entry: $45,000
- Stop Loss: $44,100 (2% below)
- R/R Ratio: 2.0

```
SL Distance = $900
TP Distance = $900 × 2.0 = $1,800
Take Profit = $45,000 + $1,800 = $46,800
```

## Safety Features

### Pre-Execution Checks

1. **AUTO_ENTRY_ENABLED** - Master kill switch
2. **Confidence Threshold** - MIN_CONFIDENCE_SCORE filter
3. **Position Limit** - MAX_CONCURRENT_POSITIONS enforcement
4. **Duplicate Prevention** - One position per asset max
5. **Permission State** - Only executes when permission allows

### Order Expiration

- Pending orders expire after 5 minutes (configurable via ORDER_CONFIRMATION_TIMEOUT_MS)
- Automatic cleanup every 30 seconds
- Notification sent when orders expire

### Circuit Breakers

The system inherits all safety features from the base system:
- Kill Switch
- Rate Limiting
- Daily Order Limits (MAX_DAILY_ORDERS)
- Position Size Limits (MAX_POSITION_SIZE_USD)

## Testing Checklist

### Before Going Live

1. **Test on Binance Testnet**
   ```bash
   BINANCE_TESTNET=true
   AUTO_ENTRY_ENABLED=true
   AUTO_ENTRY_MODE=SAFE
   ```

2. **Verify TP/SL Placement**
   - Check that STOP_MARKET orders appear on exchange
   - Check that TAKE_PROFIT_MARKET orders appear on exchange
   - Verify prices are correct

3. **Test Order Confirmation Flow**
   - Generate a signal
   - Receive Telegram notification
   - Execute `/confirm ORDER_ID`
   - Verify order execution

4. **Test Order Cancellation**
   - Generate a signal
   - Execute `/cancel ORDER_ID`
   - Verify order removed from queue

5. **Test Order Expiration**
   - Generate a signal
   - Wait 5+ minutes without confirming
   - Verify expiration notification

6. **Test Position Limits**
   - Set MAX_CONCURRENT_POSITIONS=1
   - Open one position
   - Verify no new entries allowed

### Production Deployment

1. **Start with SAFE Mode**
   ```bash
   AUTO_ENTRY_MODE=SAFE
   ```

2. **Use Conservative Risk**
   ```bash
   RISK_PER_TRADE_PERCENT=0.01
   MAX_CONCURRENT_POSITIONS=2
   MIN_CONFIDENCE_SCORE=80
   ```

3. **Enable Gradually**
   - Week 1: SAFE mode, monitor all signals
   - Week 2: SAFE mode, confirm some orders
   - Week 3+: Consider HYBRID mode if comfortable

4. **Monitor Logs**
   ```bash
   tail -f logs/system.log | grep OrderExecutionService
   ```

## Troubleshooting

### "Order execution service not available"

**Cause:** OrderExecutionService not initialized

**Solution:** Ensure AUTO_ENTRY_ENABLED=true in .env and restart system

### "Order not found"

**Cause:** Order ID doesn't match or already expired

**Solution:** Run `/confirm` without ID to list pending orders

### "Order execution failed"

**Possible Causes:**
1. Insufficient balance
2. Invalid position size (too small)
3. Network error
4. Exchange API error

**Solution:** Check logs for detailed error message

### TP/SL orders not appearing

**Cause:** TPSL_MODE set to MANUAL or SL_ONLY

**Solution:** Set TPSL_MODE=AUTO_TPSL in .env

### Orders executing without confirmation

**Cause:** AUTO_ENTRY_MODE set to AUTO or HYBRID with high confidence

**Solution:** Set AUTO_ENTRY_MODE=SAFE for all confirmations

## Best Practices

### Risk Management

1. **Never risk more than 1-2% per trade**
   ```bash
   RISK_PER_TRADE_PERCENT=0.01  # 1%
   ```

2. **Limit concurrent exposure**
   ```bash
   MAX_CONCURRENT_POSITIONS=3
   ```

3. **Use realistic R/R ratios**
   ```bash
   RISK_REWARD_RATIO=2.0  # 1:2 is achievable
   ```

### Signal Quality

1. **Start with high confidence threshold**
   ```bash
   MIN_CONFIDENCE_SCORE=80
   ```

2. **Review signals in SAFE mode first**
   - Understand why system is generating signals
   - Verify signal quality matches your criteria

3. **Track performance**
   - Monitor win rate
   - Track R/R realization
   - Adjust MIN_CONFIDENCE_SCORE accordingly

### Operational Security

1. **Always use Binance Testnet first**
   ```bash
   BINANCE_TESTNET=true
   ```

2. **Set API key restrictions**
   - Enable IP whitelist
   - Only enable "Futures" permissions
   - DISABLE "Enable Withdrawals"

3. **Start small**
   - Use small account balance for testing
   - Increase gradually as confidence builds

4. **Monitor actively**
   - Check Telegram notifications regularly
   - Review exchange order history
   - Verify TP/SL orders are active

## Advanced Configuration

### Custom Order Timeout

```bash
# 10 minutes instead of default 5 minutes
ORDER_CONFIRMATION_TIMEOUT_MS=600000
```

### Different Risk Per Mode

For HYBRID mode, you might want:
```bash
AUTO_ENTRY_MODE=HYBRID
MIN_CONFIDENCE_SCORE=70          # Lower threshold for pending orders
# High-confidence (≥80) will auto-execute
# Medium-confidence (70-79) will require confirmation
```

### Dynamic Account Balance

The system fetches account balance from Binance at runtime, so position sizes adjust automatically as your balance changes.

## API Reference

### OrderExecutionService Events

```typescript
// Order executed in AUTO mode or confirmed in SAFE mode
.on('order:executed', (payload) => {
  suggestion: TradeSuggestion;
  result: ExecutionResult;
})

// Order pending confirmation in SAFE mode
.on('order:pending', (payload) => {
  orderId: string;
  suggestion: TradeSuggestion;
  expiresAt: Date;
})

// Order confirmed via /confirm command
.on('order:confirmed', (payload) => {
  orderId: string;
  suggestion: TradeSuggestion;
  result: ExecutionResult;
})

// Order execution failed
.on('order:failed', (payload) => {
  suggestion: TradeSuggestion;
  error: string;
})

// Order expired without confirmation
.on('order:expired', (payload) => {
  orderId: string;
})

// Order cancelled via /cancel command
.on('order:cancelled', (payload) => {
  orderId: string;
})
```

### TradeSuggestion Type

```typescript
interface TradeSuggestion {
  id: string;                    // Unique order ID
  asset: string;                 // Trading pair (e.g., "BTCUSDT")
  timestamp: Date;               // When signal was generated
  direction: 'LONG' | 'SHORT';   // Trade direction
  entryPrice: number;            // Suggested entry price
  stopLoss: number;              // Stop loss price
  takeProfit: number;            // Take profit price
  positionSizeUsd: number;       // Position size in USD
  leverage: number;              // Leverage to use
  confidenceScore: number;       // 0-100 signal quality
  riskRewardRatio: number;       // R:R ratio
  reasons: string[];             // Why this signal was generated
}
```

## Migration from Manual System

If you're upgrading from the manual-only system:

1. **Update .env**
   - Copy new AUTO-ENTRY section from `.env.example`
   - Keep AUTO_ENTRY_ENABLED=false initially

2. **Test in Parallel**
   - Run system with AUTO_ENTRY_ENABLED=false
   - Monitor signal quality via logs
   - When ready, enable with SAFE mode

3. **Gradual Transition**
   - Week 1: AUTO_ENTRY_ENABLED=false (observe only)
   - Week 2: SAFE mode, manually confirm some orders
   - Week 3+: SAFE mode, confirm most/all orders
   - Optional: HYBRID mode for high-confidence automation

## Support and Feedback

For issues or questions about auto-entry:

1. Check logs: `logs/system.log`
2. Review this guide's Troubleshooting section
3. File an issue on GitHub with:
   - Configuration (redact API keys!)
   - Error messages from logs
   - Steps to reproduce

---

**⚠️ IMPORTANT DISCLAIMER**

This is a decision support tool with execution capabilities. YOU are responsible for:
- Verifying all signals before execution (in SAFE mode)
- Monitoring open positions
- Understanding the risks of automated trading
- Complying with your local regulations

The system is designed with safety features, but no automated system is perfect. Always:
- Start with Binance Testnet
- Use small position sizes initially
- Monitor actively
- Be prepared to use Kill Switch if needed

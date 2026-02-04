# TK Trading System - Complete User Guide

## Table of Contents
1. [Quick Start](#quick-start)
2. [Setup & Configuration](#setup--configuration)
3. [Operating Modes](#operating-modes)
4. [Telegram Commands](#telegram-commands)
5. [Usage Scenarios](#usage-scenarios)
6. [Workflow Examples](#workflow-examples)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Safety & Best Practices](#safety--best-practices)

---

## Quick Start

### What is TK Trading System?

TK Trading System is a **decision support tool** for crypto futures trading. It analyzes market conditions through 4 gates and can:
- **Monitor Mode**: Send you notifications about market opportunities
- **Manual Mode**: Prepare orders for you to execute manually
- **Auto-Entry Mode**: Automatically enter positions (with or without confirmation)

### 3-Minute Setup

1. **Clone and Install**
   ```bash
   git clone <repo-url>
   cd tk-trading-system
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   nano .env  # Edit with your settings
   ```

3. **Minimum Required Settings**
   ```bash
   # Telegram Bot
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHAT_ID=your_chat_id_here
   TELEGRAM_ADMIN_IDS=your_user_id_here

   # Binance (USE TESTNET FIRST!)
   BINANCE_API_KEY=your_testnet_api_key
   BINANCE_API_SECRET=your_testnet_secret
   BINANCE_TESTNET=true

   # Start in safe mode
   EXECUTION_ENABLED=false
   AUTO_ENTRY_ENABLED=false
   ```

4. **Start the Bot**
   ```bash
   npm run dev
   ```

5. **Test on Telegram**
   - Open your Telegram bot
   - Send: `/status BTCUSDT`
   - You should get a market analysis

---

## Setup & Configuration

### 1. Telegram Bot Setup

**Step 1: Create Bot**
1. Message `@BotFather` on Telegram
2. Send `/newbot`
3. Choose a name and username
4. Copy the bot token

**Step 2: Get Your Chat ID**
1. Message `@userinfobot` or `@getidsbot`
2. Copy your user ID

**Step 3: Configure .env**
```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=987654321
TELEGRAM_ADMIN_IDS=987654321
```

### 2. Binance API Setup

**CRITICAL: Always Start with Testnet!**

**Step 1: Get Testnet API Keys**
1. Visit: https://testnet.binancefuture.com
2. Login with your email
3. API Key → Create API Key
4. Save the API Key and Secret

**Step 2: Configure .env**
```bash
BINANCE_API_KEY=your_testnet_key
BINANCE_API_SECRET=your_testnet_secret
BINANCE_TESTNET=true
```

**Step 3: API Key Permissions (For Production)**
- ✅ Enable: Futures Trading
- ✅ Enable: Read Info
- ❌ Disable: Enable Withdrawals
- ✅ Recommended: IP Whitelist

### 3. Operating Mode Configuration

Choose your operating mode by setting these variables:

**Mode 1: Monitor Only (Safest - Start Here)**
```bash
EXECUTION_ENABLED=false
AUTO_ENTRY_ENABLED=false
```
- Bot sends notifications only
- No trading capabilities
- Perfect for testing and learning

**Mode 2: Manual Execution**
```bash
EXECUTION_ENABLED=true
AUTO_ENTRY_ENABLED=false
```
- Bot can prepare orders
- You execute manually via Telegram
- You have full control

**Mode 3: Auto-Entry with Confirmation (Recommended)**
```bash
EXECUTION_ENABLED=true
AUTO_ENTRY_ENABLED=true
AUTO_ENTRY_MODE=SAFE
```
- Bot prepares orders automatically
- Sends you Telegram notification
- You must `/confirm` to execute
- 5-minute expiration

**Mode 4: Auto-Entry Immediate (Advanced)**
```bash
EXECUTION_ENABLED=true
AUTO_ENTRY_ENABLED=true
AUTO_ENTRY_MODE=AUTO
```
- Bot executes trades immediately
- No confirmation required
- ⚠️ High risk - use with caution!

**Mode 5: Hybrid Auto-Entry**
```bash
EXECUTION_ENABLED=true
AUTO_ENTRY_ENABLED=true
AUTO_ENTRY_MODE=HYBRID
```
- High confidence (≥80): Auto-execute
- Medium confidence (60-79): Requires confirmation

---

## Operating Modes

### Mode Comparison Table

| Mode | EXECUTION_ENABLED | AUTO_ENTRY_ENABLED | AUTO_ENTRY_MODE | Risk Level | Use Case |
|------|-------------------|--------------------|-----------------| -----------|----------|
| Monitor | false | false | N/A | ⭐ No Risk | Learning & Testing |
| Manual | true | false | N/A | ⭐⭐ Low Risk | Full Control |
| Safe Auto | true | true | SAFE | ⭐⭐⭐ Medium | Semi-Automated |
| Hybrid | true | true | HYBRID | ⭐⭐⭐⭐ High | Experienced Traders |
| Full Auto | true | true | AUTO | ⭐⭐⭐⭐⭐ Very High | Expert Only |

### TP/SL Configuration

```bash
# AUTO_TPSL: Both TP and SL (Recommended)
TPSL_MODE=AUTO_TPSL

# SL_ONLY: Only Stop Loss
TPSL_MODE=SL_ONLY

# MANUAL: You manage TP/SL yourself
TPSL_MODE=MANUAL
```

### Risk Configuration

**Conservative (Recommended for Beginners)**
```bash
RISK_PER_TRADE_PERCENT=0.01    # 1% risk per trade
RISK_REWARD_RATIO=2.0          # 1:2 R/R
MIN_CONFIDENCE_SCORE=80        # High quality signals only
MAX_CONCURRENT_POSITIONS=2     # Limited exposure
MAX_LEVERAGE=1                 # No leverage
```

**Moderate**
```bash
RISK_PER_TRADE_PERCENT=0.02    # 2% risk
RISK_REWARD_RATIO=2.0          # 1:2 R/R
MIN_CONFIDENCE_SCORE=60        # Medium quality
MAX_CONCURRENT_POSITIONS=3     # Balanced
MAX_LEVERAGE=2                 # 2x leverage
```

**Aggressive**
```bash
RISK_PER_TRADE_PERCENT=0.03    # 3% risk
RISK_REWARD_RATIO=3.0          # 1:3 R/R
MIN_CONFIDENCE_SCORE=50        # Lower threshold
MAX_CONCURRENT_POSITIONS=5     # Higher exposure
MAX_LEVERAGE=5                 # 5x leverage
```

---

## Telegram Commands

### Basic Commands

#### `/status <ASSET>`
Get current market status and permission state.

**Example:**
```
You: /status BTCUSDT

Bot:
━━━━━━━━━━━━━━━━━━━━━━━
📊 MARKET STATUS
BTCUSDT | 2025-02-05 10:00
━━━━━━━━━━━━━━━━━━━━━━━

PRICE: $45,000.00
24h Change: +2.5%

GATES
├ Regime: ✅ PASS (HIGH)
├ Flow: ✅ PASS (HIGH)
├ Risk: ⚠️ CAUTION (MEDIUM)
└ Context: ✅ PASS (HIGH)

PERMISSION: 🟢 TRADE_ALLOWED

ANALYSIS
Whale accumulation detected.
Volatility supports upward move.
Funding rate neutral.

━━━━━━━━━━━━━━━━━━━━━━━
Decision support only.
━━━━━━━━━━━━━━━━━━━━━━━
```

#### `/check <ASSET>`
Quick concise check (lighter version of /status).

**Example:**
```
You: /check ETHUSDT

Bot:
ETHUSDT
Price: $2,500 (+1.2%)
Flow: ACCUMULATION
Vol: LONG_VOL
Permission: TRADE_ALLOWED
```

### Auto-Entry Commands

#### `/confirm [ORDER_ID]`
Confirm and execute a pending order (SAFE mode).

**List pending orders:**
```
You: /confirm

Bot:
Pending Orders:

• a1b2c3d4 - BTCUSDT LONG (expires in 4m)
• e5f6g7h8 - ETHUSDT SHORT (expires in 3m)

Use /confirm ORDER_ID to confirm.
```

**Confirm specific order:**
```
You: /confirm a1b2c3d4

Bot:
✅ Order confirmed and executed!

Entry Order ID: 123456789
Status: FILLED

Check your exchange for details.
```

#### `/cancel <ORDER_ID>`
Cancel a pending order before it expires.

**Example:**
```
You: /cancel a1b2c3d4

Bot:
✅ Order a1b2c3d4 cancelled successfully.
```

### Safety Commands

#### `/killswitch`
Emergency stop - halts all trading immediately.

**Example:**
```
You: /killswitch

Bot:
🛑 KILL SWITCH ACTIVATED

All trading halted.
System in emergency stop.
```

#### `/safety`
Check safety system status.

**Example:**
```
You: /safety

Bot:
🛡️ SAFETY STATUS

Kill Switch: ACTIVE ✅
Circuit Breaker: OK ✅
Rate Limiter: OK ✅
Daily Order Limit: 3/10 ✅

System Status: HEALTHY
```

### Management Commands

#### `/override <ASSET> <REASON>`
Override permission state (requires minimum 20 character reason).

**Example:**
```
You: /override BTCUSDT Strong breakout above resistance with high volume confirmation

Bot:
✅ Override request logged.

Asset: BTCUSDT
Reason: Strong breakout...
Trader: 987654321
Logged at: 2025-02-05 10:00

Manual oversight required.
```

---

## Usage Scenarios

### Scenario 1: First Day Setup (Monitor Mode)

**Goal:** Learn how the system works without risk.

**Configuration:**
```bash
EXECUTION_ENABLED=false
AUTO_ENTRY_ENABLED=false
TRACKED_ASSETS=BTCUSDT,ETHUSDT
```

**Workflow:**
1. Start the bot
2. Wait for notifications
3. Use `/status BTCUSDT` to check manually
4. Observe permission state changes
5. Learn when system suggests trades

**What You'll See:**
- State change notifications
- Permission assessments
- Gate evaluations
- No trading occurs

**Duration:** 1-7 days

### Scenario 2: Testing on Testnet (Safe Auto Mode)

**Goal:** Test auto-entry with fake money.

**Configuration:**
```bash
BINANCE_TESTNET=true
EXECUTION_ENABLED=true
AUTO_ENTRY_ENABLED=true
AUTO_ENTRY_MODE=SAFE
RISK_PER_TRADE_PERCENT=0.01
MIN_CONFIDENCE_SCORE=70
```

**Workflow:**
1. Ensure testnet API keys configured
2. Start bot
3. Wait for signal
4. Receive Telegram notification
5. Review signal quality
6. Use `/confirm ORDER_ID` to execute
7. Check Binance Testnet for orders
8. Verify TP/SL orders are active

**What You'll See:**
```
Bot:
🔔 ORDER CONFIRMATION REQUIRED
BTCUSDT | 2025-02-05 10:30:00

ORDER DETAILS
├ Order ID: a1b2c3d4
├ Direction: LONG
├ Entry Price: $45,000.00
└ Position Size: $1,000.00

RISK MANAGEMENT
├ Stop Loss: $44,100.00
├ Take Profit: $46,800.00
└ R:R Ratio: 1:2.0

Reply with: /confirm a1b2c3d4
⏰ Expires in 5 minutes
```

**Duration:** 1-2 weeks

### Scenario 3: Going Live (Manual + Safe Auto)

**Goal:** Start real trading with maximum control.

**Configuration:**
```bash
BINANCE_TESTNET=false
EXECUTION_ENABLED=true
AUTO_ENTRY_ENABLED=true
AUTO_ENTRY_MODE=SAFE
RISK_PER_TRADE_PERCENT=0.01
MIN_CONFIDENCE_SCORE=80
MAX_CONCURRENT_POSITIONS=2
```

**Workflow:**
1. Switch to production API keys
2. ⚠️ Double-check BINANCE_TESTNET=false
3. Start with small account balance
4. Monitor first signal closely
5. Confirm via `/confirm`
6. Check exchange immediately
7. Verify TP/SL placement
8. Monitor position until close

**First Week Checklist:**
- [ ] Test with 1 trade only
- [ ] Verify TP/SL orders appear
- [ ] Check actual vs expected prices
- [ ] Monitor fills and execution
- [ ] Review logs daily
- [ ] Track P&L accuracy

### Scenario 4: Experienced Trader (Hybrid Mode)

**Goal:** Automate high-quality signals, review medium ones.

**Configuration:**
```bash
BINANCE_TESTNET=false
AUTO_ENTRY_MODE=HYBRID
MIN_CONFIDENCE_SCORE=60
```

**How It Works:**
- Signal with 85 confidence → Auto-execute immediately
- Signal with 65 confidence → Requires `/confirm`
- Signal with 55 confidence → Ignored (below threshold)

**Workflow:**
1. High-confidence signals execute automatically
2. Medium-confidence signals require confirmation
3. You get notification for both
4. Can `/cancel` any pending order

### Scenario 5: Position Management

**Managing Active Positions:**

**Check position status:**
```
You: /status BTCUSDT

Bot: (shows current position if any)
```

**Close position manually:**
```
You: /prepare_close BTCUSDT

Bot:
Prepared close order for BTCUSDT
Current position: LONG 0.02 BTC
Confirm to close at market price
```

**Adjust TP/SL manually:**
- Go to Binance exchange
- Find your STOP_MARKET and TAKE_PROFIT_MARKET orders
- Cancel and replace with new prices

---

## Workflow Examples

### Example 1: Complete Auto-Entry Flow (SAFE Mode)

**Timeline:**

**10:00 AM** - System evaluates BTCUSDT
- Flow Gate: ACCUMULATION detected
- Regime Gate: LONG_VOL confirmed
- Risk Gate: Funding neutral
- Context Gate: High volume
- Permission: TRADE_ALLOWED ✅

**10:01 AM** - Signal Generated
- Direction: LONG
- Entry: $45,000
- Stop Loss: $44,100 (2% below)
- Take Profit: $46,800 (4% above, 1:2 R/R)
- Position Size: $1,000 (1% of $100k account)
- Confidence: 75/100

**10:01 AM** - Order Queued (Pending)
- System creates pending order
- Order ID: a1b2c3d4
- Expiration: 5 minutes

**10:02 AM** - Telegram Notification
```
🔔 ORDER CONFIRMATION REQUIRED
BTCUSDT | 2025-02-05 10:02

ORDER DETAILS
├ Order ID: a1b2c3d4
├ Direction: LONG
├ Entry Price: $45,000.00
└ Position Size: $1,000.00

RISK MANAGEMENT
├ Stop Loss: $44,100.00
├ Take Profit: $46,800.00
└ R:R Ratio: 1:2.0

CONFIDENCE: 75/100

REASONS
• Whale accumulation detected
• Long volatility stance
• Funding rate neutral

Reply: /confirm a1b2c3d4
⏰ Expires in 5 minutes
```

**10:03 AM** - You Review & Confirm
```
You: /confirm a1b2c3d4
```

**10:03 AM** - Order Execution
1. Entry order placed (MARKET BUY)
2. Order fills at $45,010 (slight slippage)
3. Quantity: 0.0222 BTC
4. Stop Loss order placed (STOP_MARKET at $44,100)
5. Take Profit order placed (TAKE_PROFIT_MARKET at $46,800)

**10:04 AM** - Execution Confirmation
```
✅ ORDER EXECUTED
BTCUSDT | 2025-02-05 10:04

POSITION
├ Direction: LONG
├ Entry Price: $45,010.00
├ Position Size: $1,000.00
└ Order ID: 123456789

RISK MANAGEMENT
├ Stop Loss: $44,100.00
├ Take Profit: $46,800.00
└ R:R Ratio: 1:2.0

EXECUTION DETAILS
├ Filled: 0.0222 BTC
├ Avg Price: $45,010.00
└ Status: FILLED

Position opened. TP/SL orders active.
```

**Later** - Position Closes
- If price hits $46,800 → TP triggers, profit realized
- If price hits $44,100 → SL triggers, loss limited
- You can also manually close anytime

### Example 2: Order Expiration

**10:00 AM** - Signal generated, notification sent

**10:00 - 10:05 AM** - You're busy, don't see notification

**10:06 AM** - Order expires
```
⏰ ORDER EXPIRED
2025-02-05 10:06

ORDER ID: a1b2c3d4

STATUS
Order confirmation timeout reached.
Order has been automatically cancelled.

No action taken. Order expired.
```

**Result:** No trade executed, no risk taken

### Example 3: Cancelling Unwanted Order

**10:00 AM** - Signal generated
```
🔔 ORDER CONFIRMATION REQUIRED
Order ID: a1b2c3d4
BTCUSDT LONG
...
```

**10:01 AM** - You check market, don't like setup
```
You: /cancel a1b2c3d4

Bot:
✅ Order a1b2c3d4 cancelled successfully.
```

**Result:** Order cancelled, no execution

### Example 4: Multiple Concurrent Positions

**Configuration:**
```bash
MAX_CONCURRENT_POSITIONS=3
```

**Current State:**
- BTCUSDT LONG (active)
- ETHUSDT SHORT (active)
- SOLUSDT LONG (active)

**New Signal:** BNBUSDT LONG

**System Response:**
- Signal generated but not queued
- Log message: "Max concurrent positions reached"
- No notification sent

**To Allow New Position:**
- Wait for one position to close
- Or manually close a position
- Then new signals can be processed

---

## Monitoring & Maintenance

### Daily Monitoring Checklist

**Morning (Before Trading Day)**
- [ ] Check bot is running: `npm run dev`
- [ ] Verify API connectivity: Check logs
- [ ] Review safety status: `/safety`
- [ ] Check open positions on exchange
- [ ] Verify TP/SL orders are active

**During Trading**
- [ ] Respond to notifications promptly
- [ ] Review signal quality before confirming
- [ ] Monitor position P&L
- [ ] Watch for anomalies in logs

**Evening (After Trading Day)**
- [ ] Review day's trades
- [ ] Check P&L vs expected
- [ ] Review logs for errors
- [ ] Backup configuration
- [ ] Update risk settings if needed

### Log Monitoring

**View real-time logs:**
```bash
# All logs
tail -f logs/system.log

# Order execution only
tail -f logs/system.log | grep OrderExecutionService

# Errors only
tail -f logs/system.log | grep ERROR
```

**What to look for:**
- ✅ "Order executed successfully"
- ⚠️ "Order execution failed"
- ⚠️ "Rate limit reached"
- 🛑 "API error"
- 🛑 "Circuit breaker triggered"

### Performance Tracking

**Track in spreadsheet:**
- Date/Time
- Asset
- Direction
- Entry Price
- Exit Price
- P&L (USD)
- P&L (%)
- Confidence Score
- Notes

**Calculate:**
- Win Rate = Wins / Total Trades
- Average R:R Realized
- Max Drawdown
- Sharpe Ratio (if you're fancy)

### Backup & Recovery

**What to backup daily:**
```bash
# Configuration
cp .env .env.backup.$(date +%Y%m%d)

# Logs
cp logs/system.log logs/archive/system.$(date +%Y%m%d).log
```

**In case of crash:**
1. Check logs for error
2. Verify open positions on exchange
3. Manually close positions if needed
4. Restart bot
5. Verify reconnection

---

## Troubleshooting

### Common Issues

#### Bot not starting

**Error:** `Cannot find module '@/types'`

**Solution:**
```bash
# Imports were fixed, update your code
git pull
npm install
```

**Error:** `Invalid environment variable`

**Solution:**
```bash
# Check .env file exists
ls -la .env

# Verify all required variables set
cat .env | grep TELEGRAM_BOT_TOKEN
cat .env | grep BINANCE_API_KEY
```

#### No notifications received

**Possible causes:**
1. Wrong TELEGRAM_CHAT_ID
2. Wrong TELEGRAM_ADMIN_IDS
3. Bot not started
4. No signals generated

**Debug:**
```
You: /status BTCUSDT
```
If no response → Bot not running or wrong chat ID

#### Orders not executing

**Check configuration:**
```bash
# Must be true for auto-entry
AUTO_ENTRY_ENABLED=true

# Must be true for any execution
EXECUTION_ENABLED=true
```

**Check confidence threshold:**
```bash
# If signal confidence is 65 but threshold is 80
MIN_CONFIDENCE_SCORE=80  # Too high!
# Lower to 60
MIN_CONFIDENCE_SCORE=60
```

#### TP/SL orders not appearing

**Check mode:**
```bash
# Must be AUTO_TPSL
TPSL_MODE=AUTO_TPSL
```

**Verify on exchange:**
1. Go to Binance Futures
2. Open Orders tab
3. Look for STOP_MARKET and TAKE_PROFIT_MARKET
4. Should see 2 orders per position

#### "Order execution failed"

**Common causes:**
1. Insufficient balance
2. Position size too small (below minimum)
3. Network error
4. API key permissions wrong

**Check logs:**
```bash
tail -f logs/system.log | grep "execution failed"
```

Look for specific error message.

---

## Safety & Best Practices

### Risk Management Rules

**Rule 1: Never Risk More Than 1-2% Per Trade**
```bash
RISK_PER_TRADE_PERCENT=0.01  # 1% maximum
```

**Why:**
- 10 losses in a row = only 10% drawdown
- Allows recovery
- Prevents emotional decisions

**Rule 2: Limit Concurrent Exposure**
```bash
MAX_CONCURRENT_POSITIONS=2  # Start small
```

**Why:**
- Reduces correlation risk
- Easier to monitor
- Less mental load

**Rule 3: Use Realistic R:R Ratios**
```bash
RISK_REWARD_RATIO=2.0  # 1:2 is achievable
```

**Why:**
- 1:3 or higher may not reach TP
- 1:2 is balanced and realistic
- Focus on consistency, not home runs

**Rule 4: Start Conservative**
```bash
MIN_CONFIDENCE_SCORE=80  # High quality only
```

**Why:**
- Learn what high-quality signals look like
- Build confidence
- Can lower later as you improve

### Security Best Practices

**API Key Security:**
- ✅ Use IP whitelist
- ✅ Restrict to Futures only
- ❌ Never enable withdrawals
- ✅ Use separate keys for testnet/production
- ✅ Rotate keys monthly

**Bot Security:**
- ✅ Keep .env in .gitignore
- ✅ Never commit API keys
- ✅ Use environment variables only
- ✅ Restrict Telegram to your user ID only

**Operational Security:**
- ✅ Always test on testnet first
- ✅ Start with small balance
- ✅ Monitor actively during first week
- ✅ Use kill switch if unsure
- ✅ Review all signals in SAFE mode

### Progressive Deployment

**Week 1: Monitor Mode**
```bash
EXECUTION_ENABLED=false
AUTO_ENTRY_ENABLED=false
```
- Observe signals
- Learn system behavior
- Build confidence

**Week 2-3: Testnet Safe Mode**
```bash
BINANCE_TESTNET=true
EXECUTION_ENABLED=true
AUTO_ENTRY_ENABLED=true
AUTO_ENTRY_MODE=SAFE
RISK_PER_TRADE_PERCENT=0.01
```
- Test with fake money
- Practice confirming orders
- Verify TP/SL placement

**Week 4-5: Production Safe Mode (Small)**
```bash
BINANCE_TESTNET=false
# Start with $500-1000 max
# RISK_PER_TRADE_PERCENT=0.01 = $5-10 per trade
```
- Real money, full control
- Confirm every order
- Monitor closely

**Week 6+: Gradual Scaling**
- Increase balance gradually
- Consider HYBRID mode if confident
- Track performance metrics
- Adjust based on results

### Emergency Procedures

**If Something Goes Wrong:**

1. **Stop the bot immediately**
   ```bash
   # Press Ctrl+C in terminal
   # Or
   /killswitch on Telegram
   ```

2. **Check open positions**
   - Go to Binance exchange
   - Review open positions
   - Check TP/SL orders

3. **Close positions if needed**
   - Use exchange directly
   - Or use `/prepare_close ASSET`

4. **Review logs**
   ```bash
   tail -100 logs/system.log
   ```

5. **Fix issue before restarting**
   - Review error messages
   - Check configuration
   - Verify API keys
   - Test on testnet

6. **Restart carefully**
   ```bash
   npm run dev
   ```

7. **Monitor closely**
   - Watch first few cycles
   - Verify normal operation
   - Check notifications working

---

## Advanced Topics

### Custom Risk Configurations

**Scaling Based on Confidence:**

Manually adjust per signal:
- Confidence 90+: Use 2% risk
- Confidence 70-89: Use 1% risk
- Confidence <70: Skip

Currently requires manual intervention. Auto-scaling not implemented.

### Integration with External Tools

**Export to TradingView:**
- Log signals to CSV
- Import to TradingView for backtesting
- Refine MIN_CONFIDENCE_SCORE

**Webhook Alerts:**
- System emits events
- Can integrate with Discord/Slack
- Requires custom development

### Multi-Account Management

**NOT RECOMMENDED** but possible:

Run multiple instances:
```bash
# Account 1
PORT=3001 TELEGRAM_BOT_TOKEN=xxx npm run dev

# Account 2
PORT=3002 TELEGRAM_BOT_TOKEN=yyy npm run dev
```

Issues:
- More complex to monitor
- Higher risk of mistakes
- Harder to manage

Better: Use one bot with larger capital.

---

## FAQ

**Q: Can I run this 24/7?**
A: Yes, but use a VPS or dedicated server for reliability.

**Q: What if I miss a confirmation?**
A: Order expires after 5 minutes, no trade executed.

**Q: Can I modify TP/SL after entry?**
A: Yes, on Binance exchange directly. Cancel and replace orders.

**Q: What happens if bot crashes?**
A: Open positions remain on exchange. TP/SL orders stay active. Restart bot.

**Q: How do I backtest?**
A: Monitor mode for 2-4 weeks, log signals, analyze retroactively.

**Q: Can I use spot trading?**
A: No, designed for futures only.

**Q: What's the win rate?**
A: Varies by configuration. Track yours. Aim for 50%+ with 1:2 R/R.

**Q: Is this profitable?**
A: Depends on market conditions, your settings, and discipline. No guarantees.

**Q: Can I modify the strategy?**
A: Yes, it's open source. Modify gate logic, risk calculations, etc.

---

## Getting Help

**Before Asking for Help:**
1. Read this guide thoroughly
2. Check [AUTO_ENTRY_GUIDE.md](AUTO_ENTRY_GUIDE.md)
3. Review logs for error messages
4. Search GitHub issues

**When Reporting Issues:**
Include:
- Configuration (redact API keys!)
- Error messages from logs
- Steps to reproduce
- Expected vs actual behavior

**Resources:**
- GitHub Issues: [repo-url]/issues
- Documentation: `/docs` folder
- Logs: `logs/system.log`

---

## Summary Cheat Sheet

### Quick Command Reference

```
/status BTCUSDT      - Full market analysis
/check BTCUSDT       - Quick check
/confirm             - List pending orders
/confirm a1b2c3d4    - Confirm order
/cancel a1b2c3d4     - Cancel order
/killswitch          - Emergency stop
/safety              - Check safety status
```

### Recommended Starting Configuration

```bash
# Binance (TESTNET!)
BINANCE_TESTNET=true

# Execution
EXECUTION_ENABLED=true
AUTO_ENTRY_ENABLED=true
AUTO_ENTRY_MODE=SAFE

# TP/SL
TPSL_MODE=AUTO_TPSL

# Risk (Conservative)
RISK_PER_TRADE_PERCENT=0.01
RISK_REWARD_RATIO=2.0
MIN_CONFIDENCE_SCORE=80
MAX_CONCURRENT_POSITIONS=2
MAX_LEVERAGE=1
```

### Daily Workflow

1. Morning: Check bot running, review positions
2. During day: Respond to notifications, confirm orders
3. Evening: Review performance, check logs
4. Weekly: Analyze trades, adjust settings

---

**Remember:**
- Start with Testnet
- Use SAFE mode initially
- Risk only 1% per trade
- Monitor actively
- Track your performance
- Be patient and disciplined

Good trading! 🚀

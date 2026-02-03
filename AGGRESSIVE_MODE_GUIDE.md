# Aggressive Mode Guide - Safe Risk Management

**Status:** ✅ EXECUTION_ENABLED and AUTO_PROTECT_GLOBALLY_ENABLED now active

---

## Overview

You now have access to three execution modes that allow more aggressive action while maintaining the safety framework.

---

## Mode 1: Semi-Auto Execution (Mode B)

### What It Does
- You request order preparation from the bot
- System validates all Tier 1 constraints
- System prepares the order (doesn't send it yet)
- You confirm execution manually
- System executes immediately on Binance

### How to Use It

```
1. Monitor bot messages for permission state changes
2. When you see an opportunity, prepare an order:

   /prepare_reduce BTCUSDT size: 50% reason: Permission downgraded to WAIT

   OR

   /prepare_close BTCUSDT size: 100% reason: Risk Gate FAIL

3. System responds with order details and ORDER_ID
4. Review the prepared order
5. Confirm execution:

   /confirm ORDER_ID

6. System executes on Binance immediately
7. System reports execution result
```

### Key Advantages
- ✅ **Fast execution** (seconds, not minutes)
- ✅ **Framework enforcement** (Tier 1 constraints still apply)
- ✅ **Full control** (you decide size, timing, reason)
- ✅ **Auditable** (all actions logged)

### Example Flow
```
You: /prepare_reduce BTCUSDT size: 40% reason: Flow FAIL detected

Bot: ✅ Order Prepared
     Symbol: BTCUSDT
     Side: SELL
     Type: MARKET
     Quantity: 0.4 BTC (estimated)
     
     ID: prep_abc123def456
     Valid until: 13:45:30 UTC
     
     Confirm with: /confirm prep_abc123def456

You: /confirm prep_abc123def456

Bot: ⚡ Execution Complete
     Order ID: binance_12345678
     Symbol: BTCUSDT
     Side: SELL
     Quantity: 0.4 BTC
     Avg Price: $42,500
     Status: FILLED
```

---

## Mode 2: Auto-Protect (Mode C)

### What It Does
- You opt-in a position for automatic protection
- System monitors Risk Gate and Permission State
- If conditions meet ALL of these:
  1. You have an open position
  2. Permission State = NO_TRADE
  3. Risk Gate = FAIL
  4. You opted-in for Auto-Protect
- System executes your predefined action: CLOSE or REDUCE_50

### How to Enable Auto-Protect

```
Enable it for a specific asset:

/enable_autoprotect BTCUSDT CLOSE

This means: "If all conditions met, automatically CLOSE my BTCUSDT position"

OR

/enable_autoprotect ETHUSDT REDUCE_50

This means: "If all conditions met, automatically reduce my ETHUSDT by 50%"
```

### Key Safeguards
- ✅ **Cannot open positions** (defensive only)
- ✅ **Cannot increase exposure** (reduce or close only)
- ✅ **Requires explicit opt-in** (per position, per asset)
- ✅ **Only on Tier 1 failures** (NO_TRADE + RISK_GATE_FAIL)
- ✅ **Immediately notified** (alert sent before execution)

### Disable Auto-Protect When Not Needed
```
/disable_autoprotect BTCUSDT

This removes Auto-Protect from BTCUSDT positions.
```

---

## Mode 3: Manual Override

### What You Can Override

**Level 1 (No Cooling-Off):**
- SCALP_ONLY → Can size normally
- WAIT → Can take positions
- TRADE_ALLOWED_REDUCED_RISK → Can increase size

**Level 2 (4-Hour Cooling-Off):**
- NO_TRADE (Regime FAIL only) → Can trade
- Max 3 Level 2 overrides per day

### How to Use
```
/override BTCUSDT Your detailed reason here must be at least 20 characters

Bot logs it and acknowledges:
✅ Override request logged.
Asset: BTCUSDT
Reason: Your detailed reason
⚠️ You are proceeding outside system assessment.
This is logged for review.
```

---

## Recommended Aggressive Strategy

### Strategy 1: Conservative Semi-Auto
- Use `/prepare_reduce` only when Framework says WAIT or SCALP_ONLY
- Prepare orders in advance, confirm manually
- **Pros:** Full control, fast execution, framework guidance
- **Cons:** Requires active monitoring

### Strategy 2: Protected + Semi-Auto
- Enable Auto-Protect on core positions (BTCUSDT, ETHUSDT)
- Use Semi-Auto for tactical adds/reduces
- Enable Level 1 overrides for SCALP_ONLY conditions
- **Pros:** Defensive safety + tactical agility
- **Cons:** More active management

### Strategy 3: Hybrid Aggressive
- Auto-Protect on major positions (defensive)
- Semi-Auto for 30-50% reduce orders (tactical)
- Level 2 overrides for NO_TRADE Regime failures (strategic)
- **Pros:** Maximum flexibility within framework
- **Cons:** Requires high discipline

---

## Real-Time Workflow

### Typical Day

```
09:00 UTC - System starts, begins evaluating gates
09:05 UTC - BTCUSDT Permission State changes to SCALP_ONLY
           Bot sends alert

09:05 UTC - You review conditions, see Flow = FAIL but Risk = PASS
09:06 UTC - You prepare a 20% reduce order
           /prepare_reduce BTCUSDT size: 20% reason: Flow FAIL

09:06 UTC - Bot shows prepared order, you review
09:07 UTC - You confirm
           /confirm prep_xyz789

09:07 UTC - Order executes on Binance
09:08 UTC - Bot reports: FILLED at $42,450, 0.2 BTC

09:30 UTC - Risk Gate fails, Permission State = NO_TRADE
           Bot sends ALERT

09:30 UTC - If Auto-Protect enabled and position open:
           Bot executes predefined action (CLOSE or REDUCE_50)
           Bot sends execution report

09:31 UTC - Position protected, you review result
```

---

## Safety Limits (Can Be Adjusted)

Current settings in .env:
- **MAX_POSITION_SIZE_USD:** $10,000 per order
- **MAX_DAILY_ORDERS:** 10 orders per 24 hours
- **ORDER_CONFIRMATION_TIMEOUT:** 5 minutes (orders expire)

To adjust:
```env
# In .env file, change these values:
MAX_POSITION_SIZE_USD=20000      # Increase to $20K per order
MAX_DAILY_ORDERS=20              # Increase to 20 orders/day
ORDER_CONFIRMATION_TIMEOUT_MS=600000  # Increase to 10 minutes
```

---

## Tier 1 Constraints (Cannot Override)

These **ALWAYS** block execution, even in aggressive mode:

- ❌ Risk Gate = FAIL + Extreme Crowding
- ❌ Risk Gate = FAIL + Price in Stress Range
- ❌ Critical Data Quality Failure
- ❌ Altcoin without BTC permission
- ❌ Kill Switch active

---

## Telegram Commands Reference

```
/status [ASSET]
├─ Shows permission state, gate results, explanation
├─ Example: /status BTCUSDT
└─ Response: Full assessment with all gate statuses

/prepare_reduce ASSET size: PCT% reason: TEXT
├─ Prepares a REDUCE order
├─ Example: /prepare_reduce BTCUSDT size: 30% reason: Flow FAIL
└─ Returns: Prepared order details + ORDER_ID

/prepare_close ASSET size: PCT% reason: TEXT
├─ Prepares a CLOSE order (usually 100%)
├─ Example: /prepare_close BTCUSDT size: 100% reason: Risk FAIL
└─ Returns: Prepared order details + ORDER_ID

/confirm ORDER_ID
├─ Confirms and executes prepared order
├─ Example: /confirm prep_abc123def456
└─ Returns: Execution result on Binance

/cancel ORDER_ID
├─ Cancels a prepared order before confirmation
├─ Example: /cancel prep_abc123def456
└─ Returns: Cancellation confirmation

/override ASSET reason
├─ Override permission state (Levels 1-2 only)
├─ Example: /override BTCUSDT Permission appears too strict now
└─ Returns: Override logged, audit entry created

/enable_autoprotect ASSET ACTION
├─ Enable Auto-Protect for position
├─ ACTION: CLOSE or REDUCE_50
├─ Example: /enable_autoprotect BTCUSDT CLOSE
└─ Returns: Auto-Protect enabled confirmation

/disable_autoprotect ASSET
├─ Disable Auto-Protect for asset
├─ Example: /disable_autoprotect BTCUSDT
└─ Returns: Auto-Protect disabled confirmation

/safety
├─ Check system safety status
├─ Shows: Kill Switch, Rate Limit, Circuit Breaker, Can Execute
└─ Response: Current safety system state

/killswitch
├─ ⚠️ EMERGENCY: Suspends all operations
├─ Use only for emergencies
└─ Requires manual restart
```

---

## Monitoring Checklist

Daily:
- [ ] Check bot morning status message
- [ ] Review any overnight permission state changes
- [ ] Verify gate evaluation accuracy
- [ ] Check safety system status with `/safety`

Before trading:
- [ ] Request `/status` for your asset
- [ ] Review all four gate statuses
- [ ] Check confidence levels
- [ ] Read the explanation section

After execution:
- [ ] Verify execution price vs expected
- [ ] Check audit log entry was created
- [ ] Review remaining order capacity

---

## Troubleshooting

**Problem:** "Order not prepared" when using /prepare_reduce

**Solution:** Check:
1. Permission state must allow ANY trading (not NO_TRADE)
2. Asset must be in TRACKED_ASSETS
3. Size must be valid (1-100%)
4. Reason must be at least 10 characters

---

**Problem:** Auto-Protect didn't execute but conditions met

**Solution:** Check:
1. AUTO_PROTECT_GLOBALLY_ENABLED=true in .env
2. Position must be open (use your exchange to verify)
3. Permission State = NO_TRADE AND Risk Gate = FAIL (both required)
4. You ran /enable_autoprotect for that asset

---

**Problem:** "Execution blocked" when confirming order

**Solution:** One of these gates failed:
1. EXECUTION_ENABLED = false (enable in .env)
2. Kill Switch is active (use /killswitch to reset)
3. Rate limit exceeded (wait for window to reset)
4. Tier 1 constraint violated (review permission state)

---

## Next Steps

1. **Test on Testnet First**
   - BINANCE_TESTNET=true (already set)
   - Practice with fake money
   - Verify all commands work

2. **Enable One Mode at a Time**
   - Start with Semi-Auto only
   - Get comfortable with flow
   - Add Auto-Protect after 1 week

3. **Monitor Closely**
   - First week: Daily reviews
   - Second week: 3x daily reviews
   - After: As needed

4. **Document Your Rules**
   - When do you prepare orders?
   - What size do you reduce?
   - When do you override?
   - Keep written log of decisions

---

## Questions?

Refer to:
- `/status` - For current market assessment
- `/safety` - For system health check
- TECHNICAL_DOCUMENTATION.md - For framework details
- .env comments - For configuration options

---

**Last Updated:** February 4, 2026
**Enabled Features:** Semi-Auto (Mode B), Auto-Protect (Mode C), Level 1-2 Overrides

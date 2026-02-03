# TK Trading Decision Support System

## Technical Documentation

**Version:** 1.0.0  
**Last Updated:** 2024  
**Classification:** Internal Technical Documentation

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Framework Philosophy](#2-framework-philosophy)
3. [Gate Evaluation System](#3-gate-evaluation-system)
4. [Permission State Engine](#4-permission-state-engine)
5. [Execution Modes](#5-execution-modes)
6. [Human Override System](#6-human-override-system)
7. [Safety Architecture](#7-safety-architecture)
8. [API Reference](#8-api-reference)
9. [Telegram Message Specifications](#9-telegram-message-specifications)
10. [Audit & Logging](#10-audit--logging)
11. [Deployment Guide](#11-deployment-guide)
12. [Appendix](#appendix)

---

## 1. System Overview

### 1.1 Purpose

The TK Trading Decision Support System is designed to provide context-driven permission states for human traders. It implements a semi-automated framework where:

- The system **evaluates** market conditions
- The system **calculates** permission states
- The system **explains** its assessments
- The **human** makes all trading decisions
- The **human** confirms all executions

### 1.2 Core Principles (Non-Negotiable)

| Principle                      | Implementation                                  |
| ------------------------------ | ----------------------------------------------- |
| **Insight > Signal**           | System provides context, not buy/sell signals   |
| **Explanation > Optimization** | Focus on clarity, not performance metrics       |
| **Permission > Direction**     | States indicate what's allowed, not recommended |
| **Human Final Authority**      | All execution requires explicit confirmation    |

### 1.3 What the System Cannot Do

Per the Phase 2 Framework, these are **permanently prohibited**:

- Entry/exit signal generation
- Position sizing decisions
- Direction recommendations
- New position opening (automated)
- Regime state transitions (automated)
- Conflicting signal resolution

---

## 2. Framework Philosophy

### 2.1 The TK Trading Philosophy

The system is based on the TK Trading Guidebook principle:

> "Follow Big Player behavior rather than trying to outsmart them."

### 2.2 Three Backbone Questions

1. **Where is money flowing?** (Flow analysis)
2. **What is it doing?** (Behavior analysis)
3. **What should I do?** (Human decision)

Note: The system helps answer questions 1 and 2. Question 3 is always answered by the human.

### 2.3 Data Hierarchy

```
BTC/ETH (Macro Engine):
├── Option Layer (Big Player game plan)
├── Whale Spot/Perp (Actual execution)
└── Future Layer (Leverage positioning)

Altcoin (Micro Engine):
├── On-chain by Label (Whale/Smart Money tracking)
├── CEX Token-level (Volume quality)
└── BTC/ETH Context (Regime dependency)
```

---

## 3. Gate Evaluation System

### 3.1 Four-Gate Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GATE EVALUATION HIERARCHY                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GATE 1: REGIME (Gatekeeper)                                    │
│  ├── Establishes macro context                                  │
│  ├── Inputs: Option term structure, Comfort/Stress Range        │
│  └── Output: Qualitative state filter                           │
│                                                                  │
│  GATE 2: FLOW (Liquidity & Smart Money)                         │
│  ├── Determines what capital is doing                           │
│  ├── Inputs: CVD Whale, Label balances, Exchange Netflow        │
│  └── Output: Directional flow bias + quality score              │
│                                                                  │
│  GATE 3: RISK (Context & Eligibility)                           │
│  ├── Assesses positioning and leverage                          │
│  ├── Inputs: OI, Funding, Liquidation Heatmap                   │
│  └── Output: Risk state for position sizing                     │
│                                                                  │
│  GATE 4: CONTEXT (Execution Awareness)                          │
│  ├── Provides spatial context                                   │
│  ├── Inputs: Whale VWAP+Band, Bubble clusters                   │
│  └── Output: Reference zones (NOT signals)                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Gate Status Definitions

| Status        | Symbol | Meaning                      |
| ------------- | ------ | ---------------------------- |
| **PASS**      | ✅     | Gate conditions fully met    |
| **WEAK_PASS** | ⚠️     | Conditions met with concerns |
| **FAIL**      | ❌     | Gate conditions not met      |

### 3.3 Confidence Levels

| Level      | Meaning                                         |
| ---------- | ----------------------------------------------- |
| **HIGH**   | Multiple consistent data sources, clear signals |
| **MEDIUM** | Data present but some ambiguity                 |
| **LOW**    | Sparse data or conflicting indicators           |

### 3.4 Gate 1: Regime Evaluation

**Purpose:** Establish macro context governing all decisions.

**Inputs:**

- Option term structure
- Vol stance (Long Vol vs Short Vol)
- Comfort/Stress Range identification
- Key expiry dates

**Status Determination:**

| Status    | Condition                                               |
| --------- | ------------------------------------------------------- |
| PASS      | Clear Vol stance identified, Comfort Range identifiable |
| WEAK_PASS | Vol stance present but weak conviction                  |
| FAIL      | No clear Vol stance, Range not identifiable             |

**Output Fields:**

- `volStance`: LONG_VOL | SHORT_VOL | UNCLEAR
- `comfortRange`: { lower, upper } | null
- `pricePosition`: INSIDE_COMFORT | AT_BOUNDARY | IN_STRESS | UNKNOWN
- `keyExpiries`: Array of upcoming expiry events

### 3.5 Gate 2: Flow Evaluation

**Purpose:** Determine what capital is actually doing.

**Inputs:**

- CVD Whale (24H and 7D)
- CVD/Volume ratio
- Whale VWAP position
- Bubble signals

**Status Determination:**

| Status    | Condition                                                |
| --------- | -------------------------------------------------------- |
| PASS      | Whale flow aligns with Regime, CVD/Volume > 0.3-0.4      |
| WEAK_PASS | Flow direction present but timeframe divergence          |
| FAIL      | Flow contradicts Regime OR Retail-driven (CVD/Vol < 0.1) |

**Output Fields:**

- `flowDirection`: ACCUMULATION | DISTRIBUTION | NEUTRAL | UNCLEAR
- `flowQuality`: WHALE_DRIVEN | MIXED | RETAIL_DRIVEN
- `cvdWhale`: { h24, d7, alignment }
- `whaleVwapPosition`: { priceVsVwap, bandPosition }

### 3.6 Gate 3: Risk Evaluation

**Purpose:** Assess if positioning permits new exposure.

**Inputs:**

- Open Interest (OI) trend
- Funding Rate
- Liquidation clusters
- Stress Range position

**Status Determination:**

| Status    | Condition                                         |
| --------- | ------------------------------------------------- |
| PASS      | OI/Funding not crowded, Price not in Stress Range |
| WEAK_PASS | One risk factor present but not extreme           |
| FAIL      | Extreme crowding OR Price in Stress Range         |

**Critical:** Risk Gate FAIL is a **Tier 1 Constraint** and blocks all trading.

**Output Fields:**

- `oiTrend`: EXPANDING | STABLE | CONTRACTING
- `fundingBias`: LONG_CROWDED | SHORT_CROWDED | BALANCED
- `crowdingLevel`: EXTREME | ELEVATED | NORMAL | LOW
- `stressRangeStatus`: OUTSIDE | AT_BOUNDARY | INSIDE

### 3.7 Gate 4: Context Evaluation

**Purpose:** Provide spatial context for trade decisions (NOT signals).

**Inputs:**

- Whale VWAP and bands
- Price position relative to zones
- Zone/Flow alignment

**Status Determination:**

| Status    | Condition                                   |
| --------- | ------------------------------------------- |
| PASS      | Price in acceptable zone, Zone/Flow aligned |
| WEAK_PASS | Price at boundary, weak alignment           |
| FAIL      | Misalignment between zone position and flow |

**Output Fields:**

- `currentZone`: ACCUMULATION_ZONE | NEUTRAL_ZONE | DISTRIBUTION_ZONE
- `priceVsWhaleVwap`: DISCOUNT | FAIR | PREMIUM
- `zoneFlowAlignment`: ALIGNED | NEUTRAL | MISALIGNED

---

## 4. Permission State Engine

### 4.1 State Calculation Logic

```
PERMISSION STATE CALCULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INPUT: Gate Evaluations (Regime, Flow, Risk, Context)

STEP 1: Check for Hard Failures
├── IF Regime = FAIL → NO_TRADE
├── IF Risk = FAIL → NO_TRADE
└── IF (Flow = FAIL AND Context = FAIL) → NO_TRADE

STEP 2: Check for Transitional State
├── IF Multiple WEAK_PASS (≥3 gates) → WAIT
└── IF High severity conflicts detected → WAIT

STEP 3: Check Flow Quality
└── IF Flow = FAIL OR WEAK_PASS → SCALP_ONLY

STEP 4: Check for Risk Factors
├── IF any gate = WEAK_PASS → TRADE_ALLOWED_REDUCED_RISK
└── IF all gates = PASS → TRADE_ALLOWED

OUTPUT: Permission State + Explanation
```

### 4.2 Permission State Definitions

| State                          | Description               | Expected Behavior                |
| ------------------------------ | ------------------------- | -------------------------------- |
| **TRADE_ALLOWED**              | All gates pass            | Full discretion on sizing/timing |
| **TRADE_ALLOWED_REDUCED_RISK** | Risk factors present      | Reduce position size             |
| **SCALP_ONLY**                 | Flow quality insufficient | Short-term only if any           |
| **WAIT**                       | Transitional conditions   | No new positions                 |
| **NO_TRADE**                   | Critical failures         | Framework blocks exposure        |

### 4.3 Conflict Detection

The system detects and reports conflicts between layers:

| Conflict Type   | Detection                   | Severity |
| --------------- | --------------------------- | -------- |
| Regime vs Flow  | Option bias ≠ Whale flow    | HIGH     |
| Flow vs Risk    | Accumulation + Long crowded | MEDIUM   |
| Risk vs Context | Low crowding + Band extreme | LOW      |
| 24H vs 7D       | Opposite CVD directions     | MEDIUM   |
| On-chain vs CEX | Accumulation + No CEX flow  | HIGH     |

### 4.4 Uncertainty Communication

| Level    | Trigger                   | System Response                    |
| -------- | ------------------------- | ---------------------------------- |
| LOW      | All gates HIGH confidence | "Conditions are clear."            |
| MODERATE | Some MEDIUM confidence    | "Some factors require monitoring." |
| HIGH     | Any LOW confidence        | "Significant uncertainty present." |
| CRITICAL | Data quality issues       | "Assessment reliability limited."  |

---

## 5. Execution Modes

### 5.1 Mode Comparison

| Aspect                | Mode A (Manual)   | Mode B (Semi-Auto)     | Mode C (Auto-Protect) |
| --------------------- | ----------------- | ---------------------- | --------------------- |
| Decision Maker        | Trader            | Trader                 | Framework             |
| Executor              | Trader (external) | System (after confirm) | System                |
| Automation            | None              | Low                    | Emergency only        |
| Can Open Positions    | N/A               | No                     | No                    |
| Confirmation Required | N/A               | Yes                    | No (predefined)       |
| Opt-in Required       | No (default)      | Yes                    | Yes (per position)    |

### 5.2 Mode A: Manual Execution

```
FLOW:
System → Delivers Assessment
Trader → Reviews Information
Trader → Makes Independent Decision
Trader → Executes Externally

System has NO knowledge of execution.
```

### 5.3 Mode B: Semi-Auto Execution

```
FLOW:
1. Permission State Change → System Notifies Trader
2. Trader Requests Preparation → /prepare_reduce BTCUSDT size: 30%
3. System Validates → Tier 1 constraints, API connectivity
4. System Prepares Order → Payload built, NOT sent
5. System Requests Confirmation → Shows order details
6. Trader Confirms → /confirm ORDER_ID
7. System Executes → Order sent to Binance
8. System Reports → Execution result

⚠️ Order preparation is ALWAYS trader-initiated.
⚠️ System NEVER suggests direction or size.
```

### 5.4 Mode C: Auto-Protect

```
ELIGIBILITY (ALL required):
1. Active position exists
2. Permission state = NO_TRADE
3. Risk Gate = FAIL
4. Trader opt-in enabled for this position

EXECUTION:
1. System detects conditions → All 4 met
2. System notifies trader → Alert sent
3. System executes predefined action → CLOSE or REDUCE_50
4. System reports result → Execution details
5. Position marked closed → Review required

⚠️ Auto-Protect CANNOT open positions.
⚠️ Auto-Protect CANNOT increase exposure.
⚠️ Auto-Protect is DEFENSIVE ONLY.
```

---

## 6. Human Override System

### 6.1 Override Levels

| Level | Name       | When Allowed                       | Cooling-Off |
| ----- | ---------- | ---------------------------------- | ----------- |
| 1     | Contextual | SCALP_ONLY, WAIT, REDUCED_RISK     | None        |
| 2     | Contrary   | NO_TRADE (Regime FAIL only)        | 4 hours     |
| 3     | Emergency  | System failure, existing positions | 24 hours    |

### 6.2 Non-Overridable Conditions

These Tier 1 constraints **cannot** be overridden:

- RISK_GATE_FAIL_EXTREME_CROWDING
- RISK_GATE_FAIL_STRESS_RANGE
- CRITICAL_DATA_QUALITY_FAILURE
- ALTCOIN_BTC_NO_TRADE

### 6.3 Override Limits

| Level   | Per Asset     | Global    | Daily Limit |
| ------- | ------------- | --------- | ----------- |
| Level 1 | Unlimited     | Unlimited | None        |
| Level 2 | 1 per 4 hours | 3 per day | 3           |
| Level 3 | 1 per event   | N/A       | N/A         |

---

## 7. Safety Architecture

### 7.1 Tier 1 Constraints

```
IMMUTABLE RULES (Cannot be overridden)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEVER AUTOMATE:
├── Entry signal generation
├── Exit signal generation
├── Position sizing
├── Direction decision
├── New position opening
├── Regime classification
└── Conflicting signal resolution

ALWAYS ENFORCE:
├── Risk Gate FAIL blocks trading
├── Extreme crowding blocks trading
├── Stress range blocks trading
├── Altcoin requires BTC permission
└── Human confirmation for execution
```

### 7.2 Safety Mechanisms

| Mechanism                     | Purpose             | Default State |
| ----------------------------- | ------------------- | ------------- |
| EXECUTION_ENABLED             | Master switch       | FALSE         |
| AUTO_PROTECT_GLOBALLY_ENABLED | Auto-protect master | FALSE         |
| Kill Switch                   | Emergency stop      | Inactive      |
| Rate Limiter                  | Prevent API abuse   | Active        |
| Circuit Breaker               | Halt after failures | Active        |
| Order Timeout                 | Expire stale orders | 5 minutes     |

### 7.3 Execution Gate Sequence

Before any order reaches Binance:

```
GATE 1: EXECUTION_ENABLED flag → Must be TRUE
GATE 2: Kill Switch status → Must be INACTIVE
GATE 3: Rate Limiter → Must have capacity
GATE 4: Order Status → Must be CONFIRMED
GATE 5: Tier 1 Constraints → Must pass all
```

---

## 8. API Reference

### 8.1 Binance Integration

**Read Operations:**

- `futuresPrices` - Current price
- `futuresOpenInterest` - OI data
- `futuresFundingRate` - Funding rate

**Write Operations (Mode B/C only):**

- `futuresOrder` - Market order execution

**Rate Limits:**

- 1200 weight per minute
- Orders: 10 per second

### 8.2 Order Payload Structure

```typescript
interface BinanceOrderPayload {
  symbol: string; // e.g., "BTCUSDT"
  side: 'BUY' | 'SELL';
  type: 'MARKET';
  quantity: number;
}
```

### 8.3 Internal API Types

See `src/types/` for complete TypeScript definitions:

- `gates.types.ts` - Gate evaluation types
- `permission.types.ts` - Permission state types
- `order.types.ts` - Order and execution types
- `position.types.ts` - Position tracking types
- `audit.types.ts` - Audit log types

---

## 9. Telegram Message Specifications

### 9.1 Message Tiers

| Tier | Name     | Urgency | Action Required            |
| ---- | -------- | ------- | -------------------------- |
| T1   | INFO     | Low     | None                       |
| T2   | WARNING  | Medium  | Acknowledgment recommended |
| T3   | ALERT    | High    | Acknowledgment required    |
| T4   | CRITICAL | Urgent  | Immediate attention        |

### 9.2 Forbidden Language

System messages must **never** contain:

- Directional: "bullish", "bearish", "will go up/down"
- Recommendations: "you should buy/sell"
- Certainty: "will happen", "guaranteed"
- Urgency: "act now", "don't miss"
- Signal language: "buy signal", "entry point"

### 9.3 Required Language

| Context               | Permitted Phrase                              |
| --------------------- | --------------------------------------------- |
| Permission granted    | "Exposure permitted under current conditions" |
| Permission restricted | "Conditions do not support full exposure"     |
| Permission denied     | "Framework conditions not met"                |
| Risk present          | "Risk factor identified: [factor]"            |
| Uncertainty           | "Assessment confidence is [level]"            |

---

## 10. Audit & Logging

### 10.1 Log Types

| Log Type         | Retention  | Access                  |
| ---------------- | ---------- | ----------------------- |
| System Events    | 12 months  | Risk, Audit             |
| Gate Evaluations | 12 months  | Risk, Audit             |
| Trader Actions   | 12 months  | Risk, Audit, Individual |
| Override Logs    | 24 months  | Risk, Audit             |
| Execution Logs   | 24 months  | Risk, Audit             |
| Security Events  | Indefinite | Risk, Audit             |

### 10.2 Prohibited Log Analysis

Logs must **NOT** be used for:

- PnL correlation analysis
- "Winning pattern" mining
- Cross-trader outcome comparison
- Prediction model training

### 10.3 Log Files

```
logs/
├── app.log        # Application logs
├── error.log      # Error logs
├── audit.log      # Immutable audit trail
└── killswitch.json # Kill switch state
```

---

## 11. Deployment Guide

### 11.1 Prerequisites

- Node.js >= 18.0.0
- Redis >= 7.0
- Network access to Binance API
- Network access to Telegram API

### 11.2 Environment Setup

```bash
# 1. Clone and install
git clone <repo>
cd tk-trading-system
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 3. Build
npm run build

# 4. Test configuration
npm run health-check
```

### 11.3 Docker Deployment

```bash
# Build and start
docker-compose -f docker/docker-compose.yml up -d

# Verify
docker-compose ps
docker-compose logs -f tk-trading-system
```

### 11.4 Production Checklist

- [ ] `EXECUTION_ENABLED=false` initially
- [ ] `BINANCE_TESTNET=true` for testing
- [ ] Valid Telegram credentials
- [ ] Valid Binance credentials
- [ ] Redis accessible
- [ ] Logs directory writable
- [ ] Health check passing
- [ ] Monitoring configured
- [ ] Backup strategy in place

---

## Appendix

### A. Glossary

| Term               | Definition                                                |
| ------------------ | --------------------------------------------------------- |
| **Regime**         | Dominant market state from Option stance + Whale behavior |
| **Comfort Range**  | Price zone where Big Player Option PnL maximized          |
| **Stress Range**   | Price zone where Big Player PnL deteriorates              |
| **Long Vol**       | Big Player stance expecting big moves                     |
| **Short Vol**      | Big Player stance expecting sideways                      |
| **CVD Whale**      | Cumulative Volume Delta filtered to whale sizes           |
| **Full Alignment** | Option + Whale + Future all same direction                |

### B. Error Codes

| Code                       | Description                        |
| -------------------------- | ---------------------------------- |
| TIER1_CONSTRAINT_VIOLATION | Immutable rule violated            |
| EXECUTION_BLOCKED          | Execution prevented by safety gate |
| ORDER_NOT_FOUND            | Referenced order doesn't exist     |
| RATE_LIMIT_ERROR           | API rate limit exceeded            |
| KILL_SWITCH_ACTIVE         | Emergency stop active              |
| DATA_QUALITY_ERROR         | Data freshness/availability issue  |

### C. Version History

| Version | Date | Changes         |
| ------- | ---- | --------------- |
| 1.0.0   | 2024 | Initial release |

---

**Document End**

_This document is confidential and proprietary. Unauthorized distribution is prohibited._

# TK Trading Decision Support System

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)]()
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)]()
[![TypeScript](https://img.shields.io/badge/typescript-5.3-blue.svg)]()
[![License](https://img.shields.io/badge/license-PROPRIETARY-red.svg)]()

## ⚠️ IMPORTANT DISCLAIMER

**This system is designed as a DECISION SUPPORT tool, NOT an autonomous trading bot.**

- All execution requires **explicit human confirmation**
- Permission states indicate what is **ALLOWED**, not what is **RECOMMENDED**
- The system provides **CONTEXT**, not **SIGNALS**
- Human judgment remains the **FINAL AUTHORITY**

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Telegram Commands](#telegram-commands)
- [Permission States](#permission-states)
- [Execution Modes](#execution-modes)
- [Safety Mechanisms](#safety-mechanisms)
- [Development](#development)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Overview

The TK Trading Decision Support System is a semi-automated framework that evaluates market conditions and provides permission-based context for human traders. It implements a four-gate evaluation system derived from the TK Trading Framework.

### Key Features

- **Four-Gate Evaluation**: Regime, Flow, Risk, and Execution Context assessment
- **Permission States**: Clear indicators of what trading activity is framework-compliant
- **Human-in-the-Loop**: All execution requires explicit trader confirmation
- **Telegram Integration**: Real-time notifications and command interface
- **Auto-Protect**: Optional emergency protective actions (opt-in only)
- **Comprehensive Audit**: Full logging of all system outputs and trader actions

### What This System Does NOT Do

- ❌ Generate buy/sell signals
- ❌ Decide trade direction
- ❌ Determine position size
- ❌ Execute trades autonomously
- ❌ Provide price targets or stop-loss recommendations

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SYSTEM ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Binance   │    │  Telegram   │    │ Data APIs   │         │
│  │   API       │    │  Bot API    │    │ (Option/    │         │
│  │             │    │             │    │  Whale)     │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    DATA COLLECTOR                        │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   GATE EVALUATOR                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ Regime   │ │  Flow    │ │  Risk    │ │ Context  │   │   │
│  │  │  Gate    │ │  Gate    │ │  Gate    │ │  Gate    │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              PERMISSION STATE ENGINE                     │   │
│  │  Outputs: TRADE_ALLOWED | REDUCED_RISK | SCALP_ONLY     │   │
│  │           WAIT | NO_TRADE                                │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              TELEGRAM NOTIFIER                           │   │
│  │              COMMAND HANDLER                             │   │
│  │              EXECUTION CONTROLLER                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Redis (for state persistence)
- Telegram Bot Token (from @BotFather)
- Binance API Keys

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd tk-trading-system

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### Configuration

Edit the `.env` file with your credentials:

```bash
# Required: Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_ADMIN_IDS=your_user_id

# Required: Binance
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
BINANCE_TESTNET=true  # Start with testnet!

# CRITICAL SAFETY: Keep these as false initially
EXECUTION_ENABLED=false
AUTO_PROTECT_GLOBALLY_ENABLED=false
```

### Running

```bash
# Development
npm run dev

# Production
npm run build
npm start

# With Docker
docker-compose -f docker/docker-compose.yml up -d
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment mode |
| `LOG_LEVEL` | No | `info` | Logging level |
| `TELEGRAM_BOT_TOKEN` | **Yes** | - | Telegram bot token |
| `TELEGRAM_CHAT_ID` | **Yes** | - | Target chat for notifications |
| `TELEGRAM_ADMIN_IDS` | **Yes** | - | Comma-separated authorized user IDs |
| `BINANCE_API_KEY` | **Yes** | - | Binance API key |
| `BINANCE_API_SECRET` | **Yes** | - | Binance API secret |
| `BINANCE_TESTNET` | No | `true` | Use Binance testnet |
| `EXECUTION_ENABLED` | No | `false` | **Master switch for execution** |
| `AUTO_PROTECT_GLOBALLY_ENABLED` | No | `false` | **Master switch for auto-protect** |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL |
| `MAX_POSITION_SIZE_USD` | No | `10000` | Maximum position size |
| `MAX_DAILY_ORDERS` | No | `10` | Maximum orders per day |
| `ORDER_CONFIRMATION_TIMEOUT_MS` | No | `300000` | Order confirmation timeout (5 min) |
| `TRACKED_ASSETS` | No | `BTCUSDT,ETHUSDT` | Assets to monitor |

### Safety Configuration

```bash
# ⚠️ CRITICAL: Understand these settings before changing

# EXECUTION_ENABLED
# - false: System operates in SUGGESTION-ONLY mode (recommended for start)
# - true:  System can execute trades after human confirmation

# AUTO_PROTECT_GLOBALLY_ENABLED  
# - false: Auto-Protect feature is completely disabled
# - true:  Auto-Protect can be enabled per-position by trader
```

---

## Telegram Commands

### Information Commands

| Command | Description |
|---------|-------------|
| `/status` | Get permission states for all tracked assets |
| `/status BTCUSDT` | Get detailed assessment for specific asset |
| `/help` | Show available commands |

### Order Preparation (Mode B)

| Command | Description |
|---------|-------------|
| `/prepare_reduce ASSET` | Request position reduction |
| `/prepare_close ASSET` | Request position closure |
| `/confirm ORDER_ID` | Confirm prepared order |
| `/cancel ORDER_ID` | Cancel prepared order |

### Override Commands

| Command | Description |
|---------|-------------|
| `/override ASSET REASON` | Request override with justification |

### Auto-Protect (Mode C)

| Command | Description |
|---------|-------------|
| `/enable_autoprotect ASSET ACTION` | Enable auto-protect (CLOSE or REDUCE_50) |
| `/disable_autoprotect ASSET` | Disable auto-protect |

### Emergency

| Command | Description |
|---------|-------------|
| `/killswitch` | Emergency stop all operations |

---

## Permission States

The system outputs one of five permission states per asset:

### 🟢 TRADE_ALLOWED

All four gates pass. Full discretion for swing/position trades.

**Gate Requirements**: Regime ✅, Flow ✅, Risk ✅, Context ✅

### 🟡 TRADE_ALLOWED_REDUCED_RISK

Core gates pass but risk factors present. Trading permitted with reduced size.

**Gate Requirements**: Regime ✅, Flow ✅/⚠️, Risk ⚠️, Context ✅/⚠️

### 🟠 SCALP_ONLY

Flow quality insufficient. Only short-term trades appropriate.

**Gate Requirements**: Regime ✅/⚠️, Flow ❌/⚠️, Risk any, Context any

### ⏸️ WAIT

Transitional conditions. New positions not recommended.

**Triggers**: Multiple WEAK_PASS gates, event day approaching, regime transition

### 🔴 NO_TRADE

Critical gates fail. Framework prohibits new exposure.

**Triggers**: Regime FAIL, Risk FAIL, or (Flow FAIL + Context FAIL)

---

## Execution Modes

### Mode A: Manual (Default)

- System provides information only
- No order preparation
- No execution visibility
- Pure decision support

### Mode B: Semi-Auto

- System can prepare orders on request
- **All orders require explicit confirmation**
- Cannot open new positions
- Can only REDUCE or CLOSE existing positions

### Mode C: Auto-Protect (Opt-in)

- Emergency protective mechanism only
- Triggers only on Risk Gate FAIL with active position
- Executes predefined action (CLOSE or REDUCE)
- Cannot open or increase positions

---

## Safety Mechanisms

### Tier 1 Constraints (Immutable)

These cannot be overridden by any party:

- Risk Gate FAIL blocks all trading
- Extreme crowding (non-overridable)
- Price in stress range (non-overridable)
- System cannot open new positions
- System cannot decide direction or size

### Safety Features

| Feature | Description |
|---------|-------------|
| **Kill Switch** | Emergency stop all operations |
| **Rate Limiter** | Prevent API abuse |
| **Circuit Breaker** | Halt after repeated failures |
| **Order Timeout** | Prepared orders expire after 5 minutes |
| **Override Limits** | Max 3 Level-2 overrides per day |
| **Audit Logging** | All actions are logged |

### Execution Gates

Before any order reaches Binance, it must pass:

1. ✅ `EXECUTION_ENABLED` flag is true
2. ✅ Kill switch is not active
3. ✅ Rate limit not exceeded
4. ✅ Order status is CONFIRMED
5. ✅ Tier 1 constraints not violated

---

## Development

### Project Structure

```
tk-trading-system/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Application class
│   ├── config/               # Configuration
│   ├── types/                # TypeScript types
│   ├── core/                 # Core modules
│   │   ├── data-collector/
│   │   ├── gate-evaluator/
│   │   ├── permission-engine/
│   │   └── risk-validator/
│   ├── interaction/          # User interaction
│   │   ├── telegram/
│   │   └── position/
│   ├── execution/            # Execution layer
│   ├── infrastructure/       # Infrastructure
│   │   ├── audit/
│   │   ├── safety/
│   │   └── storage/
│   └── utils/                # Utilities
├── tests/                    # Test files
├── scripts/                  # CLI scripts
├── docker/                   # Docker files
└── logs/                     # Log files
```

### Scripts

```bash
# Development
npm run dev          # Start with hot reload
npm run build        # Build for production
npm start            # Start production build

# Testing
npm test             # Run tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report

# Quality
npm run lint         # Run linter
npm run lint:fix     # Fix lint issues
npm run format       # Format code
npm run typecheck    # Type checking

# Utilities
npm run health-check # System health check
npm run kill-switch  # Activate kill switch
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --testPathPattern=gates

# Run with coverage
npm run test:coverage
```

---

## Deployment

### Docker Deployment

```bash
# Build and start
cd docker
docker-compose up -d

# View logs
docker-compose logs -f tk-trading-system

# Stop
docker-compose down
```

### Manual Deployment

```bash
# Build
npm run build

# Set production environment
export NODE_ENV=production

# Start with PM2 (recommended)
pm2 start dist/index.js --name tk-trading-system

# Or start directly
node dist/index.js
```

### Production Checklist

- [ ] Environment variables configured
- [ ] `EXECUTION_ENABLED=false` initially
- [ ] `BINANCE_TESTNET=true` for testing
- [ ] Redis running and accessible
- [ ] Telegram bot token valid
- [ ] Binance API keys with appropriate permissions
- [ ] Log directory writable
- [ ] Monitoring configured

---

## Troubleshooting

### Common Issues

**Bot not responding**
- Check `TELEGRAM_BOT_TOKEN` is valid
- Verify bot is not already running elsewhere
- Check `TELEGRAM_ADMIN_IDS` includes your user ID

**No market data**
- Verify Binance API keys are valid
- Check `BINANCE_TESTNET` matches your key type
- Ensure network connectivity

**Orders not executing**
- Verify `EXECUTION_ENABLED=true`
- Check order was confirmed (not just prepared)
- Review audit logs for blocked executions

**Permission always NO_TRADE**
- Check data quality (stale data → lower confidence)
- Review gate evaluations in `/status`
- May be legitimate based on market conditions

### Logs

```bash
# Application logs
tail -f logs/app.log

# Error logs
tail -f logs/error.log

# Audit logs (immutable record)
cat logs/audit.log | jq .
```

### Health Check

```bash
npm run health-check
```

### Emergency Recovery

```bash
# Activate kill switch
npm run kill-switch

# Or via Telegram
/killswitch
```

---

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review audit logs for details
3. Contact the development team

---

## License

PROPRIETARY - All rights reserved.

This software is confidential and proprietary. Unauthorized copying, distribution, or use is strictly prohibited.

---

**Remember: This system provides decision support, not trading signals. You are responsible for your trading decisions.**

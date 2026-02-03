# TK Trading System - Setup Guide

This guide provides step-by-step instructions for setting up the TK Trading Decision Support System.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Configuration](#3-configuration)
4. [Telegram Bot Setup](#4-telegram-bot-setup)
5. [Binance API Setup](#5-binance-api-setup)
6. [Redis Setup](#6-redis-setup)
7. [First Run](#7-first-run)
8. [Docker Setup](#8-docker-setup)
9. [Verification](#9-verification)
10. [Common Issues](#10-common-issues)

---

## 1. Prerequisites

### System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| CPU | 1 core | 2 cores |
| RAM | 512 MB | 1 GB |
| Disk | 1 GB | 5 GB |
| Network | Internet access | Low latency |

### Software Requirements

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0 (comes with Node.js)
- **Redis**: >= 7.0
- **Git**: For cloning the repository

### Verify Prerequisites

```bash
# Check Node.js version
node --version
# Expected: v18.x.x or higher

# Check npm version
npm --version
# Expected: 9.x.x or higher

# Check Redis (if installed locally)
redis-cli ping
# Expected: PONG
```

---

## 2. Installation

### Clone Repository

```bash
# Clone the repository
git clone <repository-url> tk-trading-system
cd tk-trading-system
```

### Install Dependencies

```bash
# Install all dependencies
npm install

# Verify installation
npm ls
```

### Build Project

```bash
# Compile TypeScript
npm run build

# Verify build
ls -la dist/
```

---

## 3. Configuration

### Create Environment File

```bash
# Copy template
cp .env.example .env

# Edit configuration
nano .env
# Or use your preferred editor
```

### Essential Configuration

Edit `.env` with your values:

```bash
# ═══════════════════════════════════════════════════════════
# MINIMAL CONFIGURATION (Required)
# ═══════════════════════════════════════════════════════════

# Telegram (see Section 4)
TELEGRAM_BOT_TOKEN=<your-bot-token>
TELEGRAM_CHAT_ID=<your-chat-id>
TELEGRAM_ADMIN_IDS=<your-user-id>

# Binance (see Section 5)
BINANCE_API_KEY=<your-api-key>
BINANCE_API_SECRET=<your-api-secret>

# ═══════════════════════════════════════════════════════════
# SAFETY SETTINGS (Keep as default initially)
# ═══════════════════════════════════════════════════════════

BINANCE_TESTNET=true
EXECUTION_ENABLED=false
AUTO_PROTECT_GLOBALLY_ENABLED=false
```

### Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | Token from @BotFather |
| `TELEGRAM_CHAT_ID` | ✅ | Where notifications are sent |
| `TELEGRAM_ADMIN_IDS` | ✅ | Who can use commands |
| `BINANCE_API_KEY` | ✅ | Binance API key |
| `BINANCE_API_SECRET` | ✅ | Binance API secret |
| `BINANCE_TESTNET` | ⚠️ | true = testnet, false = live |
| `EXECUTION_ENABLED` | ⚠️ | Master execution switch |
| `REDIS_URL` | No | Redis connection string |

---

## 4. Telegram Bot Setup

### Step 1: Create Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Follow prompts to name your bot
4. Copy the token provided

```
Example token: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

### Step 2: Get Your Chat ID

1. Search for `@userinfobot` or `@getidsbot` on Telegram
2. Start a conversation
3. Copy your user ID

```
Example chat ID: 123456789
```

### Step 3: Get Your User ID

1. Same as chat ID for personal use
2. For group chats, use the group chat ID

### Step 4: Configure Environment

```bash
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
TELEGRAM_ADMIN_IDS=123456789
```

### Step 5: Start Conversation

**Important**: You must send a message to your bot before it can send messages to you.

1. Find your bot by its username
2. Click "Start" or send `/start`

---

## 5. Binance API Setup

### Step 1: Create API Key

1. Go to [Binance API Management](https://www.binance.com/en/my/settings/api-management)
2. Click "Create API"
3. Choose "System generated"
4. Complete verification

### Step 2: Configure Permissions

**⚠️ IMPORTANT SECURITY SETTINGS:**

| Permission | Setting | Reason |
|------------|---------|--------|
| Enable Reading | ✅ Required | For market data |
| Enable Spot & Margin Trading | ❌ Disabled | Not needed |
| Enable Futures | ✅ If using execution | For order execution |
| Enable Withdrawals | ❌ **NEVER ENABLE** | Security risk |
| IP Access Restriction | ✅ Recommended | Whitelist your IP |

### Step 3: For Testnet (Recommended for Setup)

1. Go to [Binance Futures Testnet](https://testnet.binancefuture.com)
2. Create separate testnet API keys
3. Use testnet keys for initial setup

### Step 4: Configure Environment

```bash
# For Testnet (recommended for setup)
BINANCE_API_KEY=your-testnet-api-key
BINANCE_API_SECRET=your-testnet-api-secret
BINANCE_TESTNET=true

# For Production (use with caution)
# BINANCE_API_KEY=your-live-api-key
# BINANCE_API_SECRET=your-live-api-secret
# BINANCE_TESTNET=false
```

---

## 6. Redis Setup

### Option A: Docker (Recommended)

```bash
# Start Redis container
docker run -d \
  --name tk-redis \
  -p 6379:6379 \
  redis:7-alpine

# Verify
docker ps
redis-cli ping
```

### Option B: Local Installation

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**macOS:**
```bash
brew install redis
brew services start redis
```

### Option C: Skip Redis (Development Only)

For development, you can run without Redis, but state won't persist between restarts.

### Configure Environment

```bash
# Default (local Redis)
REDIS_URL=redis://localhost:6379

# With password
REDIS_URL=redis://:password@localhost:6379

# Remote Redis
REDIS_URL=redis://user:password@hostname:6379
```

---

## 7. First Run

### Development Mode

```bash
# Start in development mode
npm run dev
```

You should see:

```
╔════════════════════════════════════════════════════════════════╗
║     TK TRADING DECISION SUPPORT SYSTEM                         ║
║     Version 1.0.0                                               ║
╠════════════════════════════════════════════════════════════════╣
║  ⚠️   IMPORTANT NOTICE                                          ║
║  This system is designed as a DECISION SUPPORT tool.           ║
╚════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────┐
│                   SAFETY CONFIGURATION                       │
├─────────────────────────────────────────────────────────────┤
│  ✅ EXECUTION_ENABLED: FALSE                                │
│      System operates in SUGGESTION-ONLY mode               │
│  ✅ AUTO_PROTECT: DISABLED                                  │
│  ✅ BINANCE_TESTNET: TRUE (using testnet)                   │
└─────────────────────────────────────────────────────────────┘
```

### Production Mode

```bash
# Build first
npm run build

# Start production
npm start
```

### Verify Telegram Connection

1. Open Telegram
2. Send `/help` to your bot
3. You should receive the help message

---

## 8. Docker Setup

### Using Docker Compose

```bash
# Navigate to docker directory
cd docker

# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Docker Compose Files

- `docker-compose.yml` - Main configuration
- System automatically uses Redis from container

### Environment with Docker

Create `.env` in project root (not in docker folder):

```bash
# Same configuration as above
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
# etc.
```

---

## 9. Verification

### Run Health Check

```bash
npm run health-check
```

Expected output:

```json
{
  "status": "healthy",
  "checks": [
    { "name": "environment", "status": "pass" },
    { "name": "safety", "status": "pass", "message": "Execution disabled (safe mode)" }
  ],
  "timestamp": "2024-..."
}
```

### Test Telegram Commands

| Command | Expected Response |
|---------|-------------------|
| `/help` | List of commands |
| `/status` | Current permission states |

### Verify Data Collection

After a few minutes, check logs:

```bash
tail -f logs/app.log
```

You should see gate evaluation logs.

---

## 10. Common Issues

### Telegram Bot Not Responding

**Problem**: Bot doesn't respond to commands

**Solutions**:
1. Verify you've started the bot (`/start`)
2. Check `TELEGRAM_ADMIN_IDS` includes your user ID
3. Verify `TELEGRAM_BOT_TOKEN` is correct
4. Check application logs for errors

### Binance API Errors

**Problem**: "Invalid API-key" or similar errors

**Solutions**:
1. Verify API key/secret are correct
2. Check `BINANCE_TESTNET` matches your key type
3. Ensure API permissions include "Reading"
4. Check IP whitelist if enabled

### Redis Connection Failed

**Problem**: "ECONNREFUSED" error

**Solutions**:
1. Verify Redis is running: `redis-cli ping`
2. Check `REDIS_URL` is correct
3. If using Docker, ensure network connectivity

### Permission Denied Errors

**Problem**: Log file write errors

**Solutions**:
```bash
# Create logs directory
mkdir -p logs

# Set permissions
chmod 755 logs
```

### TypeScript Compilation Errors

**Problem**: Build fails

**Solutions**:
```bash
# Clear and rebuild
npm run clean
npm install
npm run build
```

---

## Next Steps

After successful setup:

1. **Monitor** the system for a few hours
2. **Review** permission state calculations
3. **Test** Telegram commands
4. **Read** the full documentation

When ready for execution features (use with extreme caution):

1. Thoroughly test with `BINANCE_TESTNET=true`
2. Understand all safety mechanisms
3. Start with small positions
4. Never enable execution without understanding the risks

---

## Support

If you encounter issues:

1. Check this guide
2. Review application logs
3. Consult technical documentation
4. Contact the development team

---

**Remember: Start with execution disabled. Understand the system before enabling any trading features.**

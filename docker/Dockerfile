# ═══════════════════════════════════════════════════════════════════════════════
# TK Trading Decision Support System - Dockerfile
# ═══════════════════════════════════════════════════════════════════════════════
#
# Build: docker build -t tk-trading-system -f docker/Dockerfile .
# Run:   docker run -d --name tk-system --env-file .env tk-trading-system
#
# ═══════════════════════════════════════════════════════════════════════════════

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production
FROM node:18-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy necessary files
COPY .env.example ./

# Create logs directory
RUN mkdir -p logs

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 -G nodejs \
    && chown -R nodejs:nodejs /app

USER nodejs

# Environment defaults (CRITICAL: execution disabled by default)
ENV NODE_ENV=production
ENV EXECUTION_ENABLED=false
ENV AUTO_PROTECT_GLOBALLY_ENABLED=false

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Expose no ports (Telegram bot uses polling, Binance uses HTTPS)

# Start command
CMD ["node", "dist/index.js"]

# Labels
LABEL maintainer="TK Trading Team"
LABEL version="1.0.0"
LABEL description="TK Trading Decision Support System"

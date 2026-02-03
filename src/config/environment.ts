// src/config/environment.ts
// Environment variable parsing and validation

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Environment schema with validation
 * All required variables are validated on startup
 */
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TELEGRAM_CHAT_ID: z.string().min(1, 'TELEGRAM_CHAT_ID is required'),
  TELEGRAM_ADMIN_IDS: z.string()
    .min(1, 'TELEGRAM_ADMIN_IDS is required')
    .transform(s => s.split(',').map(id => id.trim())),
  
  // Binance
  BINANCE_API_KEY: z.string().min(1, 'BINANCE_API_KEY is required'),
  BINANCE_API_SECRET: z.string().min(1, 'BINANCE_API_SECRET is required'),
  BINANCE_TESTNET: z.string()
    .transform(s => s === 'true')
    .default('true'),
  
  // Execution Control (CRITICAL SAFETY)
  EXECUTION_ENABLED: z.string()
    .transform(s => s === 'true')
    .default('false'),
  AUTO_PROTECT_GLOBALLY_ENABLED: z.string()
    .transform(s => s === 'true')
    .default('false'),
  
  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
  
  // Safety Limits
  MAX_POSITION_SIZE_USD: z.string()
    .transform(Number)
    .default('10000'),
  MAX_DAILY_ORDERS: z.string()
    .transform(Number)
    .default('10'),
  ORDER_CONFIRMATION_TIMEOUT_MS: z.string()
    .transform(Number)
    .default('300000'), // 5 minutes
  
  // Data Sources (optional)
  OPTION_DATA_API_URL: z.string().optional(),
  WHALE_DATA_API_URL: z.string().optional(),
  
  // Assets
  TRACKED_ASSETS: z.string()
    .default('BTCUSDT,ETHUSDT')
    .transform(s => s.split(',').map(a => a.trim())),
    
  // Timing (optional overrides)
  GATE_EVALUATION_INTERVAL_MS: z.string()
    .transform(Number)
    .optional(),
  PERMISSION_VALIDITY_MS: z.string()
    .transform(Number)
    .optional(),
  DATA_STALENESS_THRESHOLD_MS: z.string()
    .transform(Number)
    .optional(),
});

export type Environment = z.infer<typeof envSchema>;

/**
 * Parsed and validated environment variables
 */
export const env = envSchema.parse(process.env);

/**
 * Validate critical safety settings on startup
 * Logs warnings and confirmations for safety-critical settings
 */
export function validateSafetyConfig(): void {
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│                   SAFETY CONFIGURATION                       │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  
  // Execution status
  if (env.EXECUTION_ENABLED) {
    console.log('│  ⚠️  EXECUTION_ENABLED: TRUE                                │');
    console.log('│      System CAN execute trades after confirmation          │');
    if (env.NODE_ENV === 'production') {
      console.log('│  🚨 WARNING: Production environment with execution enabled! │');
    }
  } else {
    console.log('│  ✅ EXECUTION_ENABLED: FALSE                                │');
    console.log('│      System operates in SUGGESTION-ONLY mode               │');
  }
  
  // Auto-Protect status
  if (env.AUTO_PROTECT_GLOBALLY_ENABLED) {
    console.log('│  ⚠️  AUTO_PROTECT: ENABLED                                  │');
  } else {
    console.log('│  ✅ AUTO_PROTECT: DISABLED                                  │');
  }
  
  // Testnet status
  if (env.BINANCE_TESTNET) {
    console.log('│  ✅ BINANCE_TESTNET: TRUE (using testnet)                   │');
  } else {
    console.log('│  ⚠️  BINANCE_TESTNET: FALSE (using LIVE exchange)           │');
  }
  
  // Safety limits
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Max Position Size: $${env.MAX_POSITION_SIZE_USD.toLocaleString().padEnd(10)}                       │`);
  console.log(`│  Max Daily Orders:  ${env.MAX_DAILY_ORDERS.toString().padEnd(10)}                           │`);
  console.log(`│  Order Timeout:     ${(env.ORDER_CONFIRMATION_TIMEOUT_MS / 60000).toFixed(0)} minutes                             │`);
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
}

/**
 * Check if we're in production
 */
export function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * Check if we're in development
 */
export function isDevelopment(): boolean {
  return env.NODE_ENV === 'development';
}

/**
 * Check if execution is allowed
 */
export function isExecutionEnabled(): boolean {
  return env.EXECUTION_ENABLED;
}

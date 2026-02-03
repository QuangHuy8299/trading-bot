// src/utils/validators.ts
// Input validation utilities

import { z } from 'zod';

/**
 * Schema for Telegram command arguments
 */
export const telegramCommandSchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
  userId: z.string(),
  chatId: z.string(),
});

/**
 * Schema for order preparation request
 */
export const orderPreparationSchema = z.object({
  asset: z.string().regex(/^[A-Z]{2,10}(USDT|BUSD|BTC)$/, 'Invalid asset format'),
  action: z.enum(['REDUCE', 'CLOSE']),
  sizePercent: z.number().min(1).max(100).optional(),
  reason: z.string().min(1).max(500),
  traderId: z.string(),
});

/**
 * Schema for override request
 */
export const overrideRequestSchema = z.object({
  asset: z.string(),
  reason: z.string().min(20, 'Reason must be at least 20 characters'),
  traderId: z.string(),
});

/**
 * Schema for auto-protect configuration
 */
export const autoProtectConfigSchema = z.object({
  asset: z.string(),
  action: z.enum(['CLOSE', 'REDUCE_50']),
  traderId: z.string(),
});

/**
 * Validate and parse with helpful error messages
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
  return { success: false, error: errors.join('; ') };
}

/**
 * Sanitize user input for logging (remove sensitive data)
 */
export function sanitizeForLogging(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'secret', 'apiKey', 'apiSecret', 'token'];
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Validate asset is in tracked list
 */
export function isTrackedAsset(asset: string, trackedAssets: string[]): boolean {
  return trackedAssets.includes(asset.toUpperCase());
}

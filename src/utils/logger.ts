// src/utils/logger.ts
// Application logging utility

import { createLogger, format, transports, Logger } from 'winston';
import { env } from '../config/environment';

const { combine, timestamp, printf, colorize, json } = format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

// Create the logger instance
const logger: Logger = createLogger({
  level: env.LOG_LEVEL,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  transports: [
    // Console transport with colors
    new transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        consoleFormat
      ),
    }),
    // File transport for all logs
    new transports.File({
      filename: 'logs/app.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // Separate file for errors
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

// Export convenience methods
export const log = {
  debug: (message: string, meta?: object) => logger.debug(message, meta),
  info: (message: string, meta?: object) => logger.info(message, meta),
  warn: (message: string, meta?: object) => logger.warn(message, meta),
  error: (message: string, meta?: object) => logger.error(message, meta),
};

export default logger;

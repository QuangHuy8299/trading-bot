// src/index.ts
// Application entry point

import { App } from './app';
import { validateSafetyConfig } from './config/environment';
import { log } from './utils/logger';

/**
 * Main entry point for the TK Trading Decision Support System
 */
async function main(): Promise<void> {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                 ║');
  console.log('║     TK TRADING DECISION SUPPORT SYSTEM                         ║');
  console.log('║     Version 1.0.0                                               ║');
  console.log('║                                                                 ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                 ║');
  console.log('║  ⚠️   IMPORTANT NOTICE                                          ║');
  console.log('║                                                                 ║');
  console.log('║  This system is designed as a DECISION SUPPORT tool.           ║');
  console.log('║  It is NOT an autonomous trading bot.                          ║');
  console.log('║                                                                 ║');
  console.log('║  • All execution requires explicit human confirmation          ║');
  console.log('║  • Permission states indicate what is ALLOWED, not RECOMMENDED ║');
  console.log('║  • The system provides CONTEXT, not SIGNALS                    ║');
  console.log('║  • Human judgment remains the FINAL AUTHORITY                  ║');
  console.log('║                                                                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Validate safety configuration
  validateSafetyConfig();

  // Initialize and start application
  const app = new App();
  
  try {
    await app.initialize();
    await app.start();
    
    log.info('System startup complete');
    
  } catch (error) {
    log.error('Failed to start system', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    process.exit(1);
  }

  // Graceful shutdown handlers
  process.on('SIGTERM', async () => {
    log.info('Received SIGTERM signal');
    await gracefulShutdown(app, 'SIGTERM');
  });

  process.on('SIGINT', async () => {
    log.info('Received SIGINT signal');
    await gracefulShutdown(app, 'SIGINT');
  });

  process.on('uncaughtException', async (error) => {
    log.error('Uncaught exception', { error: error.message, stack: error.stack });
    await gracefulShutdown(app, 'UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', async (reason) => {
    log.error('Unhandled rejection', { reason });
    await gracefulShutdown(app, 'UNHANDLED_REJECTION');
  });
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(app: App, signal: string): Promise<void> {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Shutting down gracefully (${signal})...`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  try {
    await app.stop();
    log.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    log.error('Error during shutdown', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    process.exit(1);
  }
}

// Run the application
main().catch((error) => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});

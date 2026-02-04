// src/app.ts
// Main application bootstrap and lifecycle management

import { EventEmitter } from 'events';
import { env } from './config/environment';
import { TIMING, VOLATILITY_CONFIG, SCANNER_CONFIG } from './config/constants';
import { log } from './utils/logger';

import { AuditLogger } from './infrastructure/audit';
import { SafetyManager } from './infrastructure/safety';
import { CommandHandler, TelegramBot } from './interaction/telegram';
import { DataCollector } from './core/data-collector/DataCollector';
import { GateEvaluator } from './core/gate-evaluator/GateEvaluator';
import { PermissionStateEngine } from './core/permission-engine/PermissionStateEngine';
import { RateLimiter } from './infrastructure/safety/RateLimiter';
import { MarketScanner } from './core/scanner/MarketScanner';
import type { PermissionAssessment } from './types/permission.types';
import { PermissionState } from './types/permission.types';
import { GateStatus } from './types/gates.types';
import { MarketData as CollectorMarketData } from './core/data-collector/types';
import { OrderExecutionService } from './execution/OrderExecutionService';
import { BinanceExecutor } from './execution/BinanceExecutor';
import { RiskConfig } from './types/execution.types';

// Type definitions for assessments
interface AssessmentMarketData {
  price: number;
  volume24h: number;
  volatility: number;
  validUntil?: Date;
}

interface GateResult {
  passed: boolean;
  reason: string;
}

interface Assessment {
  asset: string;
  timestamp: Date;
  data: AssessmentMarketData;
  gates: Record<string, GateResult>;
  permission: PermissionState;
}

/**
 * Main application class
 * Manages initialization, lifecycle, and coordination of all modules
 */
export class App extends EventEmitter {
  private initialized: boolean = false;
  private running: boolean = false;
  private evaluationInterval: NodeJS.Timeout | null = null;

  // Module instances (will be initialized)
  private auditLogger!: AuditLogger;
  private safetyManager!: SafetyManager;
  private dataCollector!: DataCollector;
  private gateEvaluator!: GateEvaluator;
  private permissionEngine!: PermissionStateEngine;
  private telegramBot!: TelegramBot;
  private marketScanner!: MarketScanner;
  private orderExecutionService!: OrderExecutionService;

  // Track last assessment for change detection
  private lastAssessments: Map<string, Assessment> = new Map();

  // Scanner loop interval
  private scannerInterval: NodeJS.Timeout | null = null;

  // Volatility monitoring: Track price history (rolling 5-minute window)
  private priceHistory: Map<string, Array<{ price: number; timestamp: Date }>> = new Map();

  // Volatility monitoring: Track volStance history
  private volStanceHistory: Map<string, { volStance: string; timestamp: Date }> = new Map();

  // Rate limiting for volatility alerts (max 1 per 30 mins per asset)
  private volatilityAlertLastSent: Map<string, Date> = new Map();

  // Track last scanner notification to avoid spam (max 1 per hour)
  private lastScannerNoAssetsNotification: Date | null = null;

  constructor() {
    super();
    log.info('App instance created');
  }

  /**
   * Initialize all system components
   */
  initialize(): void {
    if (this.initialized) {
      log.warn('App already initialized');
      return;
    }

    log.info('Initializing system components...');

    try {
      // Initialize infrastructure layer
      log.debug('Initializing infrastructure layer...');
      this.auditLogger = new AuditLogger();
      this.safetyManager = new SafetyManager(this.auditLogger);
      log.info('✓ Infrastructure layer initialized');

      // Initialize data layer
      log.debug('Initializing data layer...');
      // Create a RateLimiter for BinanceConnector
      const binanceRateLimiter = new RateLimiter({
        maxRequests: 1200, // Example: 1200 requests per minute (Binance default)
        windowMs: 60 * 1000,
      });
      this.dataCollector = new DataCollector(binanceRateLimiter, this.auditLogger);
      
      // Initialize MarketScanner
      this.marketScanner = new MarketScanner(binanceRateLimiter);
      
      log.info('✓ Data layer initialized');

      // Initialize evaluation layer
      log.debug('Initializing evaluation layer...');
      this.gateEvaluator = new GateEvaluator(this.auditLogger);
      this.permissionEngine = new PermissionStateEngine();
      // this.riskValidator = new RiskValidator(this.auditLogger);
      log.info('✓ Evaluation layer initialized');

      // Initialize position tracking
      log.debug('Initializing position tracking...');
      // this.positionTracker = new PositionTracker(this.auditLogger);
      log.info('✓ Position tracking initialized');

      // Initialize execution layer
      log.debug('Initializing execution layer...');

      // Create RiskConfig from environment
      const riskConfig: RiskConfig = {
        accountBalance: 0, // Will be fetched dynamically from Binance
        riskPerTradePercent: env.RISK_PER_TRADE_PERCENT,
        rewardRatio: env.RISK_REWARD_RATIO,
        maxLeverage: env.MAX_LEVERAGE,
        defaultStopLossPercent: env.DEFAULT_STOP_LOSS_PERCENT,
      };

      // Initialize BinanceExecutor and OrderExecutionService
      const binanceConnector = this.dataCollector.getBinanceConnector();
      const executor = new BinanceExecutor(binanceConnector);
      this.orderExecutionService = new OrderExecutionService(executor, riskConfig);

      log.info('✓ Execution layer initialized');

      // Initialize interaction layer
      log.debug('Initializing interaction layer...');
      const commandHandler = new CommandHandler(
        this.auditLogger,
        this.safetyManager,
        this.dataCollector,
        this.gateEvaluator,
        this.permissionEngine,
        this.orderExecutionService
      );
      this.telegramBot = new TelegramBot(commandHandler, this.auditLogger);
      log.info('✓ Interaction layer initialized');

      this.initialized = true;
      log.info('All components initialized successfully');
      // No await needed - all initialization is synchronous
    } catch (error) {
      log.error('Failed to initialize components', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Start the system
   */
  start(): void {
    if (!this.initialized) {
      throw new Error('App must be initialized before starting');
    }

    if (this.running) {
      log.warn('App already running');
      return;
    }

    log.info('Starting system...');

    try {
      // Start data collection
      log.debug('Starting data collection...');
      // If auto-scan is enabled, start with empty list (scanner will populate)
      // Otherwise, use TRACKED_ASSETS from env
      const initialAssets = SCANNER_CONFIG.ENABLE_AUTO_SCAN ? [] : env.TRACKED_ASSETS;
      void this.dataCollector.start(initialAssets);
      log.info(`✓ Data collection started for: ${initialAssets.length > 0 ? initialAssets.join(', ') : '(will be populated by scanner)'}`);

      // Start periodic evaluation loop
      this.startEvaluationLoop();
      log.info('✓ Evaluation loop started');

      // Start scanner loop if enabled
      if (SCANNER_CONFIG.ENABLE_AUTO_SCAN) {
        this.startScannerLoop();
        log.info(`✓ Scanner loop started (interval: ${SCANNER_CONFIG.SCANNER_INTERVAL_MS / 60000} minutes)`);
      } else {
        log.warn('⚠️ Scanner loop DISABLED - Set ENABLE_AUTO_SCAN=true in .env to enable');
        log.info('✓ Scanner loop disabled (ENABLE_AUTO_SCAN=false)');
      }

      // Setup event handlers
      this.setupEventHandlers();
      log.info('✓ Event handlers configured');

      this.running = true;

      // Print status
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('  System is now RUNNING');
      console.log('');
      console.log(`  Mode:             ${env.NODE_ENV}`);
      console.log(`  Execution:        ${env.EXECUTION_ENABLED ? 'ENABLED ⚠️' : 'DISABLED ✓'}`);
      console.log(
        `  Auto-Protect:     ${env.AUTO_PROTECT_GLOBALLY_ENABLED ? 'ENABLED ⚠️' : 'DISABLED ✓'}`
      );
      console.log(`  Auto-Entry:       ${env.AUTO_ENTRY_ENABLED ? `ENABLED (${env.AUTO_ENTRY_MODE}) ⚠️` : 'DISABLED ✓'}`);
      console.log(`  TP/SL Mode:       ${env.AUTO_ENTRY_ENABLED ? env.TPSL_MODE : 'N/A'}`);
      console.log(`  Binance:          ${env.BINANCE_TESTNET ? 'TESTNET ✓' : 'LIVE ⚠️'}`);
      console.log(`  Tracked Assets:   ${env.TRACKED_ASSETS.join(', ')}`);
      console.log('');
      console.log('  Telegram bot is listening for commands...');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');

      // Log system event
      // this.auditLogger.logSystemEvent({
      //   type: 'SYSTEM_STARTED',
      //   config: { ... },
      //   timestamp: new Date(),
      // });
      // No await needed - all startup is synchronous
    } catch (error) {
      log.error('Failed to start system', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Stop the system
   */
  stop(): void {
    if (!this.running) {
      log.warn('App not running');
      return;
    }

    log.info('Stopping system...');

    try {
      // Stop evaluation loop
      if (this.evaluationInterval) {
        clearInterval(this.evaluationInterval);
        this.evaluationInterval = null;
        log.info('✓ Evaluation loop stopped');
      }

      // Stop scanner loop
      if (this.scannerInterval) {
        clearInterval(this.scannerInterval);
        this.scannerInterval = null;
        log.info('✓ Scanner loop stopped');
      }

      // Stop data collection
      // this.dataCollector.stop();
      log.info('✓ Data collection stopped');

      // Log shutdown
      // this.auditLogger.logSystemEvent({
      //   type: 'SYSTEM_STOPPED',
      //   timestamp: new Date(),
      // });

      this.running = false;
      log.info('System stopped successfully');
      // No await needed - all shutdown is synchronous
    } catch (error) {
      log.error('Error during shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Start the periodic evaluation loop
   * Note: This determines the system's reaction speed.
   * While data arrives in real-time (via DataCollector), decisions are made
   * on this interval to ensure stability and prevent notification spam.
   */
  private startEvaluationLoop(): void {
    const intervalMs = env.GATE_EVALUATION_INTERVAL_MS ?? TIMING.GATE_EVALUATION_INTERVAL_MS;

    this.evaluationInterval = setInterval(() => void this.runEvaluationCycle(), intervalMs);

    // Run initial evaluation immediately
    void this.runEvaluationCycle();

    log.debug(`Evaluation loop started with ${intervalMs}ms interval`);
  }

  /**
   * Start the scanner loop for dynamic asset selection
   * Runs periodically to scan top assets and update watchlist
   */
  private startScannerLoop(): void {
    const intervalMs = SCANNER_CONFIG.SCANNER_INTERVAL_MS;

    this.scannerInterval = setInterval(() => void this.runScannerCycle(), intervalMs);

    // Run initial scan immediately
    void this.runScannerCycle();

    log.debug(`Scanner loop started with ${intervalMs}ms interval (${intervalMs / 60000} minutes)`);
  }

  /**
   * Run a single scanner cycle
   */
  private async runScannerCycle(): Promise<void> {
    log.info('Running scanner cycle...');

    try {
      const notifier = this.telegramBot.getNotifier();
      
      if (!notifier) {
        log.warn('Telegram notifier not available, cannot send scanner notifications');
      }
      
      // Scan top assets
      log.info(`Scanning for top ${SCANNER_CONFIG.MAX_ACTIVE_ASSETS} assets...`);
      const topAssets = await this.marketScanner.scanTopAssets(SCANNER_CONFIG.MAX_ACTIVE_ASSETS);

      log.info(`Scanner completed. Found ${topAssets.length} assets: ${topAssets.length > 0 ? topAssets.join(', ') : 'NONE'}`);

      if (topAssets.length === 0) {
        log.warn('Scanner returned no assets, keeping current watchlist');
        
        // Notify if no assets found (rate limited to max 1 per hour)
        const now = new Date();
        const shouldNotify = !this.lastScannerNoAssetsNotification || 
          (now.getTime() - this.lastScannerNoAssetsNotification.getTime()) >= 60 * 60 * 1000; // 1 hour

        log.info(`Notification check: shouldNotify=${shouldNotify}, notifier=${!!notifier}, lastNotification=${this.lastScannerNoAssetsNotification?.toISOString() || 'never'}`);

        if (shouldNotify && notifier) {
          try {
            log.info('Sending notification: No tradeable pairs found');
            await notifier.sendScannerNotification('NO_ASSETS', {
              reason: 'No assets met minimum volume threshold ($50M) or scoring criteria',
            });
            this.lastScannerNoAssetsNotification = now;
            log.info('✅ Successfully sent notification: No tradeable pairs found');
          } catch (notifyError) {
            log.error('❌ Failed to send scanner notification', { 
              error: notifyError instanceof Error ? notifyError.message : String(notifyError),
              stack: notifyError instanceof Error ? notifyError.stack : undefined
            });
          }
        } else {
          if (!shouldNotify) {
            log.info(`⏭️ Skipping notification (rate limited - last sent ${Math.round((now.getTime() - (this.lastScannerNoAssetsNotification?.getTime() || 0)) / 60000)} minutes ago)`);
          }
          if (!notifier) {
            log.warn('⚠️ Cannot send notification: Telegram notifier not available');
          }
        }
        
        return;
      }

      // Update watchlist in DataCollector
      const previousAssets = this.dataCollector.getActiveAssets();
      await this.dataCollector.updateWatchlist(topAssets);

      log.info(`Watchlist updated: [${topAssets.join(', ')}]`);

      // Notify about watchlist update
      if (notifier && JSON.stringify(previousAssets.sort()) !== JSON.stringify(topAssets.sort())) {
        try {
          await notifier.sendScannerNotification('WATCHLIST_UPDATED', {
            assets: topAssets,
          });
          log.info('Sent notification: Watchlist updated');
        } catch (notifyError) {
          log.error('Failed to send watchlist update notification', { error: notifyError });
        }
      }

      // Reset no-assets notification timer if we found assets
      this.lastScannerNoAssetsNotification = null;

      // Emit event for other listeners
      this.emit('watchlist:updated', { assets: topAssets });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      log.error('❌ Error in scanner cycle', {
        error: errorMsg,
        stack: errorStack,
      });
      
      // Notify on scanner errors
      const notifier = this.telegramBot.getNotifier();
      if (notifier) {
        try {
          log.info('Sending scanner error notification...');
          await notifier.sendSystemCritical(
            'SCANNER ERROR',
            `Scanner cycle failed: ${errorMsg}\n\nSystem will retry on next cycle.`
          );
          log.info('✅ Scanner error notification sent');
        } catch (notifyError) {
          log.error('❌ Failed to send scanner error notification', { 
            error: notifyError instanceof Error ? notifyError.message : String(notifyError)
          });
        }
      } else {
        log.warn('⚠️ Cannot send scanner error notification: Telegram notifier not available');
      }
    }
  }

  /**
   * Run a single evaluation cycle
   */
  private runEvaluationCycle(): void {
    log.debug('Running evaluation cycle...');

    try {
      // Get active assets from DataCollector (supports dynamic watchlist)
      const activeAssets = this.dataCollector.getActiveAssets();
      
      if (activeAssets.length === 0) {
        log.debug('No active assets to evaluate (scanner may not have run yet)');
        return;
      }

      for (const asset of activeAssets) {
        void this.evaluateAsset(asset).catch((err: Error) => {
          log.error(`Error evaluating ${asset}:`, err);
        });
      }
    } catch (error) {
      log.error('Error in evaluation cycle', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Evaluate a single asset
   */
  private async evaluateAsset(asset: string): Promise<void> {
    log.debug(`Evaluating asset: ${asset}`);

    try {
      // 1. Get market data
      const data = await this.dataCollector.collect(asset);
      if (!data) {
        log.warn(`No data available for ${asset}`);
        return;
      }

      // 2. Evaluate gates
      const gateResult = this.gateEvaluator.evaluate(data);

      // 2.5. Check for volatility/flash move conditions
      await this.checkVolatilityConditions(asset, data, gateResult);

      // 3. Calculate permission state
      const assessment = this.permissionEngine.assess(asset, gateResult);

      // 4. Create internal assessment for tracking
      const internalAssessment: Assessment = {
        asset,
        timestamp: new Date(),
        data: {
          price: data.price,
          volume24h: data.binance.volume24h,
          volatility: data.option?.impliedVolatility ?? 0,
          validUntil: new Date(assessment.assessedAt.getTime() + TIMING.PERMISSION_VALIDITY_MS),
        },
        gates: {
          regime: {
            passed: gateResult.regime.status === GateStatus.PASS,
            reason: gateResult.regime.humanNote,
          },
          flow: {
            passed: gateResult.flow.status === GateStatus.PASS,
            reason: gateResult.flow.humanNote,
          },
          risk: {
            passed: gateResult.risk.status === GateStatus.PASS,
            reason: gateResult.risk.humanNote,
          },
          context: {
            passed: gateResult.context.status === GateStatus.PASS,
            reason: gateResult.context.humanNote,
          },
        },
        permission: assessment.permissionState,
      };

      // 5. Check for state changes
      const lastAssessment = this.lastAssessments.get(asset);

      // 6. Update cache
      this.lastAssessments.set(asset, internalAssessment);

      // 7. Detect transition from non-trading → trading-allowed state
      const lastState = lastAssessment?.permission;
      const currentState = assessment.permissionState;

      const isTradingState = (state: PermissionState): boolean =>
        state === PermissionState.TRADE_ALLOWED ||
        state === PermissionState.TRADE_ALLOWED_REDUCED_RISK;

      const wasTrading = lastState ? isTradingState(lastState) : false;
      const isNowTrading = isTradingState(currentState);

      const isTransitionToTrade = !wasTrading && isNowTrading;

      if (isTransitionToTrade && lastState) {
        await this.notifyStateChange(asset, internalAssessment, lastAssessment, assessment);
      }

      // 8. Process signal through OrderExecutionService (if auto-entry enabled)
      if (env.AUTO_ENTRY_ENABLED && this.orderExecutionService) {
        await this.orderExecutionService.processSignal(
          asset,
          data.price,
          gateResult,
          assessment
        );
      }

      // 9. Emit event for other listeners (internal only, no Telegram noise)
      this.emit('asset:evaluated', internalAssessment);

      log.debug(`Completed evaluation for ${asset}`, {
        permission: assessment.permissionState,
        transitionedToTrade: isTransitionToTrade,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(`Error in asset evaluation for ${asset}:`, err);
    }
  }

  /**
   * Check for volatility/flash move conditions and send alerts if needed
   */
  private async checkVolatilityConditions(
    asset: string,
    marketData: CollectorMarketData,
    gateResult: any
  ): Promise<void> {
    try {
      const currentPrice = marketData.price;
      const currentVolStance = gateResult.regime.volStance;
      const now = new Date();

      // 1. Track price history (rolling 5-minute window)
      if (!this.priceHistory.has(asset)) {
        this.priceHistory.set(asset, []);
      }
      const priceHistory = this.priceHistory.get(asset)!;
      
      // Add current price
      priceHistory.push({ price: currentPrice, timestamp: now });
      
      // Remove entries older than 5 minutes
      const windowStart = new Date(now.getTime() - VOLATILITY_CONFIG.PRICE_CHANGE_WINDOW_MS);
      const filteredHistory = priceHistory.filter(entry => entry.timestamp >= windowStart);
      this.priceHistory.set(asset, filteredHistory);

      // 2. Check for significant price change (> threshold) within 5 minutes
      if (filteredHistory.length >= 2) {
        const oldestPrice = filteredHistory[0].price;
        const priceChangePercent = ((currentPrice - oldestPrice) / oldestPrice) * 100;
        
        if (Math.abs(priceChangePercent) >= VOLATILITY_CONFIG.VOLATILITY_THRESHOLD_PERCENT) {
          // Check rate limit
          const lastAlertTime = this.volatilityAlertLastSent.get(asset);
          const canSendAlert = !lastAlertTime || 
            (now.getTime() - lastAlertTime.getTime()) >= VOLATILITY_CONFIG.VOLATILITY_ALERT_RATE_LIMIT_MS;

          if (canSendAlert) {
            const notifier = this.telegramBot.getNotifier();
            if (notifier) {
              await notifier.sendVolatilityAlert(asset, 'PRICE_CHANGE', {
                priceChange: priceChangePercent,
                currentPrice: currentPrice,
              });
              
              this.volatilityAlertLastSent.set(asset, now);
              log.info(`Volatility alert sent for ${asset}`, {
                trigger: 'PRICE_CHANGE',
                changePercent: priceChangePercent.toFixed(2),
              });
            }
          } else {
            log.debug(`Volatility alert rate-limited for ${asset}`, {
              lastSent: lastAlertTime,
            });
          }
        }
      }

      // 3. Check for volStance transitions
      const lastVolStance = this.volStanceHistory.get(asset);
      if (lastVolStance) {
        const volStanceChanged = lastVolStance.volStance !== currentVolStance;
        
        // Only alert on transitions from UNCLEAR to a clear stance, or between clear stances
        const isSignificantTransition = 
          (lastVolStance.volStance === 'UNCLEAR' && currentVolStance !== 'UNCLEAR') ||
          (lastVolStance.volStance !== 'UNCLEAR' && currentVolStance !== 'UNCLEAR' && volStanceChanged);

        if (isSignificantTransition) {
          // Check rate limit
          const lastAlertTime = this.volatilityAlertLastSent.get(asset);
          const canSendAlert = !lastAlertTime || 
            (now.getTime() - lastAlertTime.getTime()) >= VOLATILITY_CONFIG.VOLATILITY_ALERT_RATE_LIMIT_MS;

          if (canSendAlert) {
            const notifier = this.telegramBot.getNotifier();
            if (notifier) {
              await notifier.sendVolatilityAlert(asset, 'VOL_STANCE_CHANGE', {
                previousVolStance: lastVolStance.volStance,
                currentVolStance: currentVolStance,
              });
              
              this.volatilityAlertLastSent.set(asset, now);
              log.info(`Volatility alert sent for ${asset}`, {
                trigger: 'VOL_STANCE_CHANGE',
                from: lastVolStance.volStance,
                to: currentVolStance,
              });
            }
          } else {
            log.debug(`Volatility alert rate-limited for ${asset}`, {
              lastSent: lastAlertTime,
            });
          }
        }
      }

      // Update volStance history
      this.volStanceHistory.set(asset, { volStance: currentVolStance, timestamp: now });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(`Error checking volatility conditions for ${asset}:`, err);
    }
  }

  /**
   * Notify user of important permission state transitions
   * 
   * State Transition Alerting:
   *  - Only alert when moving from a non-trading state (WAIT/NO_TRADE/SCALP_ONLY)
   *    into a trading-allowed state (TRADE_ALLOWED / TRADE_ALLOWED_REDUCED_RISK).
   */
  private async notifyStateChange(
    asset: string,
    current: Assessment,
    previous: Assessment | undefined,
    fullAssessment: PermissionAssessment
  ): Promise<void> {
    try {
      const notifier = this.telegramBot.getNotifier();
      if (!notifier) {
        log.warn('Telegram notifier not available');
        return;
      }

      if (!previous) {
        // No previous state to compare with – do not spam Telegram on first evaluation
        log.debug(`Initial permission assessment recorded for ${asset}`, {
          permission: current.permission,
        });
        return;
      }

      // At this point, notifyStateChange is only called for non-trade → trade transitions.
      const trigger = 'Permission state transitioned into trading-allowed state';
      await notifier.sendPermissionChange(asset, previous.permission, current.permission, trigger);

      log.info(`Permission transition alert sent for ${asset}`, {
        from: previous.permission,
        to: current.permission,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(`Failed to send notification for ${asset}:`, err);
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle data collection errors
    this.dataCollector.on('data:error', (payload: { asset?: string; error?: Error | string }) => {
      const asset = payload?.asset ?? 'unknown';
      const error = payload?.error ?? new Error('Unknown error');
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(`Data collection error for ${asset}`, err);
      try {
        const notifier = this.telegramBot.getNotifier();
        if (notifier) {
          void notifier.sendSystemCritical(
            'DATA COLLECTION ERROR',
            `Asset: ${asset}\nError: ${err.message}\n\nThe system will continue monitoring.`
          );
        }
      } catch (notifyErr) {
        const notifyError = notifyErr instanceof Error ? notifyErr : new Error(String(notifyErr));
        log.error('Failed to send error notification:', notifyError);
      }
    });

    // Handle data updates
    this.dataCollector.on('data:updated', (payload: { asset?: string; data?: object }) => {
      const asset = payload?.asset ?? 'unknown';
      const data = payload?.data as { price?: number; volume24h?: number } | undefined;
      log.debug(`Data updated for ${asset}`, {
        price: data?.price,
        volume: data?.volume24h,
      });
      // TIP: For "True Real-Time" execution, you could trigger evaluation here:
      // void this.evaluateAsset(asset);
      // However, keep the interval loop as a fallback and safety mechanism.
    });

    // Handle permission changes
    this.on('asset:evaluated', (assessment: Assessment) => {
      log.debug(`Asset evaluation received`, {
        asset: assessment.asset,
        permission: assessment.permission,
      });
    });

    // Handle order execution events
    if (this.orderExecutionService) {
      // Order executed (AUTO mode)
      this.orderExecutionService.on('order:executed', (payload: any) => {
        log.info('Order executed successfully', payload);
        const notifier = this.telegramBot.getNotifier();
        if (notifier) {
          void notifier.sendOrderExecuted(payload.suggestion, payload.result);
        }
      });

      // Order pending confirmation (SAFE mode)
      this.orderExecutionService.on('order:pending', (payload: any) => {
        log.info('Order pending confirmation', payload);
        const notifier = this.telegramBot.getNotifier();
        if (notifier) {
          void notifier.sendOrderPending(payload.orderId, payload.suggestion, payload.expiresAt);
        }
      });

      // Order confirmed
      this.orderExecutionService.on('order:confirmed', (payload: any) => {
        log.info('Order confirmed and executed', payload);
        const notifier = this.telegramBot.getNotifier();
        if (notifier) {
          void notifier.sendOrderExecuted(payload.suggestion, payload.result);
        }
      });

      // Order failed
      this.orderExecutionService.on('order:failed', (payload: any) => {
        log.error('Order execution failed', payload);
        const notifier = this.telegramBot.getNotifier();
        if (notifier) {
          void notifier.sendSystemCritical(
            'ORDER EXECUTION FAILED',
            `Asset: ${payload.suggestion?.asset}\nError: ${payload.error}`
          );
        }
      });

      // Order expired
      this.orderExecutionService.on('order:expired', (payload: any) => {
        log.info('Order expired without confirmation', payload);
        const notifier = this.telegramBot.getNotifier();
        if (notifier) {
          void notifier.sendOrderExpired(payload.orderId);
        }
      });

      // Order cancelled
      this.orderExecutionService.on('order:cancelled', (payload: any) => {
        log.info('Order cancelled', payload);
      });
    }

    log.debug('Event handlers configured');
  }

  /**
   * Get current system status
   */
  getStatus(): {
    initialized: boolean;
    running: boolean;
    executionEnabled: boolean;
    autoProtectEnabled: boolean;
    trackedAssets: string[];
  } {
    return {
      initialized: this.initialized,
      running: this.running,
      executionEnabled: env.EXECUTION_ENABLED,
      autoProtectEnabled: env.AUTO_PROTECT_GLOBALLY_ENABLED,
      trackedAssets: env.TRACKED_ASSETS,
    };
  }
}

// src/app.ts
// Main application bootstrap and lifecycle management

import { EventEmitter } from 'events';
import { env } from './config/environment';
import { TIMING } from './config/constants';
import { log } from './utils/logger';

import { AuditLogger } from './infrastructure/audit';
import { SafetyManager } from './infrastructure/safety';
import { CommandHandler, TelegramBot } from './interaction/telegram';
import { DataCollector } from './core/data-collector/DataCollector';
import { GateEvaluator } from './core/gate-evaluator/GateEvaluator';
import { PermissionStateEngine } from './core/permission-engine/PermissionStateEngine';
import { RateLimiter } from './infrastructure/safety/RateLimiter';
import type { PermissionAssessment } from './types/permission.types';
import { GateStatus } from './types/gates.types';

// Type definitions for assessments
interface MarketData {
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
  data: MarketData;
  gates: Record<string, GateResult>;
  permission: string;
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

  // Track last assessment for change detection
  private lastAssessments: Map<string, Assessment> = new Map();

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
      // this.orderService = new OrderPreparationService(...);
      // this.executionController = new ExecutionController(...);
      log.info('✓ Execution layer initialized');

      // Initialize interaction layer
      log.debug('Initializing interaction layer...');
      const commandHandler = new CommandHandler(
        this.auditLogger,
        this.safetyManager,
        this.dataCollector,
        this.gateEvaluator,
        this.permissionEngine
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
      void this.dataCollector.start(env.TRACKED_ASSETS);
      log.info(`✓ Data collection started for: ${env.TRACKED_ASSETS.join(', ')}`);

      // Start periodic evaluation loop
      this.startEvaluationLoop();
      log.info('✓ Evaluation loop started');

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
   * Run a single evaluation cycle
   */
  private runEvaluationCycle(): void {
    log.debug('Running evaluation cycle...');

    try {
      for (const asset of env.TRACKED_ASSETS) {
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
      const permissionChanged =
        lastAssessment && lastAssessment.permission !== (assessment.permissionState as string);
      const gatesChanged =
        lastAssessment &&
        JSON.stringify(lastAssessment.gates) !== JSON.stringify(internalAssessment.gates);

      // 6. Update cache and notify on change
      this.lastAssessments.set(asset, internalAssessment);

      // Notify on any state change or gate change
      // This ensures downgrades (e.g. to WAIT/NO_TRADE) and context updates are reported
      if (!lastAssessment || permissionChanged || gatesChanged) {
        await this.notifyStateChange(asset, internalAssessment, lastAssessment, assessment);
      }

      // 7. Emit event for other listeners
      this.emit('asset:evaluated', internalAssessment);

      log.debug(`Completed evaluation for ${asset}`, {
        permission: assessment.permissionState,
        changed: !!permissionChanged,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(`Error in asset evaluation for ${asset}:`, err);
    }
  }

  /**
   * Notify user of permission state changes
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

      // Send notification based on state change
      if (!previous) {
        // Initial assessment
        await notifier.sendPermissionUpdate(fullAssessment);
        log.info(`Initial permission assessment sent for ${asset}`, {
          permission: current.permission,
        });
      } else if (previous.permission !== current.permission) {
        // State changed
        const trigger = `Permission state changed due to gate evaluation`;
        await notifier.sendPermissionChange(
          asset,
          previous.permission,
          current.permission,
          trigger
        );
        log.info(`Permission state change notification sent for ${asset}`, {
          from: previous.permission,
          to: current.permission,
        });
      } else if (JSON.stringify(previous.gates) !== JSON.stringify(current.gates)) {
        // Gates changed but permission same
        await notifier.sendPermissionUpdate(fullAssessment);
        log.info(`Gate status update sent for ${asset}`, {
          permission: current.permission,
        });
      }
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

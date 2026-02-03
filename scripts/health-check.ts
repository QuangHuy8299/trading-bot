#!/usr/bin/env ts-node
// scripts/health-check.ts
// System health check script

import { env } from '../src/config/environment';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    name: string;
    status: 'pass' | 'fail';
    message?: string;
  }[];
  timestamp: Date;
}

async function runHealthCheck(): Promise<HealthCheckResult> {
  const checks: HealthCheckResult['checks'] = [];

  // Check 1: Environment loaded
  try {
    if (env.TELEGRAM_BOT_TOKEN && env.BINANCE_API_KEY) {
      checks.push({ name: 'environment', status: 'pass' });
    } else {
      checks.push({ 
        name: 'environment', 
        status: 'fail', 
        message: 'Missing required environment variables' 
      });
    }
  } catch (error) {
    checks.push({ 
      name: 'environment', 
      status: 'fail', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }

  // Check 2: Safety configuration
  if (!env.EXECUTION_ENABLED) {
    checks.push({ 
      name: 'safety', 
      status: 'pass',
      message: 'Execution disabled (safe mode)' 
    });
  } else {
    checks.push({ 
      name: 'safety', 
      status: 'pass',
      message: 'Execution enabled (use caution)' 
    });
  }

  // Determine overall status
  const failedChecks = checks.filter(c => c.status === 'fail');
  let status: HealthCheckResult['status'];
  
  if (failedChecks.length === 0) {
    status = 'healthy';
  } else if (failedChecks.length < checks.length) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  return {
    status,
    checks,
    timestamp: new Date(),
  };
}

// Run health check
runHealthCheck()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'unhealthy' ? 1 : 0);
  })
  .catch((error) => {
    console.error('Health check failed:', error);
    process.exit(1);
  });

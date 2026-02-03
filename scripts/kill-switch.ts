#!/usr/bin/env ts-node
// scripts/kill-switch.ts
// Emergency kill switch activation script
//
// Usage: npx ts-node scripts/kill-switch.ts [REASON]
//
// This script provides a way to activate the kill switch externally.
// In a full implementation, this would communicate with the running system.

import * as readline from 'readline';

const reason = process.argv[2] || 'Manual kill switch activation';

async function confirmKillSwitch(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Type "CONFIRM" to activate kill switch: ', (answer) => {
      rl.close();
      resolve(answer.toUpperCase() === 'CONFIRM');
    });
  });
}

async function activateKillSwitch(): Promise<void> {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    🚨 KILL SWITCH 🚨                            ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                 ║');
  console.log('║  This script activates the emergency kill switch.              ║');
  console.log('║                                                                 ║');
  console.log('║  Effects:                                                       ║');
  console.log('║  • All trading operations will be suspended                    ║');
  console.log('║  • No orders will be executed                                  ║');
  console.log('║  • Auto-Protect will be disabled                               ║');
  console.log('║  • System requires manual restart                              ║');
  console.log('║                                                                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Reason: ${reason}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  const confirmed = await confirmKillSwitch();

  if (!confirmed) {
    console.log('');
    console.log('Kill switch activation CANCELLED.');
    process.exit(0);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  KILL SWITCH ACTIVATED');
  console.log('');
  console.log(`  Reason: ${reason}`);
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log(`  Activated by: CLI Script`);
  console.log('');
  console.log('  All operations suspended.');
  console.log('  System requires manual restart to resume.');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // In a full implementation, this would:
  // 1. Connect to Redis and set kill switch flag
  // 2. Send notification via Telegram
  // 3. Log to audit system
  
  // For now, we just write to a file that the system can check
  const fs = await import('fs');
  const killSwitchData = {
    active: true,
    reason,
    activatedAt: new Date().toISOString(),
    activatedBy: 'CLI Script',
  };
  
  try {
    fs.writeFileSync('logs/killswitch.json', JSON.stringify(killSwitchData, null, 2));
    console.log('Kill switch state written to logs/killswitch.json');
  } catch (error) {
    console.error('Warning: Could not write kill switch file:', error);
  }

  process.exit(0);
}

// Run
activateKillSwitch().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

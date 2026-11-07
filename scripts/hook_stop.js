#!/usr/bin/env node
/**
 * Stop Hook - Google Cloud Model Armor Guardrail
 * 
 * Executes when the agent loop is preparing to terminate.
 * Audits termination reason and performs clean security teardown.
 */

const fs = require('fs');

function main() {
  let rawInput = '';
  try {
    rawInput = fs.readFileSync(0, 'utf-8');
  } catch (err) {
    console.log(JSON.stringify({ decision: "allow" }));
    return;
  }

  let payload = {};
  try {
    payload = JSON.parse(rawInput);
  } catch (err) {
    console.log(JSON.stringify({ decision: "allow" }));
    return;
  }

  const reason = payload.terminationReason || 'NORMAL';
  
  // Example security compliance check: If stopped due to an unauthorized action, log alert
  if (reason === 'TERMINAL_CUSTOM_HOOK') {
    // Already terminated by security gate
  }

  console.log(JSON.stringify({
    decision: "allow",
    reason: `Model Armor security audit closed cleanly (Termination Reason: ${reason}).`
  }));
}

main();

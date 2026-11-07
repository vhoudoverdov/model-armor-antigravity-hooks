#!/usr/bin/env node
/**
 * PostToolUse Hook - Google Cloud Model Armor Guardrail
 * 
 * Intercepts tool execution results before the output is ingested into the agent's context.
 * Audits tool results for indirect prompt injections or leaked secrets.
 * 
 * Spec: Antigravity PostToolUse expects an empty JSON object `{}` on stdout.
 * Security alerts are recorded in audit logs or local security telemetry.
 */

const fs = require('fs');
const path = require('path');
const { sanitizeUserPrompt, DEFAULT_TEMPLATE } = require('./model_armor_client');

async function main() {
  let rawInput = '';
  try {
    rawInput = fs.readFileSync(0, 'utf-8');
  } catch (err) {
    console.log(JSON.stringify({}));
    return;
  }

  let payload = {};
  try {
    payload = JSON.parse(rawInput);
  } catch (err) {
    console.log(JSON.stringify({}));
    return;
  }

  const transcriptPath = payload.transcriptPath;
  const toolName = (payload.toolCall && payload.toolCall.name) || 'unknown';

  // Read latest tool result from transcript if accessible to scan for indirect injection
  if (transcriptPath && fs.existsSync(transcriptPath)) {
    try {
      const lines = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n');
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        const step = JSON.parse(lastLine);
        const textToAudit = step.content || JSON.stringify(step.tool_calls || '');
        
        if (textToAudit && textToAudit.length > 20) {
          const verdict = await sanitizeUserPrompt(textToAudit.slice(0, 4000));
          if (verdict.isBlocked) {
            console.error(`🚨 [Model Armor Alert] Indirect injection/leak detected in tool result (${toolName}): ${verdict.summary}`);
          }
        }
      }
    } catch (e) {
      // Non-fatal audit log error
    }
  }

  // Contract requires empty JSON object on stdout
  console.log(JSON.stringify({}));
}

main();

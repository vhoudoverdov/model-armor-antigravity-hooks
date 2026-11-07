#!/usr/bin/env node
/**
 * PreToolUse Hook - Google Cloud Model Armor Guardrail
 * 
 * Intercepts tool calls before execution (e.g., run_command, write_file, web requests).
 * Inspects tool arguments against Model Armor template:
 * https://modelarmor.us-central1.rep.googleapis.com/v1/projects/secops-guardrail-prod/locations/us-central1/templates/enterprise-agent-guardrails:sanitizeUserPrompt
 * 
 * Blocks dangerous shell commands, data exfiltration, or indirect prompt injections
 * before they can affect the local system or workspace.
 */

const fs = require('fs');
const { sanitizeUserPrompt, DEFAULT_TEMPLATE } = require('./model_armor_client');

async function main() {
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
    console.error('[ModelArmor-PreToolUse] Error parsing stdin JSON:', err.message);
    console.log(JSON.stringify({ decision: "allow" }));
    return;
  }

  const toolCall = payload.toolCall || {};
  const toolName = toolCall.name || 'unknown_tool';
  const toolArgs = toolCall.args || {};

  // Extract meaningful text content from tool arguments to scan
  let textToAudit = '';
  if (toolArgs.CommandLine) {
    textToAudit = `Command to execute: ${toolArgs.CommandLine}`;
  } else if (toolArgs.Content) {
    textToAudit = `File write payload: ${toolArgs.Content.slice(0, 4000)}`;
  } else if (toolArgs.Replacement) {
    textToAudit = `File edit replacement: ${toolArgs.Replacement.slice(0, 4000)}`;
  } else if (toolArgs.query) {
    textToAudit = `Search query: ${toolArgs.query}`;
  } else {
    textToAudit = `Tool [${toolName}] arguments: ${JSON.stringify(toolArgs)}`;
  }

  try {
    const verdict = await sanitizeUserPrompt(textToAudit);

    if (verdict.isBlocked) {
      // Check if it's an extreme threat (jailbreak/malicious URI) vs potential policy check
      const hasSevereExploit = verdict.violations.some(v => 
        v.includes('Prompt Injection') || v.includes('Malicious URI')
      );

      if (hasSevereExploit) {
        // Hard block immediately
        console.log(JSON.stringify({
          decision: "deny",
          reason: `🚨 Blocked by Model Armor (${DEFAULT_TEMPLATE}): ${verdict.summary}`
        }));
      } else {
        // For moderate threats or PII, escalate to human-in-the-loop confirmation
        console.log(JSON.stringify({
          decision: "force_ask",
          reason: `⚠️ Model Armor caution: ${verdict.summary}. Human approval required.`
        }));
      }
    } else {
      // Safe to proceed
      console.log(JSON.stringify({
        decision: "allow",
        reason: "Model Armor inspection passed."
      }));
    }
  } catch (apiError) {
    console.error('[ModelArmor-PreToolUse] API Error:', apiError.message);
    // In production security, require explicit user confirmation if the safety service is unreachable
    console.log(JSON.stringify({
      decision: "ask",
      reason: `Model Armor screening service unavailable (${apiError.message}). Please confirm tool execution.`
    }));
  }
}

main();

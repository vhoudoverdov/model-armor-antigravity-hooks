#!/usr/bin/env node
/**
 * SessionStart Hook - Google Cloud Model Armor Guardrail
 * 
 * Executes once at the start of an Antigravity conversation session.
 * Confirms guardrail configuration and injects an active security policy banner.
 */

const { DEFAULT_LOCATION, DEFAULT_PROJECT, DEFAULT_TEMPLATE } = require('./model_armor_client');

function main() {
  const bannerMessage = 
    `🛡️ [Security Active] Google Cloud Model Armor runtime guardrails are active.\n` +
    `Policy Template: projects/${DEFAULT_PROJECT}/locations/${DEFAULT_LOCATION}/templates/${DEFAULT_TEMPLATE}\n` +
    `Protected Lifecycle Stages: SessionStart | PreInvocation | PreToolUse | PostToolUse | PostInvocation | Stop.`;

  const output = {
    injectSteps: [
      {
        systemMessage: {
          systemMessage: bannerMessage
        }
      }
    ]
  };

  console.log(JSON.stringify(output));
}

main();

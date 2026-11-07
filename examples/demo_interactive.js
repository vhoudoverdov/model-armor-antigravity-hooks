#!/usr/bin/env node
/**
 * Interactive Demonstration Tool for Antigravity Model Armor Hooks
 * 
 * Allows security engineers and developers to test arbitrary prompts, commands,
 * and payloads interactively, watching how Model Armor evaluates them at each
 * lifecycle hook stage.
 */

const readline = require('readline');
const { sanitizeUserPrompt, sanitizeModelResponse, DEFAULT_TEMPLATE } = require('../scripts/model_armor_client');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('====================================================================');
console.log('🛡️ Antigravity & Google Cloud Model Armor Interactive Demo');
console.log(`Template: ${DEFAULT_TEMPLATE}`);
console.log('====================================================================\n');

function showMenu() {
  console.log('\nSelect a lifecycle hook stage to simulate:');
  console.log('  1. PreInvocation (User Prompt & Jailbreak Detection)');
  console.log('  2. PreToolUse    (Command & Tool Argument Inspection)');
  console.log('  3. PostInvocation (Model Completion & PII Suppression)');
  console.log('  4. Exit');
  rl.question('\nEnter choice (1-4): ', handleChoice);
}

async function handleChoice(choice) {
  switch (choice.trim()) {
    case '1':
      rl.question('\n[PreInvocation] Enter user prompt to test:\n> ', async (prompt) => {
        console.log('\nAnalyzing via Model Armor sanitizeUserPrompt...');
        const verdict = await sanitizeUserPrompt(prompt);
        console.log('\n--- Model Armor Verdict ---');
        console.log(`Match State : ${verdict.matchState}`);
        console.log(`Blocked     : ${verdict.isBlocked}`);
        console.log(`Summary     : ${verdict.summary}`);
        console.log('\n--- Antigravity Hook Response ---');
        if (verdict.isBlocked) {
          console.log(JSON.stringify({
            injectSteps: [{ errorMessage: { userMessage: `🚨 Blocked: ${verdict.summary}` } }],
            terminationBehavior: "terminate"
          }, null, 2));
        } else {
          console.log(JSON.stringify({ injectSteps: [], terminationBehavior: "" }, null, 2));
        }
        showMenu();
      });
      break;

    case '2':
      rl.question('\n[PreToolUse] Enter terminal command to test:\n> ', async (cmd) => {
        console.log('\nAnalyzing via Model Armor sanitizeUserPrompt...');
        const verdict = await sanitizeUserPrompt(`Command: ${cmd}`);
        console.log('\n--- Model Armor Verdict ---');
        console.log(`Match State : ${verdict.matchState}`);
        console.log(`Blocked     : ${verdict.isBlocked}`);
        console.log(`Summary     : ${verdict.summary}`);
        console.log('\n--- Antigravity Hook Response ---');
        if (verdict.isBlocked) {
          console.log(JSON.stringify({
            decision: "deny",
            reason: `🚨 Blocked by Model Armor: ${verdict.summary}`
          }, null, 2));
        } else {
          console.log(JSON.stringify({
            decision: "allow",
            reason: "Passed Model Armor inspection."
          }, null, 2));
        }
        showMenu();
      });
      break;

    case '3':
      rl.question('\n[PostInvocation] Enter model output to test:\n> ', async (text) => {
        console.log('\nAnalyzing via Model Armor sanitizeModelResponse...');
        const verdict = await sanitizeModelResponse(text);
        console.log('\n--- Model Armor Verdict ---');
        console.log(`Match State : ${verdict.matchState}`);
        console.log(`Blocked     : ${verdict.isBlocked}`);
        console.log(`Summary     : ${verdict.summary}`);
        console.log('\n--- Antigravity Hook Response ---');
        if (verdict.isBlocked) {
          console.log(JSON.stringify({
            injectSteps: [{ errorMessage: { userMessage: `🚨 Model output suppressed: ${verdict.summary}` } }],
            terminationBehavior: "terminate"
          }, null, 2));
        } else {
          console.log(JSON.stringify({ injectSteps: [], terminationBehavior: "" }, null, 2));
        }
        showMenu();
      });
      break;

    case '4':
      console.log('Exiting demo. Stay safe!');
      rl.close();
      process.exit(0);
      break;

    default:
      console.log('Invalid option. Please choose 1-4.');
      showMenu();
  }
}

showMenu();

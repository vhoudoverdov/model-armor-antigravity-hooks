# Contributing to Antigravity Model Armor Hooks

We welcome contributions to expand guardrail coverage, add new lifecycle hook examples, and support additional security tools.

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/antigravity-model-armor-hooks.git
   cd antigravity-model-armor-hooks
   ```

2. Run tests locally:
   ```bash
   node examples/run_tests.js
   ```

3. Try the interactive demo:
   ```bash
   node examples/demo_interactive.js
   ```

## Adding New Hook Integrations

When proposing new lifecycle hook features:
- Adhere strictly to the JSON schemas defined in the [Antigravity Hooks Specification](https://antigravity.google/docs/hooks/).
- Ensure hook scripts support graceful fallback handling (e.g. API timeouts).
- Provide corresponding test cases in `examples/run_tests.js`.

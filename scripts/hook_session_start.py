#!/usr/bin/env python3
"""SessionStart Hook in Python - Google Cloud Model Armor Guardrail."""

import json
from model_armor_client import DEFAULT_LOCATION, DEFAULT_PROJECT, DEFAULT_TEMPLATE


def main():
    banner = (
        "🛡️ [Security Active] Google Cloud Model Armor runtime guardrails are active.\n"
        f"Policy Template: projects/{DEFAULT_PROJECT}/locations/{DEFAULT_LOCATION}/templates/{DEFAULT_TEMPLATE}\n"
        "Protected Lifecycle Stages: SessionStart | PreInvocation | PreToolUse | PostToolUse | PostInvocation | Stop."
    )
    print(json.dumps({"injectSteps": [{"systemMessage": {"systemMessage": banner}}]}))


if __name__ == "__main__":
    main()

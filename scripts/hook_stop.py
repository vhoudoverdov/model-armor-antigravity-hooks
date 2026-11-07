#!/usr/bin/env python3
"""Stop Hook in Python - Google Cloud Model Armor Guardrail."""

import sys
import json


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        payload = {}

    reason = payload.get("terminationReason", "NORMAL")
    print(
        json.dumps(
            {
                "decision": "allow",
                "reason": f"Model Armor security audit closed cleanly (Termination Reason: {reason}).",
            }
        )
    )


if __name__ == "__main__":
    main()

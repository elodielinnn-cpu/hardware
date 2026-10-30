#!/usr/bin/env python3
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: validate-schema.py SCHEMA JSON_DOCUMENT")
    schema = json.loads(Path(sys.argv[1]).read_text())
    document = json.loads(Path(sys.argv[2]).read_text())
    Draft202012Validator.check_schema(schema)
    errors = sorted(Draft202012Validator(schema).iter_errors(document), key=lambda item: list(item.absolute_path))
    payload = {
        "valid": not errors,
        "draft": "2020-12",
        "errors": [
            {
                "path": "/" + "/".join(str(part) for part in error.absolute_path),
                "schemaPath": "/" + "/".join(str(part) for part in error.absolute_schema_path),
                "message": error.message,
            }
            for error in errors
        ],
    }
    print(json.dumps(payload, ensure_ascii=False))
    return 0 if payload["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

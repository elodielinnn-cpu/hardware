# Qwen News Semantic Evaluation

This directory is an offline, production-isolated evaluation harness for Qwen3-4B and Qwen3-8B. It does not import or modify the production fetch, scoring, validation, workflow, or generated-data code.

## Dataset

- `cases.json`: 20 model inputs selected from `origin/main:real-data.js` at commit `8300b64eddaa3ddbf4442bfdcb135d22b2527481`.
- `human-labels.json`: independent review references. The runner never sends these labels to the model.
- `response.schema.json`: required structured response.
- `system-prompt.txt`: common instructions for both models.
- `run-eval.mjs`: sequential client for a local OpenAI-compatible `llama-server` endpoint.
- `validate-results.mjs`: validates the response schema, exact evidence quotes, and reference classifications.

The independent `.github/workflows/qwen-offline-smoke.yml` workflow runs only through `workflow_dispatch`. It selects `high-04-apple-manufacturing` and `hide-06-office-promotion`, writes diagnostics under `results/smoke/`, and uploads those files as an Actions artifact. It never invokes the production news generator or writes `real-data.js`.

After the workflow file is present on the repository's default branch, run it from **Actions → Qwen offline news smoke test → Run workflow**. The job uses a standard Ubuntu runner, builds a pinned llama.cpp CPU server, downloads the checksum-pinned model from the official Qwen repository, and binds the inference endpoint to `127.0.0.1` only.

The workflow requires at least 7 GiB of available RAM and 7 GiB of free runner disk, uses one inference slot, four CPU threads, a 4096-token context, a five-minute timeout per article, and a 45-minute job timeout. Build logs, download verification, runner resources, model load time, per-article latency, peak server RSS, raw structured responses, and validation results are uploaded for 14 days. Model weights remain in `RUNNER_TEMP` and are never uploaded or committed.

The `originalSummary` field is the attributable summary retained in the generated dataset. It is not represented as a verbatim full article. `bodyEvidence` contains only facts already retained from an RSS/Atom summary or extracted source page. Cases marked `limited` deliberately test whether the model abstains instead of inventing missing facts.

## Future execution

Do not run these commands until model download and tool installation are explicitly approved.

```bash
# Install one local runtime if it is still absent. Review the official installer first.
curl -LsSf https://llama.app/install.sh | sh

NODE="${NODE:-node}"

# Smoke-test the 4B model. The -hf option downloads the selected GGUF on first use.
llama serve \
  -hf Qwen/Qwen3-4B-GGUF:Q4_K_M \
  --host 127.0.0.1 --port 8080 \
  --jinja -c 8192 -t 8

MODEL="Qwen/Qwen3-4B-GGUF:Q4_K_M" \
  "$NODE" experiments/qwen-news-semantic-eval/run-eval.mjs

# Then repeat with the primary quality candidate.
llama serve \
  -hf Qwen/Qwen3-8B-GGUF:Q4_K_M \
  --host 127.0.0.1 --port 8080 \
  --jinja -c 8192 -t 8

MODEL="Qwen/Qwen3-8B-GGUF:Q4_K_M" \
  "$NODE" experiments/qwen-news-semantic-eval/run-eval.mjs
```

The runner writes only to `experiments/qwen-news-semantic-eval/results/`. It uses sequential requests, a five-minute per-article timeout, schema-constrained JSON, and no remote API key.

## Review method

Compare both models against `human-labels.json`, but review disagreements against the supplied source evidence rather than treating either the current production score or the reference label as automatically correct. Primary metrics are high-value recall, default-feed precision, event-stage accuracy, evidence quote validity, factual-summary fidelity, abstention quality, JSON validity, and latency.

# Qwen News Semantic Evaluation

This directory is an offline, production-isolated evaluation harness for Qwen3-4B and Qwen3-8B. It does not import or modify the production fetch, scoring, validation, workflow, or generated-data code.

## Dataset

- `cases.json`: 20 model inputs selected from `origin/main:real-data.js` at commit `8300b64eddaa3ddbf4442bfdcb135d22b2527481`.
- `human-labels.json`: independent review references. The runner never sends these labels to the model.
- `response.schema.json`: required structured response.
- `system-prompt.txt`: common instructions for both models.
- `run-eval.mjs`: sequential client for a local OpenAI-compatible `llama-server` endpoint. It writes one file per article plus an atomic cumulative checkpoint and resumes completed cases without another inference call.
- `validate-results.mjs`: separately reports schema, exact-evidence, cross-field consistency, and human-reference results. It also reports raw-model and deterministically constrained default-feed metrics without changing the model output.
- `plan-batches.mjs`: selects the two-case smoke scope or all 20 fixed cases and limits each batch to five articles.
- `merge-results.mjs`: combines independently completed batches in dataset order before aggregate evaluation.

The independent 4B and 8B workflows run only through `workflow_dispatch`. The 8B workflow offers `smoke` (the original two cases) and `full` (all 20 cases). Full runs use four serial batches of at most five articles. Completed batches are cached by model and evaluation-input hashes, each batch is uploaded separately, and an aggregate artifact contains the merged output and metrics. Neither workflow invokes the production news generator or writes `real-data.js`.

After the workflow file is present on the repository's default branch, run it from **Actions → Qwen offline news smoke test → Run workflow**. The job uses a standard Ubuntu runner, builds a pinned llama.cpp CPU server, downloads the checksum-pinned model from the official Qwen repository, and binds the inference endpoint to `127.0.0.1` only.

The 8B workflow requires at least 10 GiB of available RAM and 12 GiB of free runner disk, uses one inference slot, four CPU threads, a 4096-token context, no inference retries, a five-minute timeout per article, and a 55-minute timeout per batch. Build logs, download verification, runner resources, model load time, per-article latency, peak server RSS, raw structured responses, and validation results are uploaded for 14 days. Model weights remain in `RUNNER_TEMP` and are never uploaded or committed.

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

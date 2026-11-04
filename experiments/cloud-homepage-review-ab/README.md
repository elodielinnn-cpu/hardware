# GroqCloud / Gemini homepage-review A/B experiment

Independent, opt-in experiment for comparing cloud models on the conservative homepage quality-review task. It does not read or modify production news output.

## Frozen corpus and fairness

- `samples.json`: 30 fixed public-news samples, 20 expected `KEEP` and 10 expected `HIDE`.
- `human-labels.json`: independent labels and short rationales. Labels are never included in model requests.
- Both providers receive exactly the same title, summary, source, URL, system prompt, JSON Schema, temperature (`0`), and output budget (`220`).
- With `--provider=both`, provider order alternates for each article to reduce time-of-run bias.
- Reported request latency excludes deliberate provider pacing and retry waits; both are reported separately.

## Models and free-tier status (verified 2026-11-04)

| Provider | Model ID | Structured output | Free-tier constraint |
|---|---|---|---|
| GroqCloud | `openai/gpt-oss-20b` | strict JSON Schema | Published Free Plan: 30 RPM, 1,000 RPD, 8,000 TPM, 200,000 TPD. |
| Gemini Developer API | `gemini-3.5-flash-lite` | JSON Schema | Free input/output is documented. Active RPM/TPM/RPD is project/model/account specific and must be checked in AI Studio. Free-tier content may be used to improve Google products. |

Official documentation: [Groq models](https://console.groq.com/docs/models), [Groq limits](https://console.groq.com/docs/rate-limits), [Groq structured outputs](https://console.groq.com/docs/structured-outputs), [Gemini models](https://ai.google.dev/gemini-api/docs/models), [Gemini limits](https://ai.google.dev/gemini-api/docs/rate-limits), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), and [Gemini pricing/data-use summary](https://ai.google.dev/gemini-api/docs/pricing).

Free access and limits can change. The runner does not enable billing and cannot prove that an account is on the free tier; verify the provider console before a real run.

## Commands

```bash
node experiments/cloud-homepage-review-ab/run-ab.mjs --provider=both --dry-run
node experiments/cloud-homepage-review-ab/run-ab.mjs --provider=both --sample-limit=2 --dry-run
node experiments/cloud-homepage-review-ab/test-mock.mjs
```

A real run is deliberately explicit and requires environment variables. Do not put keys in files or command output:

```bash
GROQ_API_KEY=... GEMINI_API_KEY=... \
  node experiments/cloud-homepage-review-ab/run-ab.mjs --provider=both
```

Supported provider values: `groq`, `gemini`, `both`. Missing keys stop the run before a request is sent. `--dry-run` never reads keys and never sends a request.

`--sample-limit` accepts `1` through `30`. Selection is deterministic and alternates the fixed KEEP and HIDE queues; the default Actions preflight (`2`) is exactly `keep-nvidia-capacity` plus `hide-office-promo` for both providers. The CLI default remains the complete fixed corpus (`30`), so a larger run must always be explicit in the manual workflow form.

## GitHub Actions

The independent `cloud-homepage-review-ab.yml` workflow has only `workflow_dispatch`. Select `provider` and a `sampleLimit` from 1 to 30. It has no schedule, push, or pull-request trigger and does not invoke the production update workflow. Provider-specific steps receive only the secret(s) they need. Reports are uploaded from `outputs/cloud-homepage-review-ab/` and copied to the Actions step summary.

The API does not reliably prove that a project is using only free quota. The workflow records free-tier intent but does not call billing APIs or enable billing. Verify the Groq project plan and Gemini AI Studio project quota before clicking Run workflow.

## Measurements and safety

The artifact records configured and actual model IDs, per-article request latency, client pacing, retry wait, retry count, HTTP/429/timeout errors, provider token usage when returned, raw model output, schema/evidence validation, and deterministic-gate output. It calculates Accuracy, HIDE Precision/Recall, KEEP-to-HIDE false-hide risk, UNCERTAIN count, invalid JSON, and evidence failures.

Raw model `HIDE` is not executable. The independent evidence gate accepts HIDE only when the output is valid, its evidence is an exact title/summary substring, and the fixed mechanical audit context supports one of the narrow hide conditions. Otherwise the effective result is `KEEP`.

Only public title, summary, source, URL, and non-sensitive mechanical gate context are stored. The complete Luxshare profile and `user_confirmed_only` entries are not sent. Errors are truncated and credential-like text is redacted. No real accuracy, latency, stability, or provider recommendation exists until an authorized real free-tier run is completed.

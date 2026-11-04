# Gemini homepage quality review integration

This is an independent, shadow-only reviewer for articles already selected by the committed V3 news data. It never runs the news fetch, never changes relevance or priority, never writes `real-data.js` or `taxonomy.js`, and never changes homepage visibility.

## Schedule and snapshot safety

`.github/workflows/gemini-homepage-review.yml` runs at `30 0,6 * * *` (Beijing 08:30 and 14:30) and retains manual dispatch. Its concurrency group is separate from the V3 news workflow and serializes scheduled and manual Gemini review runs.

Every run checks out an immutable committed revision. Candidate preparation requires V3 metadata, matching metadata/article counts, and byte-identical root/site `real-data.js`. If the hourly news update has not pushed yet, the reviewer safely uses the prior committed snapshot. A mismatched or incomplete snapshot produces a `skipped` report with zero API requests and preserves the prior cache.

## Incremental cache

Only current `showByDefault=true` candidates are considered. A completed record is reusable only when all three values match:

- `candidateId`
- title/summary-derived `contentHash`
- `ruleVersion` (`gemini-homepage-shadow-v1`)

New homepage candidates, changed title/summary hashes, and retryable failures are selected. Unchanged completed records are skipped. Failures become retryable; after three failures for the same content they become `manual_review`. The Actions cache uses a unique run key plus a stable restore prefix, while an independent concurrency group prevents two runs from overwriting the restored state.

Cache records expire after 30 days. Records with an unknown status, missing identity or timestamp, a different rule version, or an invalid timestamp do not suppress a new review. A missing or corrupt cache therefore fails open without changing the V3 result.

## Fail-open and budgets

- Shadow mode records raw and deterministically validated HIDE suggestions but applies neither.
- Invalid JSON, evidence errors, timeout, 401/403/429, missing cache, or snapshot failure leaves V3 untouched.
- 401/403/429 stops further API calls in that run; unprocessed candidates remain eligible next time.
- Per run: at most 12 requests, 45 seconds per article, 50,000 input tokens and 3,000 output tokens. At two scheduled runs this is at most 24 requests per day, excluding explicit manual runs.
- The workflow uses only `GEMINI_API_KEY`, does not call billing APIs, and cannot prove that the account remains on free quota. It never upgrades billing automatically.

Only public article ID, title, summary, source, and URL are sent to Gemini. V3 audit data stays local for deterministic validation and is not part of the API request.

## Local checks

```bash
node experiments/gemini-homepage-review/test-integration.mjs
node experiments/gemini-homepage-review/test-snapshot.mjs
```

These tests use injected Mock responses and temporary data snapshots. They do not call Gemini.

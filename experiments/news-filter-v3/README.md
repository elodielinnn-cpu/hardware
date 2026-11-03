# Hardware Intelligence Radar V3 shadow filter

This directory contains the V3 news-filter modules and deterministic shadow tests. The production
fetcher can load them behind an explicit environment switch; the default daily workflow remains on
the legacy result until a separate production cutover is approved.

## Modules

- `business-profile.mjs`: loads the versioned Luxshare profile, matches aliases and specifications,
  separates the article subject from a related Luxshare product, and applies ambiguity guards.
- `news-filter-v3.mjs`: retains normal industry news, assigns relevance and priority independently,
  detects event stage, and makes an evidence-gated homepage decision.
- `funnel-planner.mjs`: assigns a stable candidate ID before transform, treats source include/exclude
  patterns as non-destructive signals, and creates a bounded round-robin detail-fetch plan with a
  deferred queue.
- `deferred-queue.mjs`: persists deferred base metadata atomically, prioritizes it on the next run,
  and keeps failed detail fetches pending until an explicit completed outcome is recorded.
- `run-shadow.mjs`: evaluates the current generated pool and the existing 20 fixed evidence cases,
  compares V3 results with legacy fields where available, and writes an audit report outside the
  repository by default.
- `test-v3.mjs`: deterministic regression and boundary tests. Synthetic entries are explicitly
  limited to rule coverage where no suitable fixed article exists, such as automotive gateway/TCU.

## Run locally

```sh
NODE=/Users/elodie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
"$NODE" experiments/news-filter-v3/test-v3.mjs
"$NODE" experiments/news-filter-v3/run-shadow.mjs /tmp/hardware-radar-v3-shadow.json
"$NODE" experiments/news-filter-v3/run-shadow.mjs /tmp/hardware-radar-v3-shadow.json /tmp/hardware-radar-v3-deferred.json
```

## Retention policy

V3 only excludes structurally invalid records, explicit advertisements/software promotions, and
clear garbage. Low-relevance technology and industry news remains in the complete collection.
`defaultVisible` is a display decision and never deletes an otherwise valid article.

## Runtime budget

The prototype caps a run at 600 parsed candidates, 60 candidates from any one source, and 80 full
text fetches in batches of 20 with at most 6 concurrent detail requests. Capacity-deferred records
remain in diagnostics for a later batch. These limits are active only with `NEWS_FILTER_MODE=v3`.

Every structurally valid candidate remains available as base metadata before detail fetching. The
optional third argument to `run-shadow.mjs` enables a durable local JSON queue. A later run gives
queued candidate IDs first priority; the caller must record `completed` or `failed` outcomes through
`recordDeferredOutcomes`. GitHub Actions restores and saves the queue as a non-blocking cache and
artifact, but it does not set `NEWS_FILTER_MODE`; scheduled publication therefore remains legacy.
Failed detail fetches remain as base metadata, retry at most three times, and then move to
`manual_review` rather than retrying forever.

## Production-preparation switches

- No variable or `NEWS_FILTER_MODE=legacy`: original fetch, classification, and output.
- `NEWS_FILTER_MODE=v3-shadow`: original fetch/output plus a V3 classification comparison report.
  It does not enable the broad candidate collector.
- `NEWS_FILTER_MODE=v3`: non-destructive source signals, fair detail-fetch budget, durable deferred
  queue, V3 classification, and V3 output. A collection-wide/profile failure falls back to legacy;
  a single-article exception falls back only that article.

Output paths have environment overrides so end-to-end tests can run under `/tmp` without touching
root or `site/` generated files.

Every newly generated `real-data.js` also records non-sensitive `radarGenerationMetadata` with the
active output mode, generation time, code version and article count. `NEWS_CODE_VERSION` can provide
the local commit SHA; GitHub Actions uses `GITHUB_SHA`. If V3 falls back to legacy, the metadata
records `legacy` rather than claiming that the output is V3.

## Known limits

- Keyword and alias matching proves textual scope, not a real supply relationship.
- User-confirmed direct classifications remain distinct from public evidence status.
- Semantic support for upstream impact and deep technical analysis can still require human or future
  model review.
- Cache eviction can remove the deferred queue. Its artifact remains available for manual recovery,
  but queue persistence is deliberately non-blocking so diagnostics cannot stop daily publication.

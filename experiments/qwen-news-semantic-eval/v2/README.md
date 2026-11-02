# Qwen news semantic evaluation V2 prototype

This directory is isolated from the production news pipeline. It defines the contract between future semantic extraction and deterministic business decisions; it does not call a model or change published data.

## Files

- `response.schema.json`: compact Draft 2020-12 claim-level extraction contract with bounded evidence, products, contexts and claims. It keeps article-subject versus related-product roles, event stages, explicit downstream impacts and evidence sufficiency, but removes summaries, repeated scores and the model homepage recommendation.
- `normalize-model-output.mjs`: program-owned compatibility layer that assigns claim IDs, locates evidence origins in the immutable source, derives fact status from event stage, validates cross-references and feeds the unchanged deterministic decision engine.
- `product-relations.json`: experiment-only upstream/downstream adjacency graph used to improve candidate recall. It does not assert Luxshare production capability.
- `profile-retriever.mjs`: high-recall bilingual alias retrieval, context disambiguation, neighbor expansion, trace capture, profile hashing, and full-profile fallback signaling.
- `decision-engine.mjs`: deterministic relevance, priority, admission, review, and rejection decisions. The model recommendation is retained but never used as the final decision.
- `test-v2.mjs`: package-free unit tests against the current 51-product business profile.
- `run-v2-eval.mjs`: isolated Qwen-compatible adapter with candidate-profile retrieval, llama.cpp token preflight, strict structured output, formal Schema validation, program-owned article/input-hash binding, source-contained evidence checks, deterministic decisions, and per-article failure isolation.
- `build-comparison-report.mjs`: compares human labels, immutable historical A output, optional historical B output, raw V2 extraction, and the V2 deterministic decision without using labels in inference.
- `prepare-smoke-manifest.mjs`: records the five exact case IDs, input hashes, profile and relation hashes, candidate-selection mode, static token estimates, and the requirement for runtime tokenizer counts.
- `validate-schema.py`: runs the official Python `jsonschema` Draft 2020-12 validator. The isolated workflow pins `jsonschema==4.25.1`.
- `runtime-config.mjs` and `preflight-runtime.mjs`: share the adapter's environment contract and verify the real GGUF path, llama-server executable, loopback endpoint, result path, context budget, and required repository inputs before model startup. `MODEL_PATH` loads the GGUF; `MODEL_ID` is the API alias sent by the adapter.

## Decision paths

The homepage accepts an article only through one of four evidence paths:

1. `direct_product_business`: a direct product plus a reliable material event, or specific direct-product customer sampling.
2. `important_customer_supply_chain_change`: a material or major customer/supply-chain context plus a reliable material event.
3. `major_platform_commercialization`: a major platform context plus reliable, already-occurred commercial availability. A confirmed future launch is retained as `needs_review`, not treated as GA.
4. `core_direct_technical_analysis`: a direct product plus evidence-backed analysis of a specific technical impact.

Every event path binds the product or strategic context to specific claim IDs and source-contained evidence IDs. Missing evidence produces `needs_review`, not automatic Low Relevance. Rumors, low priority, low relevance, upstream sampling without adoption, and articles without a qualifying path remain outside the homepage. A missing product ID does not block the supply-chain or major-platform paths.

Strategic contexts are event-only: a technical analysis normally emits an empty `contexts` array. `technical_analysis` claims use `eventStage=not_applicable`; importance language such as "increasingly critical" is not a future commercial plan. Products marked `unconfirmed` in the business profile may describe the article subject, but cannot be presented as a related Luxshare-produced product.

Array saturation, output truncation, Schema validity and transport failures are program-owned diagnostics. The model reports only semantic evidence status (`sufficient`, `insufficient`, `requires_full_text`, or `unable_to_assess`) and semantic reason codes. A full array is diagnostic only and never proves omission by itself.

`outputIntegrity` records the program-owned structured-output state, Schema result, finish reason, truncation, technical error, field limits and saturation independently from `evidenceSufficiency`. Legacy capacity codes are retained only in normalization diagnostics and never copied into semantic evidence gaps.

The real Run `41377842878` CPO output is replayed by `test-run-41377842878-replay.mjs`. The replay intentionally expects the historical output to fail the corrected Schema and normalization constraints while preserving its source-bound evidence and raw JSON unchanged. Historical replay is never counted as a successful inference under the new Schema.

Run `41381394905` is replayed separately by `test-run-41381394905-replay.mjs`. Its corrected contexts, stages and product role remain intact, while the semantic-only Schema intentionally rejects its legacy `complete` and `evidence_limit_reached` fields. Because the old `partial` status mixed semantic and engineering state, replay labels it `unable_to_assess` with `legacy_ambiguous` provenance rather than inventing a new model judgment. The program keeps the article at `needs_review`; it does not force homepage admission or count the replay as a new-Schema inference success.

The adapter stores the immutable original article and computes its input hash before inference. The model returns only the article ID and short evidence excerpts. The program then verifies the article ID, recomputes the input hash, and checks every excerpt against the original title, summary, or body evidence. Exact source containment and semantic support remain separate checks: the program can prove source membership and structural references, but it cannot prove general-language entailment. Unsupported profile adjacency is flagged for review rather than promoted to a direct-product fact.

## Run tests

```sh
node experiments/qwen-news-semantic-eval/v2/test-v2.mjs
```

The tests do not invoke Qwen or use the human labels as model input.

The independent workflow `.github/workflows/qwen-v2-offline-smoke.yml` is manual-only. Its `scope` input defaults to `single_cpo` (`edge-06-cpo-test-cost`) and can be changed to `five_case`. It uses the same pinned Qwen3-8B Q4_K_M model and llama.cpp revision as the existing 8B experiment, listens only on `127.0.0.1`, caps output at 800 tokens, and never writes production news data. Raw responses, formal validation, normalization diagnostics, retrieval traces, context-token counts, decisions, Schema metrics and runtime metrics are uploaded as one diagnostic artifact.

Candidate retrieval never rejects an article. Articles with no product match but an independent major-platform or customer-supply-chain signal receive compact path rules without the full 51-product profile. Ambiguous aliases expand only the implicated domains first. The complete profile remains the last fallback for unresolved cases.

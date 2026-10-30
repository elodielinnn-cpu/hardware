# Qwen news semantic evaluation V2 prototype

This directory is isolated from the production news pipeline. It defines the contract between future semantic extraction and deterministic business decisions; it does not call a model or change published data.

## Files

- `response.schema.json`: Draft 2020-12 claim-level extraction contract with short source evidence, article-subject versus related-product roles, claim bindings, strategic contexts, event stages, technical analysis, evidence sufficiency, and the raw model homepage recommendation. It intentionally does not ask the model to reproduce the source document.
- `product-relations.json`: experiment-only upstream/downstream adjacency graph used to improve candidate recall. It does not assert Luxshare production capability.
- `profile-retriever.mjs`: high-recall bilingual alias retrieval, context disambiguation, neighbor expansion, trace capture, profile hashing, and full-profile fallback signaling.
- `decision-engine.mjs`: deterministic relevance, priority, admission, review, and rejection decisions. The model recommendation is retained but never used as the final decision.
- `test-v2.mjs`: package-free unit tests against the current 51-product business profile.
- `run-v2-eval.mjs`: isolated Qwen-compatible adapter with candidate-profile retrieval, llama.cpp token preflight, strict structured output, formal Schema validation, program-owned article/input-hash binding, source-contained evidence checks, deterministic decisions, and per-article failure isolation.
- `build-comparison-report.mjs`: compares human labels, immutable historical A output, optional historical B output, raw V2 extraction, and the V2 deterministic decision without using labels in inference.
- `prepare-smoke-manifest.mjs`: records the five exact case IDs, input hashes, profile and relation hashes, candidate-selection mode, static token estimates, and the requirement for runtime tokenizer counts.
- `validate-schema.py`: runs the official Python `jsonschema` Draft 2020-12 validator. The isolated workflow pins `jsonschema==4.25.1`.

## Decision paths

The homepage accepts an article only through one of four evidence paths:

1. `direct_product_business`: a direct product plus a reliable material event, or specific direct-product customer sampling.
2. `important_customer_supply_chain_change`: a material or major customer/supply-chain context plus a reliable material event.
3. `major_platform_commercialization`: a major platform context plus reliable, already-occurred commercial availability. A confirmed future launch is retained as `needs_review`, not treated as GA.
4. `core_direct_technical_analysis`: a direct product plus evidence-backed analysis of a specific technical impact.

Every event path binds the product or strategic context to specific claim IDs and source-contained evidence IDs. Missing evidence produces `needs_review`, not automatic Low Relevance. Rumors, low priority, low relevance, upstream sampling without adoption, and articles without a qualifying path remain outside the homepage. A missing product ID does not block the supply-chain or major-platform paths.

The adapter stores the immutable original article and computes its input hash before inference. The model returns only the article ID and short evidence excerpts. The program then verifies the article ID, recomputes the input hash, and checks every excerpt against the original title, summary, or body evidence. Exact source containment and semantic support remain separate checks: the program can prove source membership and structural references, but it cannot prove general-language entailment. Unsupported profile adjacency is flagged for review rather than promoted to a direct-product fact.

## Run tests

```sh
node experiments/qwen-news-semantic-eval/v2/test-v2.mjs
```

The tests do not invoke Qwen or use the human labels as model input.

The independent workflow `.github/workflows/qwen-v2-offline-smoke.yml` is manual-only. It uses the same pinned Qwen3-8B Q4_K_M model and llama.cpp revision as the existing 8B experiment, listens only on `127.0.0.1`, and never writes production news data. Five fixed inputs are loaded directly from the existing `cases.json` by ID. Raw responses, formal validation, retrieval traces, context-token counts, decisions, comparison data, and runtime metrics are uploaded as one diagnostic artifact.

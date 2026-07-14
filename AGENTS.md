# AGENTS.md

## 1. Project purpose

This repository contains a static industry-news website intended for management-level readers.

The website focuses on:

* AI infrastructure
* Data centers and server hardware
* Consumer electronics and the 3C supply chain
* Semiconductor and electronic-component developments
* Luxshare Precision customers, competitors, partners, and relevant industry developments
* Major global technology and financial developments

The site is deployed through GitHub Pages. The public site currently uses the repository root, and `site/` is kept as a synchronized static publish copy for other deployment paths.

The general data flow is:

`news sources -> fetch/update scripts -> real-data.js / taxonomy.js -> data.js/app.js -> static HTML website`

Before changing this flow, inspect the actual repository structure and confirm the relevant files.

## 2. Default working mode

Work autonomously within the current repository.

Unless the user explicitly restricts the task, you may:

* Search and read all files inside the repository.
* Modify existing project files.
* Create files needed for the requested feature or fix.
* Remove files only when they are demonstrably obsolete and their removal is required by the task.
* Run local scripts.
* Run Node.js, npm, Git, and other repository-specific development commands.
* Install dependencies only when necessary for the requested task.
* Run tests, validation scripts, syntax checks, and local builds.
* Fix issues directly caused or exposed by your changes.
* Stage files and create one local Git commit after successful validation.

Do not stop after merely describing a solution when the requested work can be implemented directly.

Investigate, implement, validate, review the diff, and finish the task end to end.

## 3. Mandatory safety restrictions

Never perform any of the following unless the user gives an explicit instruction for that specific action:

* `git push`
* `git push --force`
* `git push --force-with-lease`
* Publishing or deploying through an external service
* Merging a pull request
* Rebasing or rewriting shared Git history
* Deleting Git branches
* Deleting Git tags
* Running `git reset --hard`
* Running `git clean`
* Discarding uncommitted user changes
* Modifying files outside the current repository
* Modifying operating-system settings
* Modifying global Git configuration
* Reading unrelated personal files, credentials, browser data, SSH keys, or tokens
* Exposing secrets in logs, commits, generated files, or responses

Never push automatically. A successful task should end with a local commit unless the user explicitly requests otherwise.

## 4. Existing work must be protected

Before making changes, run or inspect:

* `git status --short`
* `git branch --show-current`
* Recent relevant Git history
* The files directly involved in the task

Treat all pre-existing changes as user-owned.

Rules:

* Do not overwrite unrelated modifications.
* Do not revert changes you did not create.
* Do not stage unrelated files.
* Do not include unrelated files in the commit.
* Do not delete or modify existing untracked files unless the task explicitly requires it.
* If a file contains both user changes and required task changes, edit it carefully and preserve the user's work.
* If the repository is already dirty, clearly distinguish pre-existing changes from changes made during the current task.

## 5. Task execution workflow

For each implementation task, follow this sequence:

### Step 1: Understand

* Read the relevant files before editing.
* Trace the actual data and rendering flow.
* Identify the root cause rather than patching only visible symptoms.
* Check whether the same logic exists in both root and deployment directories, such as `site/`.
* Check whether generated files must be updated together with source files.

### Step 2: Implement

* Make the smallest complete change that solves the requested problem.
* Preserve current functionality unless a change is explicitly requested.
* Avoid unnecessary refactoring.
* Keep browser compatibility appropriate for a static GitHub Pages website.
* Do not add a framework or major dependency for a small feature.
* Follow existing naming, formatting, and architectural conventions.

### Step 3: Validate

Run the most relevant available checks, including where applicable:

* JavaScript syntax validation
* Existing npm scripts
* News-fetching or data-generation scripts
* Static-site generation or synchronization scripts
* Tests
* GitHub Actions workflow syntax checks
* Search for stale duplicated code
* Search for incorrect asset-version references
* Check generated data for malformed output
* Check `git diff --check`

Do not claim that tests passed unless they were actually run.

If no automated tests exist, perform focused static and logical validation and state that limitation.

### Step 4: Review

Before committing:

* Run `git status --short`.
* Review `git diff`.
* Review `git diff --stat`.
* Confirm no unrelated files are staged.
* Confirm no secrets or credentials are present.
* Confirm generated and deployed copies remain synchronized where required.
* Confirm the change does not accidentally expose gaming news, low-value filings, duplicated summaries, placeholder text, or incorrect language fields.

### Step 5: Commit

After successful validation:

* Stage only files relevant to the task.
* Create one focused local commit.
* Use a concise conventional commit message, for example:
  * `feat: ...`
  * `fix: ...`
  * `refactor: ...`
  * `docs: ...`
  * `chore: ...`
  * `test: ...`
* Do not amend an existing commit unless the user explicitly requests it.
* Do not push.

## 6. Repository-specific architecture rules

Inspect the current repository before applying these rules because filenames may evolve.

There is currently no `package.json`; this is a static JavaScript site driven by local Node scripts.

Important files include:

* `index.html`
* `app.js`
* `styles.css`
* `data.js`
* `real-data.js`
* `taxonomy.js`
* `site/index.html`
* `site/real-data.js`
* `site/taxonomy.js`
* `scripts/fetch_real_sources.mjs`
* `scripts/validate_generated_data.mjs`
* `scripts/update_asset_versions.mjs`
* `.github/workflows/update-news.yml`

Important commands include:

* `node scripts/fetch_real_sources.mjs`
* `node scripts/validate_generated_data.mjs`
* `node scripts/update_asset_versions.mjs`
* `cp real-data.js taxonomy.js site/`

When equivalent files exist in both the root and `site/` directory:

* Determine which copy is the source and which is the deployment output.
* Keep required copies synchronized.
* Do not update only one copy when deployment depends on both.
* Prefer an existing synchronization script over manual duplication.
* If no synchronization mechanism exists, document the relationship in code comments or project documentation only when useful.

## 7. News data quality rules

News quality is more important than maximizing article count.

Generated or curated news must avoid:

* Fabricated claims
* Unsupported conclusions
* Placeholder summaries
* "Pending source verification"
* Generic summaries that add no information
* Repeated summary templates
* Truncated sentences
* Incorrect Chinese/English language assignments
* Translation fields containing the wrong language
* Duplicate or near-duplicate stories
* Gaming news appearing in the industry feed
* Low-value routine filings without material relevance
* Old news presented as new
* Titles with repeated source prefixes
* Promotional or SEO-style filler

Summaries should:

* Preserve the central factual development.
* Use complete sentences.
* Explain why the news matters when the source supports that interpretation.
* Avoid speculation not supported by the source.
* Remain concise enough for management reading.
* Use Chinese or English consistently with the relevant field.
* Preserve key company names, products, figures, dates, and technical terms.

When changing filtering, ranking, classification, deduplication, or summarization logic, test representative examples rather than relying only on aggregate article counts.

## 8. Source and factual integrity

Do not invent source content when fetching fails.

When a source cannot be reached:

* Preserve valid existing data when appropriate.
* Fail visibly or log a clear warning.
* Do not replace missing content with fabricated summaries.
* Do not silently mark unverified information as verified.

SEC filings and company announcements should be filtered for management relevance rather than included automatically.

Prioritize developments involving:

* Strategic customers
* Competitors
* Supply-chain shifts
* Capacity expansion
* Capital expenditure
* Product launches
* AI infrastructure
* Data-center hardware
* Manufacturing technology
* Material regulatory or financial events

## 9. Static-site and cache rules

When changing JavaScript, CSS, generated data, or deployment files:

* Inspect how asset cache busting is currently implemented.
* Update asset versions through the existing versioning script when available.
* Avoid hard-coded inconsistent version strings.
* Confirm the deployed HTML references the latest assets.
* Do not assume a browser will immediately discard cached files.
* Preserve GitHub Pages compatibility.
* Do not introduce server-side runtime requirements unless explicitly requested.

## 10. GitHub Actions rules

When editing `.github/workflows/`:

* Preserve valid YAML syntax.
* Inspect triggers, permissions, branches, paths, schedules, and working directories.
* Remember that scheduled GitHub Actions use UTC unless the platform explicitly states otherwise.
* Avoid broad write permissions.
* Do not add secrets directly to workflow files.
* Use repository secrets or variables when credentials are required.
* Confirm generated files are actually committed or deployed by the workflow.
* Avoid workflow changes that create endless self-triggering commit loops.
* Retain manual dispatch support when useful for debugging.

## 11. Dependency rules

Before adding a dependency:

* Check whether the task can be solved with existing dependencies or platform APIs.
* Avoid large dependencies for trivial functionality.
* Confirm license and maintenance suitability when relevant.
* Update the correct lockfile.
* Do not generate multiple competing lockfiles.
* Do not run unrelated mass-upgrade commands.
* Do not update all dependencies unless specifically requested.
* Explain any new dependency in the final summary.

## 12. Coding style

Follow the existing repository style.

General preferences:

* Use clear and descriptive names.
* Keep functions focused.
* Avoid deeply nested logic when a clearer structure is available.
* Add comments for non-obvious business logic, not for self-evident syntax.
* Avoid duplicate implementations.
* Preserve backward compatibility where practical.
* Handle malformed or missing external data defensively.
* Prefer deterministic data generation.
* Make output ordering stable where possible.

Do not reformat entire files unless required.

## 13. User communication

During a task:

* Do not ask for approval for routine repository-local reading, editing, testing, or Git inspection when permissions already allow it.
* Do not repeatedly ask "shall I continue?"
* Continue until the requested result is implemented and validated.
* Ask a question only when a genuinely blocking ambiguity cannot be resolved safely from the repository or request.
* When possible, choose the safest reasonable interpretation and proceed.

Do not claim background work or promise to finish later.

## 14. Final response format

After completing a normal implementation task, provide:

1. A concise summary of what changed.
2. The validation or tests actually run and their results.
3. The local commit hash and commit message.
4. Git status information.
5. Whether the local branch is ahead of or behind its upstream branch, when available.
6. A clear statement that nothing was pushed.
7. Whether a normal push appears safe, without performing it.
8. Any limitations, remaining risks, or unverified behavior.

Use a structure similar to:

```text
已完成并提交，未 push。

主要改动：
- ...
- ...

验证：
- ...
- ...

Commit:
- hash: ...
- message: ...

Git 状态：
- 当前分支：...
- 本地领先远端：...
- 远端领先本地：...
- 工作区：...

可以普通 push / 暂不建议 push。
```

Never expose internal message IDs, credentials, tokens, or irrelevant environment details.

## 15. Updating these instructions

When the user corrects a recurring project assumption or workflow rule, consider updating this `AGENTS.md` as part of the same task so future Codex sessions inherit the correction.

Do not add temporary one-off task details to `AGENTS.md`.

Keep this file focused on stable, reusable project instructions.

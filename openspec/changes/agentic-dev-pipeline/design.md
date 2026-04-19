## Context

Today, implementing an OpenSpec change requires a developer to manually read the spec artifacts, write code, open a PR, and iterate on review feedback. This pipeline automates that loop using Claude Code as the implementation agent, with GitHub Actions as the orchestration layer.

The design uses `anthropics/claude-code-action@v1` — Anthropic's official GitHub Action — as the execution layer, avoiding the need to manage Claude CLI authentication, git operations, or PR creation manually. The ralph-loop plugin provides the iterative task execution pattern (implement → check → continue until done).

GitGloss uses the `spec-driven` OpenSpec schema: each change has `proposal.md`, `design.md`, `specs/**/*.md`, and `tasks.md`. The pipeline is designed around this structure and parameterized by `change-name`.

## Goals / Non-Goals

**Goals:**
- Implement the `spec-to-code` workflow: label an issue → agent implements tasks 1–N → PR opened
- Implement the `pr-review-loop` workflow: PR review submitted → agent addresses feedback or asks for clarification
- Workflows are parameterized (not hardcoded to `gitgloss-kernel`) and reusable across any OpenSpec-structured repo
- Agent prompt design is explicit and auditable — prompts live as files in `.github/agent-prompts/`, not inline YAML

**Non-Goals:**
- CI/CD (build, test, deploy to staging) — out of scope for Phase 1
- Spec generation from GitHub Issues — the pipeline starts from an existing spec
- Multi-repo orchestration
- Support for non-OpenSpec projects

## Decisions

### 1. Use `anthropics/claude-code-action@v1` as the execution layer

**Decision**: Use the official Anthropic GitHub Action rather than scripting `claude` CLI directly.

**Rationale**: The action handles authentication (`ANTHROPIC_API_KEY`), git operations (branch, commit, push), PR creation, and GitHub comment integration out of the box. Building this manually would require ~200 lines of workflow YAML and bash scripting. The action also supports the `plugins` input, enabling ralph-loop installation at runtime.

**Alternative considered**: Direct `claude --bare --dangerously-skip-permissions --print` invocation in a `run:` step. Rejected because it requires manual branch management, PR creation via `gh` CLI, and custom comment handling.

### 2. Use ralph-loop for task iteration

**Decision**: Install the ralph-loop plugin via the action's `plugins` input and invoke `/ralph-loop` in the implementation prompt.

**Rationale**: The spec-to-code workflow needs to implement N tasks (capped at 3–5 for Phase 1) where each task builds on the previous. Ralph Loop re-feeds the prompt between iterations, preserving file state and git history. The `--completion-promise` signal (agent outputs `TASKS_COMPLETE`) provides a clean termination condition without needing bash loop logic.

**Alternative considered**: A bash `for` loop over tasks with separate `claude --continue` invocations. Rejected because context between tasks would be lost and error handling would be complex.

**Cap rationale**: Tasks are capped at 3–5 per run to limit blast radius, cost, and PR size for Phase 1. This is configurable via workflow input.

### 3. Two separate workflows, not one

**Decision**: `spec-to-code.yml` and `pr-review-response.yml` are separate workflow files.

**Rationale**: They have different triggers (`issues` label vs. `pull_request_review`), different agents, different permission requirements, and different failure modes. Combining them into one file would add complex conditional branching. Separation also makes the reusable pattern clearer — consumers can adopt one without the other.

### 4. Prompts as files, not inline YAML

**Decision**: Agent prompts live in `.github/agent-prompts/implement.md` and `.github/agent-prompts/review-response.md`, referenced from workflow YAML.

**Rationale**: Prompts are the core design artifact of this system — they encode the agent's decision rules, context bundle structure, and constraints. Inline YAML strings are hard to read, diff, and iterate on. Files are versionable, reviewable, and can be templated with `envsubst` or shell substitution at runtime.

### 5. Review-response: fix vs. clarify decision rule

**Decision**: The review-response agent uses an explicit decision rule in its prompt:
- **Fix**: comment addresses code quality, style, correctness, or minor design within spec bounds
- **Clarify**: comment would require changing a spec-level contract, violating a design decision, or significantly altering scope

**Rationale**: Without an explicit rule, the agent either over-fixes (changes things it shouldn't) or under-fixes (asks unnecessary questions). The spec and design.md are passed as the authority documents — the agent reasons against them.

**Dialogue mechanism**: The action's interactive mode (`trigger_phrase: "@claude"`) handles open-ended conversation. The auto-respond mode (automation with `prompt`) handles structured review cycles. Both are configured in `pr-review-response.yml`.

### 6. PR labeling as state machine

**Decision**: PR labels drive workflow conditions:
- `agent:implementing` — set when spec-to-code run starts
- `agent:active` — set when PR is opened, gates pr-review-response triggers
- `agent:needs-clarity` — set when agent posts a clarifying question, pauses auto-response

**Rationale**: Labels are the cheapest GitHub state primitive. They're visible, filterable, and directly usable in workflow `if:` conditions without API calls.

## Risks / Trade-offs

- **Cost overrun** → Mitigation: `--max-budget-usd` cap on each action run; task count capped at 5 per run; `--max-turns` limit on the review-response agent
- **Agent makes unreviewed changes** → Mitigation: branch protection (PR required, human approval required before merge); agent never pushes directly to `main`
- **ralph-loop completion-promise not triggered** → Mitigation: `--max-iterations` hard cap; if loop exhausts iterations without signal, PR is still opened with partial implementation and a comment noting incomplete tasks
- **Review-response agent misclassifies a spec-conflict as a minor fix** → Mitigation: prompt includes verbatim spec text as authority; agent is instructed to err on the side of asking when uncertain; human can always override by commenting `@claude don't change this`
- **`claude-code-action` API changes** → Pinned to `@v1`; migration path documented in proposal

## Open Questions

- What is the exact `plugins:` value for ralph-loop in `claude-code-action`? The marketplace URL and plugin identifier need to be verified from ralph-loop install docs before writing the workflow.
- Should `--max-budget-usd` be a workflow input or hardcoded? For Phase 1, hardcoding `$5` per run is acceptable; make it an input in v2.
- Is `workflow_dispatch` sufficient as the initial trigger for Phase 1, or should the issue-label trigger (`issues: labeled`) be implemented from the start? Recommendation: start with `workflow_dispatch` for easier testing, add label trigger in the same PR.

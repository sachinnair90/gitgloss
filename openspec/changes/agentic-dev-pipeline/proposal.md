## Why

Software delivery still requires humans to manually translate specs into code, respond to review feedback, and shepherd PRs to merge — even when the intent is fully captured in structured specs. This change builds a reusable GitHub Actions pipeline that closes that loop: given an OpenSpec change, Claude autonomously implements it, opens a PR, and iterates on review feedback until the human approves.

GitGloss is the proving ground. The `gitgloss-kernel` change (a fully specced TypeScript library) is the first target.

## What Changes

- **New**: `.github/workflows/spec-to-code.yml` — triggered by an issue label, reads an OpenSpec change, implements tasks via Claude Code (with ralph-loop iteration), and opens a PR
- **New**: `.github/workflows/pr-review-response.yml` — triggered on PR review submission, auto-addresses code-level feedback and posts clarifying questions when review comments would conflict with the spec
- **New**: `.github/agent-prompts/implement.md` — context bundle template for the implementation agent (spec + tasks + design + constraints)
- **New**: `.github/agent-prompts/review-response.md` — decision-rule prompt for the review-response agent (fix vs. clarify logic)
- **New**: `docs/agentic-pipeline-guide.md` — usage guide for applying this pattern to other changes

## Capabilities

### New Capabilities

- `spec-to-code`: Autonomous implementation of an OpenSpec change into code via a GitHub Actions workflow, using `anthropics/claude-code-action@v1` and the ralph-loop plugin for iterative task execution
- `pr-review-loop`: Automated response to PR review comments — fixes addressable feedback, asks clarifying questions for spec conflicts, supports `@claude` mentions for open dialogue

### Modified Capabilities

_(none — this is a new pipeline layer, no existing specs change)_

## Impact

- **`.github/`**: Two new workflow files and two agent prompt templates added
- **`docs/`**: New usage guide
- **Dependencies**: `anthropics/claude-code-action@v1` (GitHub Action), `ralph-loop` Claude Code plugin, `ANTHROPIC_API_KEY` repository secret
- **No application code changes** — this pipeline is tooling-layer only; it operates on and produces application code but does not modify any existing source
- **Reusability**: The workflows are parameterized by `change-name` and `spec-root`, making them applicable to any repo using the OpenSpec format

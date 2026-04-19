## 1. Repository Setup

- [x] 1.1 Create `.github/agent-prompts/` directory
- [x] 1.2 Verify `ANTHROPIC_API_KEY` is documented as a required repository secret in `docs/agentic-pipeline-guide.md`
- [x] 1.3 Confirm ralph-loop plugin marketplace URL and identifier from ralph-loop install docs; record in `design.md` Open Questions section

## 2. Implementation Prompt Template

- [x] 2.1 Create `.github/agent-prompts/implement.md`: write the context bundle template that assembles proposal, design, specs, and task range for the spec-to-code agent
- [x] 2.2 Add explicit completion instruction to `implement.md`: agent must output `TASKS_COMPLETE` when all target tasks are checked off
- [x] 2.3 Add constraints section to `implement.md`: agent must only modify files within the target package directory; must not alter workflow files, `package.json` scripts, or OpenSpec artifacts

## 3. Review-Response Prompt Template

- [x] 3.1 Create `.github/agent-prompts/review-response.md`: write the fix-or-clarify decision rule prompt, including verbatim instruction to load spec and design.md as authority documents
- [x] 3.2 Add batch-processing instruction to `review-response.md`: agent must collect all unresolved comments before acting, not respond comment-by-comment
- [x] 3.3 Add uncertainty default to `review-response.md`: when classification is unclear, default to posting a clarifying question and applying `agent:needs-clarity` label

## 4. spec-to-code Workflow

- [x] 4.1 Create `.github/workflows/spec-to-code.yml` with `workflow_dispatch` trigger; inputs: `change-name` (required), `task-range` (optional, default `1-5`)
- [x] 4.2 Add `anthropics/claude-code-action@v1` step with `plugins: ralph-loop` (use verified identifier from task 1.3), `prompt` referencing `implement.md` template, `claude_args: --max-turns 30 --max-budget-usd 5`
- [x] 4.3 Wire `change-name` and `task-range` workflow inputs into the prompt via GitHub Actions expression syntax (`${{ inputs.change-name }}`)
- [x] 4.4 Add `label_trigger` or post-run step to apply `agent:implementing` label on trigger and `agent:active` label after PR is opened

## 5. pr-review-response Workflow

- [x] 5.1 Create `.github/workflows/pr-review-response.yml` with dual triggers: `pull_request_review: [submitted]` (automation mode) and `issue_comment: [created]` (interactive mode for `@claude` mentions)
- [x] 5.2 Add condition: `if: contains(github.event.pull_request.labels.*.name, 'agent:active')` to gate automation mode on the correct PRs
- [x] 5.3 Add `anthropics/claude-code-action@v1` step in automation mode: `prompt` referencing `review-response.md`, `claude_args: --max-turns 20 --max-budget-usd 3`
- [x] 5.4 Add `anthropics/claude-code-action@v1` step in interactive mode: no `prompt` (interactive), `trigger_phrase: "@claude"`
- [x] 5.5 Add iteration counter logic: read cycle count from PR label or comment count; apply `agent:review-limit-reached` and skip auto-respond after 10 cycles

## 6. Validation on gitgloss-kernel

- [ ] 6.1 Trigger `spec-to-code.yml` with `change-name: gitgloss-kernel`, `task-range: 1-3`; verify PR is opened with tasks 1.1–1.3 implemented and checked off
- [ ] 6.2 Leave a minor review comment on the generated PR (e.g., rename a variable); verify the agent addresses it in one cycle
- [ ] 6.3 Leave a review comment that conflicts with a spec requirement; verify the agent posts a clarifying question and applies `agent:needs-clarity`
- [ ] 6.4 Respond to the clarification confirming no spec change; @claude the agent to resume; verify it continues without making the conflicting change

## 7. Documentation

- [x] 7.1 Create `docs/agentic-pipeline-guide.md`: cover prerequisites (secrets, labels), how to trigger the pipeline for a new change, how to interpret agent PR comments, and how to extend the pattern to other repos

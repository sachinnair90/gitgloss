# Agentic Development Pipeline Guide

This guide covers how to use the GitHub Actions–based agentic development pipeline in GitGloss. The pipeline takes a fully specced OpenSpec change and autonomously implements it, opens a PR, and iterates on review feedback — with Claude Code as the implementation agent.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [How to Trigger the Pipeline for a New Change](#2-how-to-trigger-the-pipeline-for-a-new-change)
3. [How to Interpret Agent PR Comments and Labels](#3-how-to-interpret-agent-pr-comments-and-labels)
4. [How to Extend the Pattern to Other Repos](#4-how-to-extend-the-pattern-to-other-repos)
5. [Troubleshooting](#5-troubleshooting)

---

## 1. Prerequisites

### Required Repository Secret

| Secret | Description |
|---|---|
| `ANTHROPIC_API_KEY` | API key for the Anthropic Claude API. The workflows will fail at startup if this secret is missing. Obtain a key from [console.anthropic.com](https://console.anthropic.com) and add it under **Settings → Secrets and variables → Actions → New repository secret**. |

### Required Labels

The PR label state machine depends on four labels that must exist in the repository before the workflows run. Create them under **Issues → Labels → New label**:

| Label | Purpose |
|---|---|
| `agent:implementing` | Applied to the issue/branch when the `spec-to-code` run starts |
| `agent:active` | Applied to the PR once it is opened; gates the `pr-review-response` trigger |
| `agent:needs-clarity` | Applied when the agent posts a clarifying question; pauses auto-response |
| `agent:review-limit-reached` | Applied when the review-response agent has exhausted its iteration limit (10 cycles) |

If any of these labels are missing, the workflows will attempt to apply them and fail, leaving the PR in an ambiguous state.

### Permissions

The `GITHUB_TOKEN` used by the workflows requires:

- `contents: write` — to push the agent branch and commits
- `pull-requests: write` — to open PRs and post comments
- `issues: write` — to manage labels

These are typically available by default in public repos. For private repos or organisations with restricted default permissions, set them explicitly in the workflow YAML or in **Settings → Actions → General → Workflow permissions**.

---

## 2. How to Trigger the Pipeline for a New Change

The `spec-to-code` workflow is triggered manually via `workflow_dispatch`. The target change must already have a complete OpenSpec directory under `openspec/changes/{change-name}/` containing `proposal.md`, `design.md`, at least one `specs/**/*.md` file, and `tasks.md` with unchecked tasks.

### Step-by-step

1. Navigate to the **Actions** tab in the repository.
2. In the left sidebar, click **spec-to-code**.
3. Click **Run workflow** (top right of the workflow runs list).
4. Fill in the inputs:
   - **`change-name`** (required): The name of the OpenSpec change directory, e.g. `gitgloss-kernel`. Must match exactly the directory name under `openspec/changes/`.
   - **`task-range`** (optional): A range like `1-5` or `3-7` specifying which tasks from `tasks.md` to implement in this run. If omitted, the agent targets the first 5 unchecked tasks.
5. Click **Run workflow**.

### What happens next

- The workflow checks out the repo, assembles a context bundle from the change's spec artifacts, and invokes `anthropics/claude-code-action@v1` with the `ralph-loop` plugin.
- The agent implements tasks one at a time, checking off each task in `tasks.md` as it goes.
- When the agent outputs `TASKS_COMPLETE` (or exhausts `--max-iterations`), a PR is opened from branch `agent/{change-name}/{run-id}` targeting `main`.
- The PR is labelled `agent:active` and includes an AI-authored implementation summary and a checklist of completed tasks.
- If the run exhausted max iterations before finishing, the PR body will note which tasks remain incomplete.

### Cost guardrail

Each `spec-to-code` run is capped at **$5 USD** (`--max-budget-usd 5`). If the budget is exhausted mid-run, the agent stops and the workflow fails with a budget-exceeded error in the Actions log. Any work committed up to that point is preserved on the branch.

---

## 3. How to Interpret Agent PR Comments and Labels

### Label state machine

```
spec-to-code triggered
        |
        v
[agent:implementing]  ← applied when the run starts
        |
        v
[agent:active]        ← applied when the PR is opened; pr-review-response now watches this PR
        |
     (on review)
        |
        +--[addressable feedback]----------> agent pushes fix commit, replies "Addressed in {sha}"
        |
        +--[spec conflict or uncertainty]--> agent posts clarifying question
                                             [agent:needs-clarity] applied
                                             auto-response paused until resolved
        |
     (after 10 review cycles)
        |
        v
[agent:review-limit-reached]  ← agent posts a comment and stops auto-responding
```

### What "Addressed in {sha}" means

When the agent fixes a review comment, it pushes a commit and replies to the comment with:

```
Addressed in abc1234
```

This means the change was made in that specific commit. You can click the SHA to inspect the diff. No further action is needed on that comment — mark it resolved.

### What `agent:needs-clarity` means and how to respond

The agent applies `agent:needs-clarity` when a review comment would require:

- Violating a requirement in one of the `specs/**/*.md` files
- Reversing a decision recorded in `design.md`
- Significantly changing scope beyond what the proposal describes

When this label is present, the agent posts a PR comment quoting the conflicting spec or design excerpt and asking the reviewer to confirm how to proceed. Auto-response is paused.

**To resume:**

1. Read the agent's clarifying question and the quoted spec excerpt.
2. Either update the spec/design in a separate commit (if the feedback is correct and the spec needs changing), or reply confirming the spec should not change.
3. Mention `@claude` in your reply to signal the agent to resume, e.g.:
   > The spec is correct, do not make this change. @claude please continue with the remaining comments.
4. The agent will remove `agent:needs-clarity`, re-process any open comments, and push fixes.

### How `@claude` mentions work

You can mention `@claude` anywhere in a PR comment to start an open-ended conversation with the agent. This is distinct from the structured fix-or-clarify automation:

- Use `@claude` to ask why a particular implementation decision was made.
- Use `@claude` to ask the agent to explain a section of code.
- Use `@claude` to request a change conversationally rather than as a formal review comment.
- Use `@claude` to resume after a `agent:needs-clarity` pause (as described above).

The agent will respond in-thread, referencing the spec and design rationale where relevant.

---

## 4. How to Extend the Pattern to Other Repos

The pipeline is parameterized by `change-name` and designed around the `spec-driven` OpenSpec schema. It can be adopted in any repo that uses the same directory structure.

### Files to copy

Copy these files from `.github/` into the target repo:

| File | Purpose |
|---|---|
| `.github/workflows/spec-to-code.yml` | Workflow: manual trigger → agent implements → PR opened |
| `.github/workflows/pr-review-response.yml` | Workflow: PR review submitted → agent addresses or clarifies |
| `.github/agent-prompts/implement.md` | Context bundle template for the implementation agent |
| `.github/agent-prompts/review-response.md` | Decision-rule prompt for the review-response agent |

### OpenSpec directory structure required

The pipeline expects each change to live at `openspec/changes/{change-name}/` with this layout:

```
openspec/changes/{change-name}/
  proposal.md       ← what and why
  design.md         ← decisions and trade-offs (used as authority by review agent)
  specs/
    **/*.md         ← requirement specs (used as authority by review agent)
  tasks.md          ← checklist of implementation tasks
```

If your repo uses a different root path (e.g. `specs/changes/` instead of `openspec/changes/`), update the `spec-root` input or the path references in `implement.md`.

### What to customise

- **`spec-root`**: Update the path prefix in the workflow if your changes directory is not under `openspec/changes/`.
- **`agent-prompts/implement.md`**: Adjust the context bundle structure if your schema uses different file names (e.g. `requirements.md` instead of `proposal.md`).
- **`agent-prompts/review-response.md`**: Update authority document references if your design decisions live in a different file.
- **`--max-budget-usd`**: Currently hardcoded at `$5` for spec-to-code and `$3` for pr-review-response. Make these workflow inputs if your team wants per-trigger control.
- **`--max-iterations`**: Currently 5 for spec-to-code, 10 cycles for pr-review-response. Adjust based on the complexity of your typical changes.
- **Branch naming**: Currently `agent/{change-name}/{run-id}`. Update the branch creation step if your repo uses a different convention.

### Required setup in the target repo

1. Add `ANTHROPIC_API_KEY` as a repository secret.
2. Create the four required labels: `agent:implementing`, `agent:active`, `agent:needs-clarity`, `agent:review-limit-reached`.
3. Ensure the `GITHUB_TOKEN` has `contents: write`, `pull-requests: write`, and `issues: write` permissions.
4. Create at least one OpenSpec change directory with the required files before triggering the workflow.

---

## 5. Troubleshooting

### Budget exceeded mid-run

**Symptom**: The `spec-to-code` workflow fails with a budget-exceeded error. The branch exists but the PR was not opened, or was opened with partial implementation.

**Resolution**:
- Check the Actions log for how many tasks were completed before the budget was hit.
- Re-trigger `spec-to-code` with a narrower `task-range` starting from the first uncompleted task (e.g. `task-range: 3-5` if tasks 1–2 were completed).
- If the change consistently exceeds budget, break it into smaller task batches.

### Loop timeout / max iterations reached without TASKS_COMPLETE

**Symptom**: The PR is opened but the body notes that some tasks were not completed. The agent did not output `TASKS_COMPLETE`.

**Resolution**:
- Check the last committed state of the branch — tasks may be partially done.
- Re-trigger `spec-to-code` with a `task-range` starting from the first unchecked task in `tasks.md`.
- If a single task is too large for one agent turn, split it in `tasks.md` before re-triggering.

### Misclassified comment: agent fixed something it should have asked about

**Symptom**: The agent pushed a commit that changes behaviour you did not intend — a spec-level decision was altered without a clarifying question.

**Resolution**:
- Revert the specific commit on the branch (or push a corrective commit).
- Add a comment on the PR explaining the intended behaviour.
- Update `design.md` or the relevant spec file to make the constraint more explicit, so the agent has clearer authority text on the next cycle.
- Mention `@claude` with a corrective instruction if you want the agent to self-correct in the same PR.

### Misclassified comment: agent asked about something it should have just fixed

**Symptom**: The agent posted a clarifying question and applied `agent:needs-clarity` for a minor style change that clearly does not conflict with any spec.

**Resolution**:
- Reply confirming the change is safe and mention `@claude` to resume.
- To reduce future false-positives, tighten the decision boundary in `agent-prompts/review-response.md` by adding examples of safe changes to the "Fix" category.

### `agent:review-limit-reached` applied — auto-response stopped

**Symptom**: The PR has the `agent:review-limit-reached` label and the agent has stopped responding to new reviews.

**Resolution**:
- This is expected after 10 review cycles on a single PR. Resolve remaining comments manually or with direct commits.
- If the PR still has significant open feedback, consider closing it, addressing the outstanding items in a fresh branch, and re-opening.

### Workflow does not trigger on PR review

**Symptom**: You submitted a review on an agent PR but `pr-review-response` did not fire.

**Causes and fixes**:
- The PR does not have the `agent:active` label — add it manually.
- The `GITHUB_TOKEN` lacks `pull-requests: read` permission — check workflow permissions in repository settings.
- The workflow file itself has a syntax error — check the Actions tab for a workflow parse error.

### Missing labels cause workflow to fail

**Symptom**: The workflow fails with an error like `Label 'agent:active' not found`.

**Resolution**: Create the missing labels in **Issues → Labels**. See the [Required Labels](#required-labels) section for the full list.

## ADDED Requirements

### Requirement: Workflow trigger via workflow_dispatch
The `spec-to-code` workflow SHALL be triggerable via `workflow_dispatch` with a required `change-name` input identifying the OpenSpec change to implement. An optional `task-range` input SHALL allow specifying which tasks to implement (e.g., `1-5`), defaulting to the first 5 unchecked tasks.

#### Scenario: Manual trigger with change name
- **WHEN** a user triggers `spec-to-code.yml` via `workflow_dispatch` with `change-name: gitgloss-kernel`
- **THEN** the workflow starts and the agent reads `openspec/changes/gitgloss-kernel/tasks.md`

#### Scenario: Task range defaults to first 5 unchecked tasks
- **WHEN** `task-range` input is not provided
- **THEN** the agent SHALL target the first 5 unchecked tasks in `tasks.md`

### Requirement: Agent context bundle
The implementation agent SHALL receive a structured context bundle containing: the change `proposal.md`, `design.md`, all `specs/**/*.md` files under the change directory, and the `tasks.md` with the target task range clearly indicated. The bundle SHALL be assembled from a prompt template file at `.github/agent-prompts/implement.md`.

#### Scenario: Context bundle assembled before agent run
- **WHEN** the workflow runs
- **THEN** the agent prompt MUST include verbatim content from proposal.md, design.md, and all spec files for the given change
- **THEN** the agent prompt MUST clearly indicate which task numbers are in scope for this run

### Requirement: Iterative task execution via ralph-loop
The agent SHALL use the ralph-loop plugin to implement tasks one at a time, checking off each task in `tasks.md` upon completion. The loop SHALL terminate when the agent outputs the completion signal `TASKS_COMPLETE` or when `--max-iterations` is reached (default: 5).

#### Scenario: Task checked off on completion
- **WHEN** the agent completes a task
- **THEN** the corresponding task line in `tasks.md` SHALL be updated from `- [ ]` to `- [x]`

#### Scenario: Loop terminates on completion signal
- **WHEN** the agent outputs `TASKS_COMPLETE`
- **THEN** the ralph-loop exits and the workflow proceeds to PR creation

#### Scenario: Loop terminates on max iterations
- **WHEN** the agent reaches `--max-iterations` without outputting `TASKS_COMPLETE`
- **THEN** the loop exits, any partially-completed work is committed, and the PR is opened with a comment noting which tasks remain incomplete

### Requirement: Automated PR creation
Upon completing the task loop, the workflow SHALL open a pull request with: a base branch of `main`, a head branch named `agent/{change-name}/{run-id}`, an AI-authored summary describing what was implemented, a checklist of completed tasks, and the label `agent:active`.

#### Scenario: PR opened after successful implementation
- **WHEN** the ralph-loop completes with `TASKS_COMPLETE`
- **THEN** a PR SHALL be opened targeting `main` with label `agent:active` and an implementation summary as the PR body

#### Scenario: PR opened after partial implementation
- **WHEN** the ralph-loop exhausts max iterations without all tasks complete
- **THEN** a PR SHALL still be opened with a note in the body listing which tasks were not completed

### Requirement: Cost guardrail
The workflow SHALL set `--max-budget-usd 5` on the agent run to prevent runaway API spend per execution.

#### Scenario: Budget exceeded
- **WHEN** the agent's API spend reaches $5 within a single run
- **THEN** the agent SHALL stop and the workflow SHALL fail with a budget-exceeded error visible in the Actions log

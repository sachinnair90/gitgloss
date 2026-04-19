## ADDED Requirements

### Requirement: Automatic trigger on PR review submission
The `pr-review-response` workflow SHALL trigger on `pull_request_review` events (type: `submitted`) but ONLY when the PR carries the label `agent:active`. Reviews submitted while the label `agent:needs-clarity` is present SHALL be processed normally (the label does not suppress the trigger).

#### Scenario: Review submitted on agent-managed PR
- **WHEN** a reviewer submits a review on a PR labeled `agent:active`
- **THEN** the workflow fires and the agent reads all unresolved review comments

#### Scenario: Review submitted on non-agent PR
- **WHEN** a reviewer submits a review on a PR without the `agent:active` label
- **THEN** the workflow SHALL NOT fire

### Requirement: Fix-or-clarify decision rule
The review-response agent SHALL evaluate each unresolved review comment against the change's spec and design.md, then apply one of two actions:

- **Fix**: The comment addresses code quality, style, correctness, naming, test coverage, or minor implementation details that do not conflict with any spec requirement or design decision. The agent SHALL make the change and push a commit.
- **Clarify**: The comment would require violating a spec requirement, reversing a design decision recorded in `design.md`, or significantly changing scope. The agent SHALL post a PR comment quoting the conflicting spec/design excerpt and asking the reviewer to confirm or adjust the spec before the change is made. The agent SHALL apply the label `agent:needs-clarity` to the PR.

When uncertain, the agent SHALL default to **Clarify**.

#### Scenario: Minor fix addressed automatically
- **WHEN** a reviewer comments "rename `buildIndex` to `buildSearchIndex` for clarity"
- **THEN** the agent SHALL rename the function, push a commit, and reply "Addressed in {commit-sha}"

#### Scenario: Spec conflict triggers clarification question
- **WHEN** a reviewer comments "remove the in-memory cache, just re-read files each time"
- **AND** the spec requires lazy-loaded in-memory caching for performance
- **THEN** the agent SHALL NOT make the change
- **THEN** the agent SHALL post a comment quoting the relevant spec requirement and asking the reviewer to confirm whether the spec should be updated
- **THEN** the agent SHALL apply label `agent:needs-clarity` to the PR

#### Scenario: Uncertainty defaults to clarify
- **WHEN** the agent cannot determine whether a comment conflicts with the spec
- **THEN** the agent SHALL post a clarifying question rather than making a potentially incorrect change

### Requirement: Batch comment processing
The agent SHALL process all unresolved review comments in a single run, not one-at-a-time. This ensures a single commit (or small set of commits) addresses all feedback, rather than one commit per comment.

#### Scenario: Multiple comments addressed in one pass
- **WHEN** a reviewer submits a review with 4 comments
- **THEN** the agent SHALL address all 4 in the same workflow run and push a single commit (or grouped commits) rather than 4 separate runs

### Requirement: Interactive dialogue via @claude mention
The workflow SHALL also support interactive mode: when a reviewer or PR author mentions `@claude` in a PR comment, the agent SHALL respond conversationally. This enables open-ended discussion about implementation decisions, spec interpretation, or design trade-offs without triggering the fix-or-clarify automation.

#### Scenario: Reviewer asks a question via @claude
- **WHEN** a reviewer comments "@claude why did you use Fuse.js here instead of a simple string match?"
- **THEN** the agent SHALL reply with an explanation referencing the spec or design rationale

#### Scenario: Clarification answer resumes implementation
- **WHEN** a reviewer responds to a clarification question confirming the spec should not change
- **AND** they @claude to resume
- **THEN** the agent SHALL acknowledge, remove `agent:needs-clarity`, and reprocess remaining open comments

### Requirement: Iteration guard
The workflow SHALL track the number of agent-response cycles on a given PR. After 10 cycles, the workflow SHALL stop auto-responding and post a comment suggesting the reviewer and author resolve the remaining comments manually, to prevent infinite loops.

#### Scenario: Max iterations reached
- **WHEN** the pr-review-response workflow has fired 10 times on a single PR
- **THEN** subsequent `pull_request_review` events SHALL NOT trigger the auto-respond agent
- **THEN** the agent SHALL post a comment notifying reviewers that the auto-response limit has been reached

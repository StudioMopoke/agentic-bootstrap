# Bootstrap Agentic Workflow

Set up an AI-assisted development workflow for this project. Generates five slash commands tailored to this codebase, plus a workflow configuration section for CLAUDE.md.

- `/feature` — Specify **what** to build: interactive feature specification, technical design, and scope planning
- `/discuss` — Plan **when** and **how** to execute: sprint planning, task scheduling, backlog management
- `/start` — Begin work on a task: fetch context, create branch, spawn zone agents
- `/resume` — Continue work after a session break: reconstruct context from durable state
- `/review` — Pre-PR self-review: evaluate changes against requirements and acceptance criteria

## Instructions

Execute the phases below in order. Use `AskUserQuestion` for multi-choice questions and conversation for open-ended ones.

---

## Prerequisites & Error Handling

Before starting the phases, check these prerequisites:

1. **Verify git is initialized:** Run `git rev-parse --git-dir`. If it fails, warn the user that this directory is not a git repository and offer to run `git init`.
2. **MCP tool availability:** If MCP tools are referenced but not available in the current environment, fall back gracefully to CLI tools or manual workflows. Never fail a phase just because an MCP tool is missing.
3. **Partial failure recovery:** If any phase fails, report what succeeded so far and what failed. The user can re-run `/bootstrap` to retry — the command should detect existing artifacts and pick up where it left off.

---

### Phase 1: Task Management Discovery

Ask the user about their task management system.

> **Note:** GitHub Issues is fully supported with utility scripts, project board integration, and auto mode. Other providers are supported for basic task fetching and status transitions but may require additional configuration for advanced features.

**Question 1:** Which task management system do you use?
- GitHub Issues (Recommended)
- Jira
- Linear
- Asana
- None / Other

Based on their answer, ask for connection details:

#### If GitHub Issues:
- Repository (can be auto-detected from git remote — run `git remote get-url origin` and parse the owner/repo)
- Verify `gh` CLI is available: run `gh --version`. If not available, warn that many features depend on it and suggest installing it.
- **GitHub Projects integration:**
  - Ask: "Do you use GitHub Projects for board management (columns like Backlog, Ready, In Progress, Done)?"
  - If yes:
    - Capture **project number** (the number in the project URL, e.g., `4` from `github.com/orgs/MyOrg/projects/4`)
    - Capture **project owner** (organization or user that owns the project)
    - **Discover project IDs** by running `gh` CLI commands:
      1. Get `PROJECT_ID`: `gh project view {PROJECT_NUM} --owner {PROJECT_OWNER} --format json` — extract the `id` field
      2. Get `STATUS_FIELD_ID` and `STATUS_OPTIONS`: `gh project field-list {PROJECT_NUM} --owner {PROJECT_OWNER} --format json` — find the "Status" field, extract its `id` as `STATUS_FIELD_ID`, and build `STATUS_OPTIONS` as a map of `{status_name: option_id}` from the field's options
    - If discovery fails (permissions, project not found, etc.), fall back gracefully — skip project board features and note that `scripts/project.py` and the `ready` mode of `scripts/next-issue.py` will not be generated. The rest of the workflow still works.
  - Store: `REPO`, `PROJECT_NUM`, `PROJECT_OWNER`, `PROJECT_ID`, `STATUS_FIELD_ID`, `STATUS_OPTIONS`

#### If Jira:
- Instance URL (e.g., `mycompany.atlassian.net`)
- Cloud ID (needed for MCP tools — they can find it at `https://{instance}/wiki/rest/api/settings/systemId` or via the Atlassian MCP `getAccessibleAtlassianResources` tool)
- Project key pattern (e.g., `PROJ`, `ENG` — the prefix before the dash in task IDs like `PROJ-1234`)
- What MCP tools are available? Check if `mcp__atlassian__` tools exist in the current environment. If not, note that task management features will use CLI tools or be manual.

#### If Linear:
- Team identifier
- Whether Linear MCP tools are available

#### If Asana:
- Workspace GID (found in Asana URL or via API)
- Project GID (the project that contains the tasks)
- Whether Asana MCP tools are available in the current environment. If not, check for the `asana` CLI. Note that task management features will use whichever is available, or be manual.

#### If None / Other:
- Ask if they want a simplified workflow without task management integration
- Or if they have a custom system they can describe

Store the answers as variables for template generation.

---

### Phase 2: Git Conventions Discovery

Ask about their git workflow:

**Question 2:** Branch naming convention?
- Suggest a default based on task management: `feature/{TASK_ID}-short-name` (for GitHub Issues, use the issue number without `#`, e.g., `feature/42-short-name` — the `#` character interferes with shell and command parsing in branch names)
- Ask if they use different prefixes (e.g., `feature/`, `bugfix/`, `hotfix/`)
- Ask what their default base branch is. Detect it automatically using this fallback chain:
  1. `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null` (local, fast — works if remote HEAD is set)
  2. `git remote show origin | grep 'HEAD branch'` (requires network access — fallback)
  3. If both fail, ask the user directly

**Question 3:** Commit message format?
- Suggest: `{TASK_ID} Description of change`
- Ask if they want any prefix/suffix conventions (e.g., emoji, conventional commits)
- Ask if they want the AI marker (e.g., robot emoji or `[AI]` tag)

---

### Phase 3: Codebase Analysis

Explore the codebase to understand its structure. Run these in parallel:

1. **Detect project type:** Check for `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `*.csproj`, `*.sln`, `Gemfile`, etc.
2. **Identify key directories:** Run `ls -la` at root, look for common patterns (`src/`, `pkg/`, `internal/`, `lib/`, `app/`, `routes/`, `tests/`, `scripts/`)
3. **Detect build and test commands:** Based on the detected project type, determine the appropriate build and test commands. Check for `Makefile` targets and custom scripts first (these take priority). Then fall back to stack defaults:

   | Type | Build | Test |
   |------|-------|------|
   | Node/TS | `npm run build` (check `package.json` scripts) | `npm test` |
   | Go | `go build ./...` | `go test ./...` |
   | Python | Check for build script | `pytest` |
   | Rust | `cargo build` | `cargo test` |
   | .NET | `dotnet build` | `dotnet test` |
   | Ruby | Check Rakefile | `bundle exec rspec` |
   | C++ w/ CMake | `cmake --build build` | `ctest --test-dir build` |

   Store the results as `BUILD_COMMAND` and `TEST_COMMAND` for use in CLAUDE.md configuration and auto mode verification. If no build step applies (e.g., pure Python), set `BUILD_COMMAND` to empty/none. If no test framework is detected, set `TEST_COMMAND` to empty/none and note this to the user.

4. **Check for related repos:** Ask the user if this project works alongside other repos they'd want agents to explore
5. **Discover dependencies and external domains:** Ask the user about:
   - Key external services or APIs the project talks to (e.g., REST APIs, GraphQL endpoints, third-party SDKs)
   - Internal packages or libraries it depends on that live outside this repo
   - External domains agents should be aware of when investigating issues (e.g., "auth is handled by our identity service in repo X", "we consume events from the payments service")
   - Any documentation URLs, API specs (OpenAPI/Swagger), or reference repos that would help agents understand integrations
6. **Check for existing CLAUDE.md:** Read it if present — we'll append to it rather than overwrite
7. **Check for existing .claude/commands/:** Warn if start.md, resume.md, review.md, discuss.md, or feature.md already exist

Present findings to the user:
- "I found a [Go/Node/Python/etc.] project with these key directories: ..."
- "Here's the structure I see: ..."
- "External dependencies/services: ..." (summarize what they told you)

---

### Phase 4: Agent Zone Definition

This is the most important step. Define the exploration agents that `/feature`, `/start`, `/resume`, and `/review` will spawn.

Ask the user to describe the major areas of their codebase. Help them by suggesting based on Phase 3 findings.

For each zone, capture:
- **Name**: Short label (e.g., "API Surface", "Core Logic", "Tests")
- **Paths**: Which directories to explore
- **Description**: What this zone covers (1-2 sentences)
- **Triggers**: Task types that should activate this agent (e.g., "API changes", "bug investigation")
- **Dependencies/context** (optional): External services, APIs, or sibling repos this zone interacts with. Drawn from Phase 3 discovery — include relevant details so agents understand the integration boundaries (e.g., "calls the payments API via `pkg/payments/client.go`", "depends on shared-types from `../common-lib`")

Aim for 3-6 zones. For very small projects (single-directory), 1-2 zones is fine (e.g., "Source" + "Tests"). For large monorepos, group related packages into composite zones rather than creating 10+ individual ones.

Good defaults based on common patterns:

| Project Type | Suggested Zones |
|-------------|----------------|
| Go service | Core logic, API/routes, infrastructure/config, tests |
| Node/React app | Components, API/services, state management, tests |
| Python service | Core modules, API endpoints, config/infra, tests |
| Monorepo | Per-package zones + shared/common zone |

If they have **related repos**, define zones for those too with absolute paths.

---

### Phase 5: Planning Structure

Ask about the project's planning and documentation approach.

**Question 1:** What level of planning docs do you want?

- **Full project planning** (recommended for greenfield/new projects) — Architecture docs, sprint planning, task breakdowns with TDD specs, backlog management
- **Task-level only** — Simple per-task planning docs created by `/start` (good for established codebases with external task management)
- **None** — No local planning docs, rely entirely on task management system

#### If Full Project Planning:

Scaffold the planning directory structure:

`{NN}` is a two-digit ordering prefix (e.g., `01_features.md`, `02_architecture.md`). Number by logical reading order, not priority. Gaps are fine — leave room for future docs.

```
planning/
├── {NN}_{topic}.md              # Project-level docs (features, architecture, tech stack, etc.)
├── backlog/
│   ├── README.md                # When to park/pull items
│   └── {deferred-feature}.md
├── features/
│   └── {feature-name}/
│       ├── spec.md              # Feature specification (created by /feature)
│       ├── technical-design.md  # Technical design document
│       └── scope.md             # Scope, phases, task breakdown
└── sprints/
    └── sprint-{N}-{name}/
        ├── 00_sprint_overview.md # Sprint goal, task table, success criteria, out of scope
        ├── {NN}_{task}.md        # Detailed task spec (requirements, AC, files to create, API endpoints)
        ├── COMPLETED.md          # Progress tracking
        └── tdd/
            ├── README.md         # TDD overview for the sprint
            └── phase-{NN}-{name}.md  # Full test specifications per task
```

Ask the user:
- What project-level docs should we create stubs for? Suggest based on codebase analysis:
  - Features overview / scope
  - Architecture principles
  - Tech stack decisions
  - App structure
  - MVP / milestone scope
  - Any domain-specific reference docs
- Is TDD part of their workflow? (determines whether to include `tdd/` directories)
- What's their sprint naming convention? (numbered, named, dated)

Create the backlog README with guidelines on when to park and pull items.

#### If Task-Level Only:

Ask for the planning doc path. Default: `planning/tasks/{TASK_ID}.md`

The `/start` command will create a per-task doc with:
- Task context from the task management system
- Acceptance criteria
- Approach section (to fill during implementation)
- Notes section (for investigation during development)

---

### Phase 6: Generate Commands

Now generate the files. Create each one using the Write tool.

#### 6a. Generate `start.md`

Write to `.claude/commands/start.md`. The generated command should handle:

1. **Parse argument** — Extract task identifier from `$ARGUMENTS`. Support the following inputs:
   - **`auto [task]`** — Detect the `auto` keyword anywhere in the arguments. Strip it and set `AUTO_MODE=true`. The remaining argument is processed normally (task ID, URL, `next`, `rnext`, or empty). If empty in auto mode, treat as `next`.
   - **`next`** — Auto-select the next task to work on. For GitHub Issues with utility scripts, run `python scripts/next-issue.py open`. For other providers, query for open/unassigned tasks, check `git branch -a` to filter out tasks that already have branches, and pick the lowest/highest-priority remaining task. Show the user which task was selected and ask for confirmation before proceeding (skip confirmation in auto mode).
   - **`rnext`** or **`next ready`** — (GitHub Issues with Projects only) Select the next task from the project board's "Ready" column. Run `python scripts/next-issue.py ready`. If Projects is not configured, fall back to `next` behavior. Show the user which task was selected and ask for confirmation (skip in auto mode).
   - **Task ID** — A task identifier matching the configured pattern (e.g., `#42`, `PROJ-123`, `ENG-456`).
   - **URL** — A full URL to the task in the provider's UI.
   - **Empty or unrecognizable** — Ask the user for the task identifier. Never guess or make one up. **Include this guard in the generated `start.md`**.
2. **Fetch task context** — Using the configured provider, get summary, description, status, AC, priority, parent/epic, linked tasks.
3. **Guard against duplicate work** — Check `git branch -a` for existing branches. Check for existing planning docs. If work exists: in normal mode, suggest `/resume`. In auto mode, continue working (skip the `/resume` suggestion).
4. **Create feature branch** — Derive short name from task summary, check for parent/epic branch, create with configured prefix and base branch.
5. **Load planning context** — Based on planning mode:
   - **Full planning:** Read the active sprint overview and find the relevant task spec if one exists. If a task spec exists in a sprint, surface its requirements, AC, files to create, and TDD specs. If no task spec exists, note that the user may want to run `/discuss` first or create one ad-hoc. In auto mode, if no task spec exists, create a lightweight per-task doc from the issue context.
   - **Task-level:** Create a per-task planning doc with context from the task management system.
   - **None:** Skip.
6. **Spawn exploration agents** — Based on the task description and planning context, pick relevant agent zones. Run in parallel with `run_in_background: true`.
7. **Transition task status** — Mark as in-progress via configured provider. For GitHub Issues with utility scripts, run `python scripts/issue.py assign {NUMBER}`. If GitHub Projects is configured, run `python scripts/project.py move {NUMBER} in-progress`.
8. **Report setup summary** — Task info, branch, planning docs found/created, running agents, suggested approach. In normal mode, wait for the user before beginning implementation. In auto mode, immediately begin implementation without waiting.

**Steps 9-14 (auto mode only):** These steps execute only when `AUTO_MODE=true`, after the implementation is complete.

9. **Verify** — Run automated checks to confirm the implementation is correct:
   - **9a: Build check** — Run `BUILD_COMMAND` (from CLAUDE.md Workflow Configuration). If there is no build command, skip.
   - **9b: Test check** — Run `TEST_COMMAND` (from CLAUDE.md Workflow Configuration). If there is no test command, skip.
   - **9c: Requirements check** — Map each acceptance criterion from the task to the diff. Check that each AC is addressed by the changes.
   - **9d: Verdict** — If all checks pass, continue to step 10. If any check fails, attempt to fix the issue and re-verify (retry up to 3 times). If still failing after 3 retries, stop auto mode, report the failures, and hand control back to the user.

10. **Auto-commit** — Stage the specific files that were changed (do not use `git add -A`). Commit with the configured commit format from CLAUDE.md Workflow Configuration.

11. **Auto-push** — Push the branch to the remote: `git push -u origin {branch_name}`.

12. **Auto-create PR** — Create a pull request using `gh pr create`. Include in the PR body:
    - Summary of what was implemented
    - Acceptance criteria as a checklist (with checkmarks for verified items)
    - Link back to the issue (e.g., "Closes #{NUMBER}")

13. **Auto-merge** — Merge the PR using `gh pr merge --squash --delete-branch`. If the merge fails (e.g., branch protection, required reviews), report the failure and leave the PR open for manual handling. If GitHub Projects is configured, update the project board: `python scripts/project.py move {NUMBER} done`.

14. **Completion report** — Display a summary of the autonomous run:
    - Task: `#{NUMBER} — {title}`
    - Branch: `{branch_name}`
    - Files changed: list with brief descriptions
    - Verification results: build, test, requirements check status
    - PR link: `{PR_URL}`
    - Suggest: `/start auto next` to continue with the next task

Include the relationship note: `/start` initializes, `/resume` continues. Cross-redirect between them.

#### 6b. Generate `resume.md`

Write to `.claude/commands/resume.md`. The generated command should handle:

1. **Detect current work from git** — Branch name, extract task ID, recent commits, uncommitted changes.
2. **Fetch task context** — Same provider integration as start.
3. **Check progress** — TaskList for Claude Code tasks, plus planning context:
   - **Full planning:** Read sprint overview, find task spec, check which subtasks/phases are done. Read COMPLETED.md if it exists. Surface what's next based on the task spec.
   - **Task-level:** Read the per-task planning doc, check notes/approach sections.
   - **None:** Skip.
4. **Spawn exploration agents** — Same zones as start, picked by relevance.
5. **Report status** — Task summary, git state, planning progress, running agents, what to work on next.
6. **Continue** — Resume work, with agent follow-up instructions.

Include workflow reminders: commit format, task management updates, agent follow-up pattern.

#### 6c. Generate `discuss.md`

Write to `.claude/commands/discuss.md`. This command handles **execution planning** — sprint structure, task scheduling, backlog management. It does NOT handle feature specification (that's `/feature`).

Include this description at the top of the generated command:
> Plan **when** and **how** to execute work: sprint planning, task scheduling, and backlog management. For specifying **what** to build, use `/feature` instead.

The generated command should handle:

1. **Parse argument** — Accepts a sprint name/number, task ID, or topic from `$ARGUMENTS`. If empty, ask what they want to plan.
2. **Gather context** — Read existing planning docs, feature specs in `planning/features/`, check git history, fetch task management context as relevant.
3. **Adapt to planning mode:**
   - **Full planning:** Plan sprints from feature specs and roadmap — break work into numbered tasks with requirements, AC, file lists, dependencies, and TDD specs. Create sprint directories. Manage the backlog (park, prioritize, pull items).
   - **Task-level:** Discuss a specific task's implementation approach, update the per-task planning doc with decisions and notes.
   - **None:** Freeform discussion about execution, scheduling, or priorities. Optionally capture notes.
4. **Leverage feature specs** — When planning a sprint, check `planning/features/` for feature specs that provide task breakdowns, dependencies, and scope. Use these as input rather than re-deriving requirements.
5. **Explore as needed** — Spawn agents to answer codebase questions that arise during planning.
6. **Produce artifacts** — Write sprint overviews, task specs, TDD specs, or backlog items. Always ask before creating files.
7. **Offer next steps** — Suggest `/start` to begin the first task, or `/feature` if requirements need to be specified first.

#### 6d. Generate `review.md`

Write to `.claude/commands/review.md`. The generated command should handle:

1. **Detect current work from git** — Branch name, extract task ID, base branch. Identify the full set of changes: `git diff {base_branch}...HEAD` for committed changes, plus any uncommitted/staged changes.
2. **Gather requirements** — Collect everything we know about what this task should accomplish:
   - Fetch task details from the configured provider (summary, description, AC, linked tasks).
   - **Full planning:** Read the task spec from the sprint directory (requirements, AC, files to create, TDD specs). Read the sprint overview for broader context.
   - **Task-level:** Read the per-task planning doc (approach, notes, AC).
   - **None:** Use the task management description alone, or ask the user to describe expected behavior.
3. **Collect all changes** — Build a complete picture of the work:
   - List all commits on the branch (`git log {base_branch}..HEAD --oneline`).
   - Get the full diff (`git diff {base_branch}...HEAD`).
   - List files changed with stats (`git diff {base_branch}...HEAD --stat`).
   - Note any uncommitted changes separately.
4. **Spawn deep review agents** — For each major area of change, spawn an exploration agent to understand the surrounding code context. This lets the review consider not just the diff, but how changes interact with the broader codebase.
5. **Conduct the review** — Evaluate the changes against the requirements. Check for:
   - **Completeness:** Are all acceptance criteria addressed? Any requirements missed?
   - **Correctness:** Logic errors, edge cases, off-by-one errors, null/nil handling.
   - **Security:** Injection risks, auth/authz gaps, secrets in code, OWASP top 10.
   - **Performance:** N+1 queries, unbounded loops, missing pagination, unnecessary allocations.
   - **Error handling:** Unhappy paths covered? Errors propagated correctly? User-facing messages helpful?
   - **Tests:** Are new/changed paths tested? Any obvious gaps in coverage? Do test names describe behavior?
   - **Style & consistency:** Does the code follow the patterns already established in the codebase? Naming conventions, file organization, abstraction level.
   - **Dependencies/integrations:** If the task touches external service boundaries (from Phase 3 discovery), are those integrations handled correctly?
6. **Report findings** — Present a structured review:
   - **Summary:** One-paragraph overview of what the changes do.
   - **Requirements checklist:** Each AC item with pass/fail/partial status.
   - **Issues found:** Grouped by severity (blocking, warning, nit). Each with file, line, description, and suggested fix.
   - **What looks good:** Highlight well-implemented parts — this isn't just a fault-finder.
   - **Suggestions:** Optional improvements that aren't blocking (not required to address before merge).
7. **Offer next steps** — Based on findings:
   - If blocking issues: offer to fix them now.
   - If clean: suggest creating a PR. If uncommitted changes exist, offer to commit them first.
   - If task management is configured: offer to add a review-complete comment to the task.

Include a note: `/review` is for pre-PR self-review. It's not a replacement for team code review, but helps catch issues before involving reviewers.

#### 6e. Generate `feature.md`

Write to `.claude/commands/feature.md`. This command handles **feature specification** — defining what to build, why, and at what scope. It does NOT handle sprint planning or task scheduling (that's `/discuss`).

Include this description at the top of the generated command:
> Specify **what** to build: interactive feature specification, technical design, and scope planning. For planning **when** and **how** to execute, use `/discuss` instead. Use `/feature review {name}` to review an existing feature spec.

The generated command should handle two modes: **specification mode** (default) and **review mode**.

##### Specification mode (default)

Invoked as `/feature` or `/feature {feature-name}`. Drives an interactive discovery process that produces a complete feature specification before any code is written.

1. **Parse argument** — If `$ARGUMENTS` is empty, ask the user to name or describe the feature in a sentence. If a name is provided, use it as the working title. If the argument starts with `review`, switch to review mode (see below).

2. **Check for existing feature docs** — Search `planning/features/` (or the configured planning path) for docs matching the feature name. If found, ask the user whether to continue refining the existing spec or start fresh. If continuing, load the existing docs as starting context.

3. **Initial exploration** — Spawn exploration agents across all configured zones with `run_in_background: true`. Prompt them to:
   - Identify systems, modules, and patterns relevant to the feature description
   - Report existing code that the feature will interact with, extend, or depend on
   - Surface architectural constraints or patterns the feature must follow
   - Find related features already implemented that could serve as reference implementations

4. **Iterative discovery** — Conduct a structured Q&A to flesh out the feature. Use `AskUserQuestion` for multi-choice questions and conversation for open-ended ones. Work through these areas, but **adapt the order and depth based on user responses** — skip what's not relevant, dig deeper where there's ambiguity:

   **Problem & Purpose:**
   - What problem does this solve? Who is it for?
   - What does success look like? How will you know it's working?
   - Are there existing workarounds or partial solutions?

   **Scope & Boundaries:**
   - What's the MVP — the minimum that delivers value?
   - What's explicitly out of scope for now?
   - Are there phases or milestones (MVP → v1 → full vision)?

   **Behaviour & Requirements:**
   - What are the key user stories or use cases?
   - What are the acceptance criteria for each?
   - What happens in error/edge cases?
   - Are there performance, scale, or latency requirements?

   **Dependencies & Integration:**
   - What existing systems does this touch? (use agent findings to ground this)
   - What external services, APIs, or data sources are involved?
   - Are there ordering dependencies — things that must be built or changed first?
   - Does this feature depend on other planned-but-not-built features?

   **Technical Approach:**
   - What's the proposed architecture? (suggest based on agent findings and existing patterns)
   - What new interfaces, services, or data structures are needed?
   - What existing code needs modification?
   - Are there meaningful technical alternatives to evaluate?

   **Testing Strategy:**
   - What are the key test scenarios?
   - What needs unit tests vs integration tests vs manual verification?
   - Are there test data or fixture requirements?

   **Risks & Unknowns:**
   - What are you unsure about?
   - What could go wrong? What are the biggest risks?
   - Are there questions that need external input to answer?

   **Keep iterating** until the user is satisfied that the feature is well-defined. After each major section, summarize what's been captured and ask if anything is missing or needs revision. If exploration agents surface relevant code or patterns, present findings and ask follow-up questions based on them.

5. **Produce artifacts** — Once the discovery is complete, generate the feature documentation. Ask the user for approval before writing. Create a feature directory:

   ```
   planning/features/{feature-name}/
   ├── spec.md               # Feature specification
   ├── technical-design.md   # Technical design document
   └── scope.md              # Scope, phases, and milestones
   ```

   **`spec.md`** — The feature specification:
   ```markdown
   # Feature: {Feature Name}

   ## Problem Statement
   {What problem this solves and for whom}

   ## Success Criteria
   {How you know the feature is working — measurable outcomes}

   ## User Stories
   - As a {role}, I want {action} so that {benefit}

   ## Acceptance Criteria
   - [ ] {AC item with clear pass/fail definition}

   ## Out of Scope
   - {What this feature explicitly does NOT cover}

   ## Open Questions
   - {Anything unresolved that needs further input}
   ```

   **`technical-design.md`** — The technical design:
   ```markdown
   # Technical Design: {Feature Name}

   ## Overview
   {One-paragraph summary of the technical approach}

   ## Architecture
   {How the feature fits into the existing system — reference agent zone findings}

   ## Dependencies
   ### Internal
   - {Existing modules/services this depends on}
   ### External
   - {APIs, services, libraries}
   ### Ordering
   - {What must be built/changed before this feature}

   ## Key Changes
   ### New
   - `{path}` — {description of new file/module}
   ### Modified
   - `{path}` — {what changes and why}

   ## Interfaces & Data
   {New interfaces, data structures, API contracts}

   ## Alternatives Considered
   {Other approaches evaluated and why they were rejected}

   ## Risks
   - **{Risk}** — {Impact and mitigation}
   ```

   **`scope.md`** — Scope and phasing:
   ```markdown
   # Scope: {Feature Name}

   ## Phases

   ### Phase 1: MVP
   {Minimum viable scope that delivers value}
   - [ ] {Deliverable}
   - **Estimated complexity:** S/M/L

   ### Phase 2: {Name}
   {Next increment}
   - [ ] {Deliverable}
   - **Estimated complexity:** S/M/L

   ## Task Breakdown
   {Numbered tasks ready to become issues — each with summary, AC, and estimated complexity}

   | # | Task | Depends On | Complexity |
   |---|------|-----------|------------|
   | 1 | {task} | — | S |
   | 2 | {task} | 1 | M |

   ## Testing Strategy
   - **Unit:** {What gets unit tested}
   - **Integration:** {What needs integration testing}
   - **Manual:** {What requires manual verification}
   ```

6. **Offer next steps** — After writing the feature docs:
   - Offer to create GitHub Issues (or tasks in the configured provider) from the task breakdown in `scope.md`
   - Suggest `/discuss` to plan a sprint around this feature
   - Suggest `/start` to begin work on the first task
   - If there are open questions, highlight them and suggest resolving before starting implementation

##### Review mode

Invoked as `/feature review {feature-name}`.

1. **Find feature docs** — Search `planning/features/` for the named feature. If not found, list available features and ask the user to pick one. If multiple matches, disambiguate.

2. **Load all feature docs** — Read `spec.md`, `technical-design.md`, and `scope.md` for the feature.

3. **Spawn exploration agents** — For each zone referenced in the technical design's dependencies or key changes, spawn an agent to check the current state of those areas. Prompt them to:
   - Check if dependencies listed in the design are still accurate
   - Check if referenced code has changed since the feature was planned
   - Look for any new code or patterns that affect the feature's approach
   - Check for implementations that partially or fully address tasks in the scope

4. **Assess completeness** — Evaluate each document against a checklist:

   **Spec completeness:**
   - Does the problem statement clearly define the problem and audience?
   - Are success criteria measurable and specific?
   - Are acceptance criteria testable (clear pass/fail)?
   - Are edge cases and error scenarios covered?
   - Are out-of-scope items explicitly listed?

   **Technical design completeness:**
   - Are all dependencies identified (internal, external, ordering)?
   - Are key changes mapped to specific files/paths?
   - Are interfaces and data structures defined concretely?
   - Does the architecture align with the project's existing patterns? (check against agent findings)
   - Are risks identified with mitigations?

   **Scope completeness:**
   - Is the MVP clearly defined and separable from later phases?
   - Does the task breakdown have enough detail to create issues from?
   - Are task dependencies mapped?
   - Is the testing strategy concrete?

5. **Check for staleness** — Using agent findings, identify:
   - Dependencies that have changed since the feature was planned
   - Code that was referenced but has moved or been refactored
   - New patterns or systems introduced that the design should account for
   - Tasks in the scope that have already been partially implemented

6. **Report findings** — Present a structured review:

   ```
   ## Feature Review: {Feature Name}

   ### Status
   {Overall assessment: Ready to implement / Needs refinement / Significant gaps}

   ### Completeness
   - **Spec:** {Complete / Gaps found}
     - {List of missing or weak items}
   - **Technical Design:** {Complete / Gaps found}
     - {List of missing or weak items}
   - **Scope:** {Complete / Gaps found}
     - {List of missing or weak items}

   ### Staleness
   {Items that are outdated based on current codebase state}

   ### Open Questions
   {Unresolved items from the spec + any new questions raised by the review}

   ### Recommendations
   - {Specific actions to address gaps}
   ```

7. **Offer to fix** — For each gap or staleness issue found, offer to update the feature docs. Make changes interactively — show proposed updates and ask for approval before writing.

#### 6f. Update CLAUDE.md

Add a `## Workflow Configuration` section to the project's CLAUDE.md (create if it doesn't exist). This section acts as the "config" that the generated commands reference.

**Re-bootstrap handling:** Before writing, check if a `## Workflow Configuration` section already exists in CLAUDE.md. If it does, **replace** that section (from the `## Workflow Configuration` heading to the next `##` heading or end of file) rather than appending a duplicate. Warn the user that you're replacing the existing section and show a brief diff summary of what changed.

```markdown
## Workflow Configuration

### Commands
| Command | Purpose |
|---------|---------|
| `/feature` | Specify **what** to build — feature spec, technical design, scope |
| `/discuss` | Plan **when/how** to execute — sprint planning, task scheduling, backlog |
| `/start` | Begin a task — fetch context, create branch, spawn zone agents. Use `/start auto` for autonomous mode (implement, verify, commit, push, PR, merge). |
| `/resume` | Continue after a break — reconstruct context from durable state |
| `/review` | Pre-PR self-review — evaluate changes against requirements |

### Task Management
- **Provider:** {provider}
[PROVIDER-SPECIFIC CONFIG]

### Build & Test
- **Build command:** {BUILD_COMMAND}
- **Test command:** {TEST_COMMAND}

### Git Conventions
- **Branch format:** {branch_format}
- **Commit format:** {commit_format}
- **Default base branch:** {base_branch}
- **AI marker:** {ai_marker}

### Agent Zones
[Zone definitions for reference]

### Key Locations
[Key directories and their purposes]

[IF EXTERNAL DEPENDENCIES WERE DISCOVERED:]
### External Dependencies
[Services, APIs, sibling repos, and integration points — from Phase 3 discovery]

[IF GITHUB PROJECTS CONFIGURED:]
### GitHub Projects
- **Project number:** {PROJECT_NUM}
- **Project owner:** {PROJECT_OWNER}
- **Project ID:** {PROJECT_ID}
- **Status field ID:** {STATUS_FIELD_ID}
- **Status options:** {STATUS_OPTIONS}

[IF UTILITY SCRIPTS GENERATED (GitHub Issues provider):]
### Utility Scripts
- `scripts/issue.py` — Issue management (view, assign, unassign, label, unlabel)
- `scripts/next-issue.py` — Find next available task (`open` mode, `ready` mode with Projects)
- `scripts/project.py` — Project board operations (move, add) — only when GitHub Projects configured

[IF PLANNING DOCS:]
### Planning
- **Feature specs:** `planning/features/{feature-name}/` (created by `/feature`)
- **Sprint plans:** `planning/sprints/sprint-{N}-{name}/` (created by `/discuss`)
- **Task plans:** `{planning_path}/{TASK_ID}.md`
```

#### 6g. Configure Permissions

The generated commands need certain permissions to work without constant prompts. Check the project's `.claude/settings.json` (or `.claude/settings.local.json`) and offer to configure appropriate allow-lists.

**Always allow (non-destructive, essential for workflow):**
- `Read` tool — reading files is fundamental to all commands
- `Edit` tool — editing files is core to development work
- `Write` tool — creating planning docs, writing new files
- `Glob` tool — finding files by pattern
- `Grep` tool — searching file contents
- `Bash(git status)` — checking repo state
- `Bash(git branch*)` — listing/creating branches
- `Bash(git checkout*)` — switching branches
- `Bash(git log*)` — viewing history
- `Bash(git diff*)` — viewing changes
- `Bash(git add*)` — staging files
- `Bash(git commit*)` — committing (non-destructive)
- `Bash(git stash*)` — stashing changes
- Any MCP tools discovered in Phase 1 (e.g., `mcp__atlassian__*` for Jira)

**Language/stack-specific permissions (from Phase 3 findings):**

Based on the detected project type, also include relevant build, test, and run commands:

| Stack | Suggested allows |
|-------|-----------------|
| Node/TypeScript | `Bash(npm run*)`, `Bash(npx *)`, `Bash(yarn *)`, `Bash(pnpm *)`, `Bash(node *)`, `Bash(tsc *)` |
| Go | `Bash(go build*)`, `Bash(go test*)`, `Bash(go run*)`, `Bash(go vet*)`, `Bash(go mod*)` |
| Python | `Bash(python *)`, `Bash(pytest*)`, `Bash(mypy *)`, `Bash(ruff *)` |
| Rust | `Bash(cargo build*)`, `Bash(cargo test*)`, `Bash(cargo run*)`, `Bash(cargo clippy*)` |
| .NET/C# | `Bash(dotnet build*)`, `Bash(dotnet test*)`, `Bash(dotnet run*)` |
| Ruby | `Bash(bundle *)`, `Bash(rake *)`, `Bash(ruby *)`, `Bash(rspec *)` |
| Unity | `Bash(unity-editor*)`, any project-specific build scripts found in `scripts/` or `Makefile` |

Add any project-specific scripts found during codebase analysis (e.g., `Bash(make *)`, `Bash(./scripts/*)`) to the allow list.

**GitHub Issues provider — additional permissions:**
- `Bash(gh issue *)` — issue operations (view, edit, comment, close)
- `Bash(gh pr *)` — pull request operations (create, merge, view)
- `Bash(gh project *)` — project board operations (when GitHub Projects configured)
- `Bash(python scripts/*)` — utility scripts (when generated in Phase 6i)

**Ask the user whether to allow (potentially destructive):**
- `Bash(git push*)` — pushes to remote
- `Bash(git merge*)` — merging branches
- `Bash(git rebase*)` — rewriting history
- `Bash(git reset*)` — resetting state
- `Bash(git clean*)` — removing untracked files
- `Bash(rm *)` — deleting files
- `Bash(npm install*)`, `Bash(pip install*)`, `Bash(cargo add*)`, etc. — installing/modifying dependencies
- `Bash(gh pr merge*)` — merging PRs (required for auto mode)

**Note on auto mode:** If the user intends to use auto mode (`/start auto`), they will need `Bash(git push*)` and `Bash(gh pr merge*)` permissions. Mention this when presenting the destructive permissions list — auto mode requires these to complete the full autonomous cycle (implement → verify → commit → push → PR → merge).

Present the user with the proposed permission configuration and ask for approval before writing to `.claude/settings.json`. Explain that they can always adjust permissions later by editing the file directly.

#### 6h. Git Hygiene Setup

Based on the project type detected in Phase 3, check and offer to create or update git configuration files.

**`.gitignore`:**
- Check if `.gitignore` exists. If it does, review it for completeness against the detected stack.
- If missing or incomplete, generate one appropriate for the language/stack. Use standard patterns:
  - **Node/TypeScript:** `node_modules/`, `dist/`, `.env`, `.env.local`, `*.tsbuildinfo`
  - **Go:** binary output dirs, `vendor/` (if not vendoring), `.env`
  - **Python:** `__pycache__/`, `*.pyc`, `.venv/`, `venv/`, `dist/`, `*.egg-info/`, `.env`
  - **Rust:** `target/`, `Cargo.lock` (for libraries only)
  - **.NET/C#:** `bin/`, `obj/`, `*.user`, `*.suo`
  - **Ruby:** `.bundle/`, `vendor/bundle/`, `*.gem`
  - **Unity:** `Library/`, `Temp/`, `Obj/`, `Build/`, `Builds/`, `Logs/`, `UserSettings/`, `*.csproj`, `*.sln`
- Always include: `.env`, `.env.local`, `.env.*.local`, `.DS_Store`, `*.log`
- Always include Claude Code artifacts that shouldn't be committed: `.claude/settings.local.json`
- If a `.gitignore` already exists, show what entries would be added and ask before modifying.

**`.gitattributes`:**
- Check if `.gitattributes` exists. If the project uses file types that benefit from explicit line-ending or diff handling, offer to create one:
  - Text normalization (`* text=auto`)
  - Language-specific diff drivers (e.g., `*.swift diff=swift`, `*.cs diff=csharp`)
  - Binary file markers for known binary types in the project (e.g., `*.png binary`, `*.fbx binary`, `*.unity binary`)
- If the project doesn't need special handling, skip this — don't create it just for the sake of it.

**Git LFS:**
- Scan the repo for large binary files or binary-heavy directories (e.g., assets, models, textures, `.fbx`, `.png`, `.psd`, `.unitypackage`, `.dll`).
- If large binaries are found or the project type commonly uses them (e.g., Unity, game dev):
  - Check if Git LFS is already configured (`git lfs install` / `.gitattributes` LFS entries).
  - If not configured, **alert the user**: explain that large binaries can bloat the repo and suggest setting up Git LFS. Offer to configure it with appropriate track patterns.
  - If already configured, verify the tracked patterns cover the binary types present.
- If the project has no binary files and the stack doesn't typically need LFS, skip silently.

For all files in this step: show the proposed content, ask for approval, and only write after confirmation.

#### 6i. Generate GitHub Utility Scripts

**Only generated when the provider is GitHub Issues.** Create a `scripts/` directory with the following Python scripts. Each script wraps `gh` CLI calls for common issue and project board operations.

**`scripts/issue.py`** — Common issue operations, parameterized with `REPO` from Phase 1:

```python
#!/usr/bin/env python3
"""Common GitHub issue operations.

Usage:
  python scripts/issue.py view <issue_num>         # Show issue summary
  python scripts/issue.py assign <issue_num>       # Assign to yourself
  python scripts/issue.py unassign <issue_num>     # Remove your assignment
  python scripts/issue.py label <issue_num> <label> [<label> ...]   # Add labels
  python scripts/issue.py unlabel <issue_num> <label> [<label> ...]  # Remove labels
"""
import json, subprocess, sys

REPO = "{REPO}"


def gh(*args, json_output=False):
    cmd = ["gh"] + list(args)
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if result.returncode != 0:
        print(f"Error: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    if json_output:
        return json.loads(result.stdout)
    return result.stdout.strip()


def cmd_view(issue_num):
    data = gh("issue", "view", str(issue_num), "--repo", REPO,
              "--json", "number,title,state,labels,assignees,milestone,body",
              json_output=True)
    labels = ", ".join(l["name"] for l in data.get("labels", [])) or "(none)"
    assignees = ", ".join(a["login"] for a in data.get("assignees", [])) or "(none)"
    milestone = (data.get("milestone") or {}).get("title", "(none)")
    print(f"#{data['number']} - {data['title']}")
    print(f"  State:     {data['state']}")
    print(f"  Labels:    {labels}")
    print(f"  Assignees: {assignees}")
    print(f"  Milestone: {milestone}")
    body = data.get("body", "").strip()
    if body:
        print(f"\n{body}")


def cmd_assign(issue_num):
    gh("issue", "edit", str(issue_num), "--repo", REPO, "--add-assignee", "@me")
    print(f"#{issue_num} assigned to you.")


def cmd_unassign(issue_num):
    gh("issue", "edit", str(issue_num), "--repo", REPO, "--remove-assignee", "@me")
    print(f"#{issue_num} unassigned from you.")


def cmd_label(issue_num, labels):
    for label in labels:
        gh("issue", "edit", str(issue_num), "--repo", REPO, "--add-label", label)
    print(f"#{issue_num} labels added: {', '.join(labels)}")


def cmd_unlabel(issue_num, labels):
    for label in labels:
        gh("issue", "edit", str(issue_num), "--repo", REPO, "--remove-label", label)
    print(f"#{issue_num} labels removed: {', '.join(labels)}")


def main():
    if len(sys.argv) < 3:
        print(__doc__.strip())
        sys.exit(2)

    command = sys.argv[1]
    issue_num = int(sys.argv[2].lstrip("#"))

    if command == "view":
        cmd_view(issue_num)
    elif command == "assign":
        cmd_assign(issue_num)
    elif command == "unassign":
        cmd_unassign(issue_num)
    elif command == "label":
        if len(sys.argv) < 4:
            print("Usage: issue.py label <issue_num> <label> [<label> ...]")
            sys.exit(2)
        cmd_label(issue_num, sys.argv[3:])
    elif command == "unlabel":
        if len(sys.argv) < 4:
            print("Usage: issue.py unlabel <issue_num> <label> [<label> ...]")
            sys.exit(2)
        cmd_unlabel(issue_num, sys.argv[3:])
    else:
        print(f"Unknown command '{command}'. Use: view, assign, unassign, label, unlabel")
        sys.exit(2)


if __name__ == "__main__":
    main()
```

**`scripts/next-issue.py`** — Find the next issue to work on, parameterized with `REPO` (and `PROJECT_NUM`, `PROJECT_OWNER` when GitHub Projects is configured):

```python
#!/usr/bin/env python3
"""Print the next 3 issues to work on that don't have branches yet.

Usage:
  python scripts/next-issue.py open    # From open unassigned issues
  python scripts/next-issue.py ready   # From project board "Ready" column (requires GitHub Projects)
"""
import json, subprocess, re, sys

REPO = "{REPO}"
# GitHub Projects config (empty if not configured)
PROJECT_NUM = {PROJECT_NUM}  # None if not configured
PROJECT_OWNER = "{PROJECT_OWNER}"  # empty string if not configured

mode = sys.argv[1] if len(sys.argv) > 1 else "open"

branches = subprocess.check_output(["git", "branch", "-a"], text=True, encoding="utf-8")
taken = {int(m) for m in re.findall(r"/(\d+)-", branches)}

if mode == "ready":
    if not PROJECT_NUM:
        print("GitHub Projects not configured. Use 'open' mode instead.")
        sys.exit(2)
    board = json.loads(subprocess.check_output(
        ["gh", "project", "item-list", str(PROJECT_NUM), "--owner", PROJECT_OWNER,
         "--format", "json", "--limit", "50"],
        text=True, encoding="utf-8"
    ))
    candidates = sorted(
        (i["content"]["number"], i["content"]["title"])
        for i in board["items"]
        if i.get("status") == "Ready" and i["content"]["number"] not in taken
    )
    empty_msg = "No Ready issues without branches."
elif mode == "open":
    issues = json.loads(subprocess.check_output(
        ["gh", "issue", "list", "--repo", REPO, "--state", "open",
         "--json", "number,title,assignees", "--limit", "50"],
        text=True, encoding="utf-8"
    ))
    candidates = sorted(
        (i["number"], i["title"])
        for i in issues
        if not i.get("assignees") and i["number"] not in taken
    )
    empty_msg = "No open unassigned issues without branches."
else:
    print(f"Unknown mode: {mode}. Use 'open' or 'ready'.")
    sys.exit(2)

if not candidates:
    print(empty_msg)
    sys.exit(1)

for num, title in candidates[:3]:
    print(f"#{num} -- {title}")
```

**`scripts/project.py`** — **Only generated when GitHub Projects is configured.** Manage project board items, parameterized with all project IDs from Phase 1 discovery:

```python
#!/usr/bin/env python3
"""Manage GitHub project board items.

Usage:
  python scripts/project.py move <issue_num> <status>
  python scripts/project.py add  <issue_num> [<status>]

Statuses: {comma-separated STATUS_OPTIONS keys}

Examples:
  python scripts/project.py move 4 in-progress
  python scripts/project.py add 4 ready
"""
import json, subprocess, sys

PROJECT_NUM = {PROJECT_NUM}
PROJECT_OWNER = "{PROJECT_OWNER}"
REPO = "{REPO}"

PROJECT_ID = "{PROJECT_ID}"
STATUS_FIELD_ID = "{STATUS_FIELD_ID}"

STATUS_OPTIONS = {STATUS_OPTIONS}  # dict mapping status name -> option ID


def gh(*args, json_output=False):
    cmd = ["gh"] + list(args)
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if result.returncode != 0:
        print(f"Error: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    if json_output:
        return json.loads(result.stdout)
    return result.stdout.strip()


def find_item_id(issue_num):
    """Find the project item ID for an issue already on the board."""
    board = gh("project", "item-list", str(PROJECT_NUM), "--owner", PROJECT_OWNER,
               "--format", "json", "--limit", "200", json_output=True)
    for item in board.get("items", []):
        content = item.get("content", {})
        if content.get("number") == issue_num:
            return item["id"]
    return None


def add_item(issue_num):
    """Add an issue to the project board, returning the item ID."""
    url = f"https://github.com/{REPO}/issues/{issue_num}"
    result = gh("project", "item-add", str(PROJECT_NUM), "--owner", PROJECT_OWNER,
                "--url", url, "--format", "json", json_output=True)
    return result["id"]


def set_status(item_id, status):
    """Set the status field on a project item."""
    option_id = STATUS_OPTIONS[status]
    gh("project", "item-edit", "--project-id", PROJECT_ID,
       "--id", item_id, "--field-id", STATUS_FIELD_ID,
       "--single-select-option-id", option_id)


def cmd_move(issue_num, status):
    item_id = find_item_id(issue_num)
    if not item_id:
        print(f"Issue #{issue_num} not found on project board. Use 'add' first.")
        sys.exit(1)
    set_status(item_id, status)
    print(f"#{issue_num} -> {status}")


def cmd_add(issue_num, status=None):
    item_id = find_item_id(issue_num)
    if item_id:
        print(f"#{issue_num} already on board.")
    else:
        item_id = add_item(issue_num)
        print(f"#{issue_num} added to board.")
    if status:
        set_status(item_id, status)
        print(f"#{issue_num} -> {status}")


def main():
    if len(sys.argv) < 3:
        print(__doc__.strip())
        sys.exit(2)

    command = sys.argv[1]
    issue_num = int(sys.argv[2].lstrip("#"))

    if command == "move":
        if len(sys.argv) < 4:
            print("Usage: project.py move <issue_num> <status>")
            sys.exit(2)
        status = sys.argv[3]
        if status not in STATUS_OPTIONS:
            print(f"Unknown status '{status}'. Options: {', '.join(STATUS_OPTIONS)}")
            sys.exit(2)
        cmd_move(issue_num, status)
    elif command == "add":
        status = sys.argv[3] if len(sys.argv) > 3 else None
        if status and status not in STATUS_OPTIONS:
            print(f"Unknown status '{status}'. Options: {', '.join(STATUS_OPTIONS)}")
            sys.exit(2)
        cmd_add(issue_num, status)
    else:
        print(f"Unknown command '{command}'. Use 'move' or 'add'.")
        sys.exit(2)


if __name__ == "__main__":
    main()
```

Replace the `{REPO}`, `{PROJECT_NUM}`, `{PROJECT_OWNER}`, `{PROJECT_ID}`, `{STATUS_FIELD_ID}`, and `{STATUS_OPTIONS}` placeholders with the actual values discovered in Phase 1. For `next-issue.py`, set `PROJECT_NUM = None` and `PROJECT_OWNER = ""` when GitHub Projects is not configured.

---

### Phase 7: Verify and Report

After generating all files:

1. List the files created and their paths. If utility scripts were generated (GitHub Issues provider), list them separately under a **Utility Scripts** heading:
   - `scripts/issue.py` — issue management (view, assign, label)
   - `scripts/next-issue.py` — find next available task
   - `scripts/project.py` — project board operations (only when GitHub Projects configured)
2. Show a quick summary of what each command does (`/feature`, `/discuss`, `/start`, `/resume`, `/review`). Include auto mode in the `/start` description: "`/start auto next` — autonomous mode: implement, verify, commit, push, create PR, and merge without confirmation prompts"
3. Suggest the user try `/feature` to spec out their first feature, `/start {EXAMPLE_TASK_ID}` to begin an existing task, or `/start auto next` for fully autonomous task completion
4. If GitHub Projects is configured, verify that the discovered project IDs are correct by confirming the project board name and status columns with the user
5. Mention they can re-run `/bootstrap` to regenerate if needed

---

## Provider Reference

Use these patterns when generating provider-specific sections. GitHub Issues is fully supported with utility scripts, project board integration, and auto mode. Other providers are supported for basic task fetching and status transitions but may require additional configuration for advanced features.

### GitHub Issues

GitHub Issues is the recommended provider. It has full scripting support via generated utility scripts.

- **Fetch task:** Use `gh issue view {NUMBER} --json number,title,state,labels,assignees,milestone,body` via Bash
- **Task ID pattern:** `#\d+` or just the number
- **Transition:** Use `gh issue close` or label changes, or `python scripts/project.py move {NUMBER} {status}` when Projects is configured
- **Comment:** Use `gh issue comment {NUMBER} -b "message"`
- **Assign:** Use `python scripts/issue.py assign {NUMBER}` or `gh issue edit {NUMBER} --add-assignee @me`
- **Branch extraction regex:** Extract number from branch name (e.g., `(\d+)` from `feature/42-task-name` — never include `#` in branch names as it interferes with shell and command parsing)
- **Next task:** Use `python scripts/next-issue.py open` (or `ready` when Projects is configured) to find unstarted issues without branches
- **Project board:** When GitHub Projects is configured, use `python scripts/project.py move {NUMBER} {status}` and `python scripts/project.py add {NUMBER} [status]`
- **CLAUDE.md config:**
  ```
  - **Provider:** GitHub Issues
  - **Repository:** {REPO}
  ```
  When Projects is configured, also include:
  ```
  - **Project number:** {PROJECT_NUM}
  - **Project owner:** {PROJECT_OWNER}
  - **Project ID:** {PROJECT_ID}
  - **Status field ID:** {STATUS_FIELD_ID}
  - **Status options:** {STATUS_OPTIONS map}
  ```

### Jira

> Requires additional setup for full scripting support. See GitHub Issues section for reference implementation.

- **Fetch task:** Use `jira-task-manager` agent or `mcp__atlassian__getJiraIssue` tool
- **Task ID pattern:** `{PROJECT_KEY}-\d+` (e.g., `PROJ-1234`)
- **Transition:** Use `jira-task-manager` agent to transition status
- **Comment:** Use `jira-task-manager` agent to add comments
- **Branch extraction regex:** Extract `{PROJECT_KEY}-\d+` from branch name
- **CLAUDE.md config:**
  ```
  - **Provider:** Jira
  - **Instance:** {instance_url}
  - **Cloud ID:** {cloud_id}
  - **Project key:** {project_key}
  ```

### Linear

> Requires additional setup for full scripting support. See GitHub Issues section for reference implementation.

- **Fetch task:** Use Linear MCP tools if available, or `linear` CLI
- **Task ID pattern:** `{TEAM}-\d+` (e.g., `ENG-123`)
- **Transition:** Update issue state via Linear API/MCP
- **Comment:** Add comment via Linear API/MCP
- **Branch extraction regex:** Extract `{TEAM}-\d+` from branch name

### Asana

> Requires additional setup for full scripting support. See GitHub Issues section for reference implementation.

- **Fetch task:** Use Asana MCP tools if available, or `asana` CLI (`asana tasks get {TASK_GID}`)
- **Task ID pattern:** Numeric GID (e.g., `1234567890123`) — Asana uses long numeric IDs
- **Transition:** Move task to a different section/column via Asana API/MCP, or update custom status field
- **Comment:** Add story (comment) to task via Asana API/MCP or `asana stories create --task {TASK_GID}`
- **Branch extraction regex:** Extract numeric GID from branch name (e.g., `feature/1234567890123-task-name`)
- **CLAUDE.md config:**
  ```
  - **Provider:** Asana
  - **Workspace GID:** {workspace_gid}
  - **Project GID:** {project_gid}
  ```

### None / Manual
- **Fetch task:** Skip or ask user to describe the task
- **Task ID pattern:** User-defined or free-form
- **Transition:** Skip
- **Comment:** Skip
- **Branch extraction:** Use full branch name as context

# Agentic Bootstrap

A global [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skill that generates a complete AI-assisted development workflow for any project. Run `/bootstrap` once to configure task management, planning infrastructure, and five slash commands that drive a repeatable plan-build-test-ship cycle.

## Overview

`/bootstrap` interviews you about your project — task management provider, git conventions, codebase structure, planning preferences — then generates a set of project-specific slash commands and configuration that turn Claude Code into a context-aware development agent.

**Generated artifacts:**

| Artifact | Path | Purpose |
|----------|------|---------|
| `/feature` command | `.claude/commands/feature.md` | Feature specification and design |
| `/start` command | `.claude/commands/start.md` | Begin work on a task |
| `/resume` command | `.claude/commands/resume.md` | Continue after context loss |
| `/review` command | `.claude/commands/review.md` | Pre-PR self-review |
| `/discuss` command | `.claude/commands/discuss.md` | Sprint planning, task design, architecture |
| Workflow config | `CLAUDE.md` (appended section) | Zone definitions, conventions, provider config |
| Permissions | `.claude/settings.json` | Safe defaults for agentic operation |
| Planning scaffold | `planning/` (optional) | Sprint directories, task specs, TDD specs |
| Git hygiene | `.gitignore`, `.gitattributes` | Stack-appropriate defaults |

## Architecture

The system has three layers. Each builds on the one below.

```mermaid
flowchart TD
    subgraph bootstrap ["Layer 1 — Bootstrap (one-time setup)"]
        B["/bootstrap\nInterviews you about the project\nGenerates everything below"]
    end

    subgraph commands ["Layer 2 — Commands (daily development)"]
        direction LR
        CC["/feature"]
        D["/discuss"]
        E["/start"]
        F["/resume"]
        G["/review"]
    end

    subgraph infra ["Layer 3 — Infrastructure (durable state)"]
        direction LR
        H["Task Provider"]
        I["Planning Docs"]
        J["Zone Agents"]
        K["Git + Branch"]
    end

    bootstrap --> commands
    commands --> infra

    style bootstrap fill:#2d3748,color:#e2e8f0,stroke:#4a5568
    style commands fill:#2c5282,color:#e2e8f0,stroke:#2b6cb0
    style infra fill:#276749,color:#e2e8f0,stroke:#2f855a
    style B fill:#2d3748,color:#e2e8f0,stroke:#4a5568
    style CC fill:#2c5282,color:#e2e8f0,stroke:#2b6cb0
    style D fill:#2c5282,color:#e2e8f0,stroke:#2b6cb0
    style E fill:#2c5282,color:#e2e8f0,stroke:#2b6cb0
    style F fill:#2c5282,color:#e2e8f0,stroke:#2b6cb0
    style G fill:#2c5282,color:#e2e8f0,stroke:#2b6cb0
    style H fill:#276749,color:#e2e8f0,stroke:#2f855a
    style I fill:#276749,color:#e2e8f0,stroke:#2f855a
    style J fill:#276749,color:#e2e8f0,stroke:#2f855a
    style K fill:#276749,color:#e2e8f0,stroke:#2f855a
```

**Layer 1 — Bootstrap** configures the project once. **Layer 2 — Commands** orchestrate daily development. **Layer 3 — Infrastructure** provides the durable state (issues, planning docs, git history) that commands read and write.

## Bootstrap Phases

When you run `/bootstrap`, it walks through seven phases to tailor the workflow to your project.

```mermaid
flowchart TD
    P1["Phase 1: Task Management\nJira / Linear / GitHub Issues / Asana / None"]
    P2["Phase 2: Git Conventions\nBranch format, commit format, base branch"]
    P3["Phase 3: Codebase Analysis\nDetect stack, map directories,\ndiscover external dependencies"]
    P4["Phase 4: Agent Zones\nDefine 3-6 exploration zones\nmapped to codebase areas"]
    P5["Phase 5: Planning Structure\nFull sprints / Task-level / None\nScaffold directories, TDD config"]
    P6["Phase 6: Generate\nWrite commands, update CLAUDE.md,\nconfigure permissions, git hygiene"]
    P7["Phase 7: Verify\nList created files, suggest first /start"]

    P1 --> P2 --> P3 --> P4 --> P5 --> P6 --> P7

    style P1 fill:#2d3748,color:#e2e8f0
    style P2 fill:#2d3748,color:#e2e8f0
    style P3 fill:#2d3748,color:#e2e8f0
    style P4 fill:#2d3748,color:#e2e8f0
    style P5 fill:#2d3748,color:#e2e8f0
    style P6 fill:#2d3748,color:#e2e8f0
    style P7 fill:#2d3748,color:#e2e8f0
```

### Phase details

| Phase | What it does | Key decisions |
|-------|-------------|---------------|
| **1. Task Management** | Discovers your issue tracker and how to connect to it | Provider choice, connection details (instance URL, project key, repo, etc.), MCP vs CLI fallback |
| **2. Git Conventions** | Captures branching and commit standards | Branch prefix format, commit message format, base branch detection, AI marker preference |
| **3. Codebase Analysis** | Explores the repo to understand its structure | Stack detection, key directories, external services/APIs, sibling repos |
| **4. Agent Zones** | Defines parallel exploration agents mapped to codebase areas | Zone names, paths, triggers, integration boundaries (see [Agent Zones](#agent-zones)) |
| **5. Planning Structure** | Chooses planning depth and scaffolds directories | Full sprints vs task-level vs none, TDD integration, sprint naming (see [Planning & TDD](#planning--tdd-flow)) |
| **6. Generate** | Writes all artifacts to the project | Slash commands, CLAUDE.md config, permissions, `.gitignore`/`.gitattributes`/LFS |
| **7. Verify** | Confirms setup and suggests first task | Lists created files, proposes `/start {TASK_ID}` |

Re-running `/bootstrap` is safe — it detects existing artifacts and replaces the workflow config section in CLAUDE.md rather than duplicating it.

## Task Lifecycle

The four generated commands form a cycle. Tasks flow from planning through implementation to review.

```mermaid
flowchart LR
    feature["/feature\nSpec out the feature\nTechnical design\nScope & phasing"]
    discuss["/discuss\nPlan sprints\nBreak down tasks\nDesign architecture"]
    start["/start #N\nFetch task context\nCreate branch\nLoad planning docs\nSpawn zone agents"]
    implement["Implement\nWrite code\nBuild/test loop\nCommit progress"]
    resume["/resume\nDetect branch\nRe-fetch context\nCheck progress\nSpawn zone agents"]
    review["/review\nGather requirements\nDiff against AC\nStructured report"]
    pr["Create PR\nMerge\nClose issue"]

    feature -- "spec, design,\ntask breakdown" --> discuss
    feature -- "creates issues" --> start
    discuss -- "creates issues\n& task specs" --> start
    start --> implement
    implement -- "context lost?\nnew session?" --> resume
    resume --> implement
    implement -- "feature complete" --> review
    review -- "blocking issues" --> implement
    review -- "clean" --> pr
    pr -. "next task" .-> start

    style feature fill:#744210,color:#e2e8f0,stroke:#975a16
    style discuss fill:#553c9a,color:#e2e8f0,stroke:#6b46c1
    style start fill:#2c5282,color:#e2e8f0,stroke:#2b6cb0
    style implement fill:#276749,color:#e2e8f0,stroke:#2f855a
    style resume fill:#2c5282,color:#e2e8f0,stroke:#2b6cb0
    style review fill:#9c4221,color:#e2e8f0,stroke:#c05621
    style pr fill:#276749,color:#e2e8f0,stroke:#2f855a
```

### What each command does

**`/feature`** — Spec out a feature before building it. Runs an interactive discovery process grounded in codebase exploration:
1. Spawns zone agents to understand what exists — relevant systems, patterns, dependencies, reference implementations
2. Walks through structured Q&A: problem/purpose, scope/MVP, behaviour/AC, dependencies, technical approach, testing strategy, risks
3. Keeps iterating until requirements and dependencies are fully fleshed out — summarizes after each section, asks what's missing
4. Produces three documents: `spec.md` (what and why), `technical-design.md` (how), `scope.md` (phases, task breakdown, testing)
5. Offers to create issues from the task breakdown and suggests `/discuss` for sprint planning or `/start` to begin

**`/feature review {name}`** — Reviews an existing feature spec for completeness and staleness:
1. Loads all feature docs and spawns agents to check the current codebase state against the design
2. Evaluates completeness: are AC testable? Are dependencies identified? Is the MVP separable? Are risks mitigated?
3. Checks for staleness: code that's moved, new patterns introduced, tasks already partially implemented
4. Reports gaps and offers to update the docs interactively

**`/start #N`** — Begin work on a task.
1. Parses the task identifier (accepts `next` to auto-select the lowest unstarted issue)
2. Fetches task context from the configured provider (title, description, AC, labels, links)
3. Guards against duplicate work (checks for existing branches and planning docs)
4. Creates a feature branch using the configured naming convention
5. Loads planning docs — surfaces the task spec, AC, and TDD specs if they exist
6. Spawns zone exploration agents in parallel (background)
7. Transitions the task to in-progress
8. Reports a setup summary and waits for agent findings before starting work

**`/resume`** — Continue after a session break. All durable state lives in git, the issue tracker, and planning docs — not in the conversation. `/resume` reconstructs context from these sources:
1. Detects the current branch and extracts the task ID
2. Re-fetches task context from the provider
3. Checks progress: commits on branch, changed files, completed AC items, planning doc status
4. Re-spawns zone agents for fresh codebase context
5. Reports what's done and what to work on next

**`/review`** — Pre-PR self-review against requirements.
1. Gathers requirements from all sources (issue tracker + planning docs + task specs)
2. Collects the full diff (`base..HEAD`) plus any uncommitted changes
3. Spawns deep review agents per affected zone
4. Evaluates: completeness (AC checklist), correctness, architecture compliance, security, performance, error handling, tests, style
5. Reports findings grouped by severity (blocking / warning / nit) with file and line references
6. Offers next steps — fix issues, create PR, or update planning docs

**`/discuss`** — Collaborative planning. Adapts to what you need:
- **Sprint planning**: Break a roadmap phase into numbered tasks with requirements, AC, file lists, dependencies, and complexity ratings. Creates the sprint directory, task specs, TDD specs, and optionally GitHub Issues.
- **Task design**: Think through a specific task's approach, edge cases, and risks. Update the planning doc with decisions.
- **Architecture**: Reason through design trade-offs with codebase exploration for grounding.
- **Backlog**: Review, prioritize, and pull deferred items into sprint planning.

## Context Hydration

Every command automatically assembles context from multiple sources. The human never re-explains what they're working on — the branch name encodes the task ID, and the task ID links to everything else.

```mermaid
flowchart TD
    branch["Git Branch\nfeature/{TASK_ID}-name"]
    taskid["Task ID\nextracted from branch"]

    subgraph sources ["Context Sources"]
        provider["Task Provider\nTitle, description, AC,\nlabels, links, comments"]
        planning["Planning Docs\nSprint overview, task spec,\nTDD spec, COMPLETED.md"]
        codebase["Codebase\nZone agents explore\nrelevant directories"]
        git["Git History\nCommits on branch,\nchanged files, diff"]
    end

    subgraph hydrated ["Hydrated Context"]
        what["What to build\nRequirements + AC"]
        where["Where to build it\nFile paths + patterns"]
        how["How to build it\nExisting patterns + tests"]
        progress["What's done\nCommits + planning status"]
    end

    branch --> taskid
    taskid --> provider
    taskid --> planning
    taskid --> codebase
    taskid --> git

    provider --> what
    planning --> what
    planning --> where
    codebase --> how
    codebase --> where
    git --> progress
    planning --> progress

    style branch fill:#2d3748,color:#e2e8f0
    style taskid fill:#2d3748,color:#e2e8f0
    style sources fill:#1a202c,color:#e2e8f0,stroke:#4a5568
    style hydrated fill:#1a202c,color:#e2e8f0,stroke:#4a5568
```

This means **sessions are disposable**. You can close Claude Code, come back days later, run `/resume`, and pick up exactly where you left off. All state lives in durable stores, not the conversation.

## Agent Zones

During bootstrap, you define 3-6 **zones** — areas of your codebase that map to distinct concerns. Each command spawns zone-specific exploration agents in parallel, keeping the main context window lean while grounding decisions in real code.

```mermaid
flowchart TD
    command["/start or /resume"]
    task["Task: Implement payment webhook handler"]

    command --> task
    task --> dispatch{"Which zones\nare relevant?"}

    dispatch --> z1["Zone: API Surface\npaths: src/api/, src/routes/\n'API changes, endpoints, middleware'"]
    dispatch --> z2["Zone: Core Logic\npaths: src/services/, src/models/\n'Business logic, data models'"]
    dispatch --> z3["Zone: Infrastructure\npaths: src/config/, src/db/\n'Database, queues, external services'"]
    dispatch --> z4["Zone: Tests\npaths: tests/\n'Test patterns, fixtures, coverage'"]

    z1 --> findings["Agent Findings\nExisting patterns to follow\nRelated code to understand\nContracts and interfaces"]
    z2 --> findings
    z3 --> findings
    z4 --> findings

    findings --> impl["Implementation\nwith full codebase context"]

    style command fill:#2c5282,color:#e2e8f0
    style task fill:#2d3748,color:#e2e8f0
    style dispatch fill:#2d3748,color:#e2e8f0
    style z1 fill:#553c9a,color:#e2e8f0
    style z2 fill:#553c9a,color:#e2e8f0
    style z3 fill:#553c9a,color:#e2e8f0
    style z4 fill:#553c9a,color:#e2e8f0
    style findings fill:#276749,color:#e2e8f0
    style impl fill:#276749,color:#e2e8f0
```

### How zones are defined

Each zone captures:

| Field | Purpose | Example |
|-------|---------|---------|
| **Name** | Short label | "API Surface" |
| **Paths** | Directories to explore | `src/api/`, `src/routes/`, `src/middleware/` |
| **Description** | What this zone covers | "REST endpoints, request validation, auth middleware" |
| **Triggers** | Task types that activate this zone | "API changes, new endpoints, auth work" |
| **Dependencies** | External services or sibling repos this zone touches | "Calls payments API via `src/clients/payments.ts`" |

Zones are stored in the `## Workflow Configuration` section of CLAUDE.md so all commands can reference them.

### Why zones matter

- **Parallel exploration.** Agents run concurrently, so a 6-zone project gets explored in the time it takes to explore one zone.
- **Focused context.** Each agent only reads its own zone's code, avoiding context window bloat from loading the entire codebase.
- **Selective activation.** Not every task needs every zone. A CSS-only change won't spawn the database agent.
- **Review depth.** `/review` spawns *deep* review agents per zone — each one checks how the diff interacts with surrounding code, not just the diff in isolation.

## Planning & TDD Flow

Bootstrap offers three planning modes. The mode determines how much structure `/discuss` creates and how much context `/start` and `/review` can draw from.

### Planning modes

| Mode | Best for | What gets created |
|------|----------|-------------------|
| **Full project planning** | Greenfield projects, phased roadmaps | Sprint directories, task specs with AC, TDD specs, backlog management |
| **Task-level only** | Established codebases with external task management | Per-task planning doc with context, approach, and notes |
| **None** | Quick fixes, well-defined external specs | No local planning docs — commands use the issue tracker alone |

### Full planning structure

When full planning is enabled, `/discuss` creates a structured sprint directory:

```
planning/
├── {NN}_{topic}.md                  # Project-level docs (architecture, features, etc.)
├── backlog/
│   └── README.md                    # Guidelines for parking/pulling deferred work
└── sprints/
    └── sprint-{N}-{name}/
        ├── 00_sprint_overview.md    # Goal, task table, dependencies, success criteria
        ├── 01_{task}.md             # Task spec: requirements, AC, files, API surface
        ├── 02_{task}.md
        ├── ...
        ├── COMPLETED.md             # Tracks merged work
        └── tdd/
            └── phase-{NN}-{name}.md # Test categories, fixtures, coverage goals
```

### The planning-to-code pipeline

This is how planning artifacts drive implementation through the full lifecycle, using GitHub Issues as an example provider:

```mermaid
flowchart TD
    subgraph feature_phase ["Feature Definition — /feature"]
        feature_cmd["/feature 'payment processing'"]
        explore["Explore Codebase\nZone agents identify\nexisting systems & patterns"]
        qa["Iterative Q&A\nProblem, scope, behaviour,\ndependencies, risks"]
        feature_spec["spec.md\nProblem, AC, user stories"]
        tech_design["technical-design.md\nArchitecture, dependencies,\nkey changes, interfaces"]
        scope_doc["scope.md\nPhases, task breakdown,\ntesting strategy"]
    end

    subgraph plan ["Sprint Planning — /discuss"]
        discuss_cmd["/discuss 'next sprint'"]
        sprint["Sprint Overview\n00_sprint_overview.md\nGoal, task table, dependencies"]
        specs["Task Specs\n01_task.md, 02_task.md, ...\nRequirements, AC, files to create"]
        tdd["TDD Specs\ntdd/phase-*.md\nTest categories, fixtures, coverage"]
        issues["GitHub Issues\nOne per task, with AC\nLinked to sprint"]
    end

    subgraph exec ["Execution Phase — /start, /resume"]
        start_cmd["/start #42"]
        fetch["Fetch Context\nGH Issue → title, AC, labels\nTask spec → requirements, files\nTDD spec → tests to write"]
        branch["Create Branch\nfeature/42-payment-webhook"]
        implement["Implement\nTDD: write tests first\nthen write code to pass them"]
        commit["Commit\n#42 Add payment webhook handler"]
    end

    subgraph review_phase ["Review Phase — /review"]
        review_cmd["/review"]
        gather["Gather Requirements\nGH Issue AC + task spec AC\n+ TDD coverage goals"]
        check["Check Against AC\n✓ Webhook endpoint created\n✓ Signature validation\n✗ Retry logic — MISSING"]
        report["Structured Report\nBlocking / Warning / Nit\nWith file:line references"]
    end

    feature_cmd --> explore
    explore --> qa
    qa --> feature_spec
    qa --> tech_design
    qa --> scope_doc

    scope_doc -- "task breakdown\nfeeds sprint" --> discuss_cmd
    tech_design -. "design context" .-> specs
    feature_spec -. "AC" .-> specs

    discuss_cmd --> sprint
    sprint --> specs
    specs --> tdd
    specs --> issues

    issues --> start_cmd
    start_cmd --> fetch
    fetch --> branch
    branch --> implement
    tdd -. "tests to write\nfirst" .-> implement
    implement --> commit

    commit --> review_cmd
    review_cmd --> gather
    specs -. "requirements" .-> gather
    issues -. "AC" .-> gather
    tdd -. "coverage goals" .-> gather
    gather --> check
    check --> report

    report -- "blocking issues\nfound" --> implement
    report -- "clean" --> merge["Merge PR\nCloses #42"]
    merge -. "update" .-> completed["COMPLETED.md\nTracks merged work"]

    style feature_phase fill:#1a202c,color:#e2e8f0,stroke:#975a16
    style feature_cmd fill:#744210,color:#e2e8f0
    style explore fill:#744210,color:#e2e8f0
    style qa fill:#744210,color:#e2e8f0
    style feature_spec fill:#744210,color:#e2e8f0
    style tech_design fill:#744210,color:#e2e8f0
    style scope_doc fill:#744210,color:#e2e8f0
    style plan fill:#1a202c,color:#e2e8f0,stroke:#553c9a
    style exec fill:#1a202c,color:#e2e8f0,stroke:#2c5282
    style review_phase fill:#1a202c,color:#e2e8f0,stroke:#9c4221
    style discuss_cmd fill:#553c9a,color:#e2e8f0
    style sprint fill:#553c9a,color:#e2e8f0
    style specs fill:#553c9a,color:#e2e8f0
    style tdd fill:#553c9a,color:#e2e8f0
    style issues fill:#553c9a,color:#e2e8f0
    style start_cmd fill:#2c5282,color:#e2e8f0
    style fetch fill:#2c5282,color:#e2e8f0
    style branch fill:#2c5282,color:#e2e8f0
    style implement fill:#276749,color:#e2e8f0
    style commit fill:#276749,color:#e2e8f0
    style review_cmd fill:#9c4221,color:#e2e8f0
    style gather fill:#9c4221,color:#e2e8f0
    style check fill:#9c4221,color:#e2e8f0
    style report fill:#9c4221,color:#e2e8f0
    style merge fill:#276749,color:#e2e8f0
    style completed fill:#276749,color:#e2e8f0
```

### How TDD integrates

When TDD is enabled, the flow is:

1. **`/discuss`** creates TDD specs alongside task specs — test categories, naming conventions, fixtures, and coverage goals are defined before any code is written.
2. **`/start`** surfaces the TDD spec as part of the task context. The agent knows which tests to write first.
3. **Implementation** follows red-green-refactor: write failing tests from the TDD spec, then write code to pass them.
4. **`/review`** checks that TDD coverage goals are met — not just "do tests exist" but "do the tests match what the spec called for."

### Task spec format

Each task spec is a machine-readable contract that commands consume:

```markdown
# 03: Implement Payment Webhook Handler

**Issue:** #42
**Complexity:** M
**Dependencies:** 01 (API framework), 02 (signature validation)

## Requirements
Receive and process payment provider webhooks...

## Acceptance Criteria
- [ ] POST /webhooks/payments endpoint exists
- [ ] Request signature validated against provider secret
- [ ] Idempotency key prevents duplicate processing
- [ ] Failed webhooks return 500 and are retried

## Files to Create/Modify
- `src/api/webhooks/payments.ts` — endpoint handler
- `src/services/payment-processor.ts` — processing logic
- `tests/api/webhooks/payments.test.ts` — endpoint tests

## API Surface
interface PaymentWebhookHandler {
  handle(request: WebhookRequest): Promise<WebhookResponse>
}
```

`/start` reads this to know what to build. `/review` reads it to check completeness. `/resume` reads it to know what's left.

## Supported Providers

| Provider | Connection | Task ID Pattern | Integration |
|----------|-----------|----------------|-------------|
| **GitHub Issues** | Repository (auto-detected from remote) | `#123` | `gh` CLI |
| **Jira** | Instance URL + Cloud ID + project key | `PROJ-123` | Atlassian MCP or CLI |
| **Linear** | Team identifier | `ENG-123` | Linear MCP or CLI |
| **Asana** | Workspace GID + project GID | `1234567890123` | Asana MCP or CLI |
| **None** | — | Free-form | Manual task descriptions |

MCP tools are preferred when available. Commands fall back to CLI tools or manual workflows when they're not.

## Installation

The bootstrap skill is a global Claude Code command. Place `bootstrap.md` in your user-level commands directory:

```
~/.claude/commands/bootstrap.md
```

Then run `/bootstrap` in any project to set up the workflow.

## Usage

```bash
# First time — set up the workflow
cd your-project
claude
> /bootstrap

# Spec out a new feature
> /feature payment processing

# Review an existing feature spec
> /feature review payment-processing

# Plan a sprint from feature specs
> /discuss next sprint

# Start a task
> /start #42
> /start next          # auto-selects lowest unstarted issue

# Resume after a break
> /resume

# Self-review before PR
> /review
```

Re-running `/bootstrap` is safe — it detects existing artifacts and updates rather than duplicates.

## Design Principles

**Sessions are disposable.** All state lives in durable stores (git, issue tracker, planning docs), never in the conversation. `/resume` reconstructs full context from these sources.

**Context is assembled, not maintained.** Each command fetches exactly what it needs from the task provider, planning docs, and codebase. Nothing goes stale because nothing is cached in-memory across sessions.

**Agents explore in parallel.** Zone agents run concurrently in the background, keeping the main context window focused on the task at hand. A 6-zone project gets explored in the wall-clock time of one zone.

**Planning artifacts are machine-readable contracts.** Sprint overviews, task specs, and TDD specs aren't just documentation — they're structured inputs that commands consume to know what to build, what to test, and when the work is done.

**Permissions default to safe.** Bootstrap configures allow-lists for non-destructive operations (read, edit, build, test) and asks before enabling anything destructive (push, reset, delete).

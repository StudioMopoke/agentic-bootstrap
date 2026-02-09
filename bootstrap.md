# Bootstrap Agentic Workflow

Set up an AI-assisted development workflow for this project. Generates `/start`, `/resume`, `/review`, and `/discuss` slash commands tailored to this codebase, plus a workflow configuration section for CLAUDE.md.

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

**Question 1:** Which task management system do you use?
- Jira
- Linear
- GitHub Issues
- Asana
- None / Other

Based on their answer, ask for connection details:

#### If Jira:
- Instance URL (e.g., `mycompany.atlassian.net`)
- Cloud ID (needed for MCP tools — they can find it at `https://{instance}/wiki/rest/api/settings/systemId` or via the Atlassian MCP `getAccessibleAtlassianResources` tool)
- Project key pattern (e.g., `PROJ`, `ENG` — the prefix before the dash in task IDs like `PROJ-1234`)
- What MCP tools are available? Check if `mcp__atlassian__` tools exist in the current environment. If not, note that task management features will use CLI tools or be manual.

#### If Linear:
- Team identifier
- Whether Linear MCP tools are available

#### If GitHub Issues:
- Repository (can be auto-detected from git remote)
- Whether `gh` CLI is available (run `which gh`)

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
- Suggest a default based on task management: `feature/{TASK_ID}-short-name`
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
3. **Check for related repos:** Ask the user if this project works alongside other repos they'd want agents to explore
4. **Discover dependencies and external domains:** Ask the user about:
   - Key external services or APIs the project talks to (e.g., REST APIs, GraphQL endpoints, third-party SDKs)
   - Internal packages or libraries it depends on that live outside this repo
   - External domains agents should be aware of when investigating issues (e.g., "auth is handled by our identity service in repo X", "we consume events from the payments service")
   - Any documentation URLs, API specs (OpenAPI/Swagger), or reference repos that would help agents understand integrations
5. **Check for existing CLAUDE.md:** Read it if present — we'll append to it rather than overwrite
6. **Check for existing .claude/commands/:** Warn if start.md, resume.md, review.md, or discuss.md already exist

Present findings to the user:
- "I found a [Go/Node/Python/etc.] project with these key directories: ..."
- "Here's the structure I see: ..."
- "External dependencies/services: ..." (summarize what they told you)

---

### Phase 4: Agent Zone Definition

This is the most important step. Define the exploration agents that `/start` and `/resume` will spawn.

Ask the user to describe the major areas of their codebase. Help them by suggesting based on Phase 3 findings.

For each zone, capture:
- **Name**: Short label (e.g., "API Surface", "Core Logic", "Tests")
- **Paths**: Which directories to explore
- **Description**: What this zone covers (1-2 sentences)
- **When to use**: Task types that should trigger this agent (e.g., "API changes", "bug investigation")
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

#### Generate `/discuss` command (always):

Always generate `.claude/commands/discuss.md` — a command for collaborative planning, sprint design, and task breakdown.

The `/discuss` command should:
1. Accept a topic, sprint name/number, or task ID as `$ARGUMENTS`. If empty, ask what they want to discuss.
2. **Gather context** — Read whatever planning docs exist (project docs, sprint overviews, backlog), check recent git history, and fetch relevant task management context.
3. **Adapt to the planning mode:**
   - **Full planning:** Help plan sprints, break work into numbered tasks with requirements/AC/files/dependencies, generate sprint directories with task specs and TDD specs, manage the backlog.
   - **Task-level:** Help think through a task's approach, update the per-task planning doc with decisions and notes.
   - **None:** Freeform discussion — help reason through architecture, approach, or scope. Optionally write notes to a scratch file if the user wants to capture decisions.
4. **Explore the codebase as needed** — Spawn exploration agents to answer questions that come up during discussion.
5. **Produce artifacts** — Write planning docs, task specs, or notes based on what was discussed. Always ask before creating files.

---

### Phase 6: Generate Commands

Now generate the files. Create each one using the Write tool.

#### 6a. Generate `start.md`

Write to `.claude/commands/start.md`. The generated command should handle:

1. **Parse argument** — Extract task identifier from `$ARGUMENTS`. Never make one up. **Include this guard in the generated `start.md`** — if `$ARGUMENTS` is empty or doesn't match the expected task ID pattern, ask the user rather than guessing.
2. **Fetch task context** — Using the configured provider, get summary, description, status, AC, priority, parent/epic, linked tasks.
3. **Guard against duplicate work** — Check `git branch -a` for existing branches. Check for existing planning docs. Suggest `/resume` if work exists.
4. **Create feature branch** — Derive short name from task summary, check for parent/epic branch, create with configured prefix and base branch.
5. **Load planning context** — Based on planning mode:
   - **Full planning:** Read the active sprint overview and find the relevant task spec if one exists. If a task spec exists in a sprint, surface its requirements, AC, files to create, and TDD specs. If no task spec exists, note that the user may want to run `/discuss` first or create one ad-hoc.
   - **Task-level:** Create a per-task planning doc with context from the task management system.
   - **None:** Skip.
6. **Spawn exploration agents** — Based on the task description and planning context, pick relevant agent zones. Run in parallel with `run_in_background: true`.
7. **Transition task status** — Mark as in-progress via configured provider.
8. **Report setup summary** — Task info, branch, planning docs found/created, running agents, suggested approach.

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

Write to `.claude/commands/discuss.md`. The generated command should handle:

1. **Parse argument** — Topic, sprint name/number, or task ID from `$ARGUMENTS`. If empty, ask what to discuss.
2. **Gather context** — Read whatever planning docs exist, check git history, fetch task management context as relevant.
3. **Adapt to planning mode:**
   - **Full planning:** Plan sprints, break work into tasks with specs and TDD, manage backlog.
   - **Task-level:** Think through a task's approach, update planning doc with decisions.
   - **None:** Freeform discussion, optionally capture notes.
4. **Explore as needed** — Spawn agents to answer codebase questions that arise.
5. **Produce artifacts** — Write planning docs, specs, or notes. Always ask before creating files.

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
   - If clean: suggest creating a PR (offer to run `/commit` if uncommitted changes exist).
   - If task management is configured: offer to add a review-complete comment to the task.

Include a note: `/review` is for pre-PR self-review. It's not a replacement for team code review, but helps catch issues before involving reviewers.

#### 6e. Update CLAUDE.md

Add a `## Workflow Configuration` section to the project's CLAUDE.md (create if it doesn't exist). This section acts as the "config" that the generated commands reference.

**Re-bootstrap handling:** Before writing, check if a `## Workflow Configuration` section already exists in CLAUDE.md. If it does, **replace** that section (from the `## Workflow Configuration` heading to the next `##` heading or end of file) rather than appending a duplicate. Warn the user that you're replacing the existing section and show a brief diff summary of what changed.

```markdown
## Workflow Configuration

### Task Management
- **Provider:** {provider}
[PROVIDER-SPECIFIC CONFIG]

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

[IF PLANNING DOCS:]
### Planning
- Task plans: `{planning_path}/{TASK_ID}.md`
```

#### 6f. Configure Permissions

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

**Ask the user whether to allow (potentially destructive):**
- `Bash(git push*)` — pushes to remote
- `Bash(git merge*)` — merging branches
- `Bash(git rebase*)` — rewriting history
- `Bash(git reset*)` — resetting state
- `Bash(git clean*)` — removing untracked files
- `Bash(rm *)` — deleting files
- `Bash(npm install*)`, `Bash(pip install*)`, `Bash(cargo add*)`, etc. — installing/modifying dependencies

Present the user with the proposed permission configuration and ask for approval before writing to `.claude/settings.json`. Explain that they can always adjust permissions later by editing the file directly.

#### 6g. Git Hygiene Setup

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

---

### Phase 7: Verify and Report

After generating all files:

1. List the files created and their paths
2. Show a quick summary of what `/start` and `/resume` will do
3. Suggest the user try `/start {EXAMPLE_TASK_ID}` to test it
4. Mention they can re-run `/bootstrap` to regenerate if needed

---

## Provider Reference

Use these patterns when generating provider-specific sections:

### Jira
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
- **Fetch task:** Use Linear MCP tools if available, or `linear` CLI
- **Task ID pattern:** `{TEAM}-\d+` (e.g., `ENG-123`)
- **Transition:** Update issue state via Linear API/MCP
- **Comment:** Add comment via Linear API/MCP
- **Branch extraction regex:** Extract `{TEAM}-\d+` from branch name

### GitHub Issues
- **Fetch task:** Use `gh issue view {NUMBER}` via Bash
- **Task ID pattern:** `#\d+` or just the number
- **Transition:** Use `gh issue close` or label changes
- **Comment:** Use `gh issue comment {NUMBER} -b "message"`
- **Branch extraction regex:** Extract number from branch name

### Asana
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

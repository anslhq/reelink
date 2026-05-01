---
name: delegation
description: Complete delegation reference for subagents and agent teams. Covers agent teams execution (setup, tools, lifecycle, spawning, messaging), subagent prompting (7-section structure, Claude 4.x principles, templates), task() parallel patterns, and verification. MUST READ before any delegation.
license: MIT
compatibility: claude-code
metadata:
  audience: orchestrating-agents
  workflow: delegation
  category: meta-prompting
  priority: critical
---

# Delegation Mastery

You are an orchestrating agent delegating work to specialized subagents or coordinating agent teams. This skill covers everything needed to execute delegation reliably.

> **Load this skill when the Delegation Analysis Gate (AGENTS.md) determines delegation is needed.**

---

## Part 1: Agent Teams Execution Reference (Claude Code)

### Enable Agent Teams

Agent teams are experimental and disabled by default. Enable by setting:

```json
// settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### Team Tools

| Tool | Purpose | Key Params |
|------|---------|------------|
| `TeamCreate` | Create team + shared task list | `team_name`, `description` |
| `TaskCreate` | Add tasks to shared list | `subject`, `description`, `activeForm` |
| `TaskUpdate` | Claim/complete/update tasks | `taskId`, `status`, `owner`, `addBlocks`, `addBlockedBy` |
| `TaskList` | View all tasks and status | — |
| `TaskGet` | Get full task details by ID | `taskId` |
| `SendMessage` | DM, broadcast, shutdown, plan approval | `type`, `recipient`, `content`, `summary` |
| `TeamDelete` | Clean up team resources | — (lead only, after all teammates shut down) |

### Team Lifecycle

```
1. TeamCreate(team_name, description)
2. TaskCreate() x N             -> populate shared task list
3. Task(team_name, name, ...) x N  -> spawn teammates
4. TaskUpdate(owner)            -> assign tasks to teammates
5. Teammates work, message each other, self-claim tasks
6. SendMessage(type: "shutdown_request") -> gracefully end teammates
7. TeamDelete()                 -> clean up (ONLY after all teammates stopped)
```

### Spawning Teammates

Teammates are spawned via the Task tool with `team_name` and `name` parameters. Each teammate is a full Claude Code instance with its own context window.

```typescript
// 1. Create the team
TeamCreate({ team_name: "auth-review", description: "Review auth module from multiple angles" })

// 2. Create tasks
TaskCreate({ subject: "Review security implications", description: "...", activeForm: "Reviewing security" })
TaskCreate({ subject: "Check performance impact", description: "...", activeForm: "Checking performance" })
TaskCreate({ subject: "Validate test coverage", description: "...", activeForm: "Validating tests" })

// 3. Spawn teammates (each gets full project context: CLAUDE.md, MCP servers, skills)
Task({ team_name: "auth-review", name: "security-reviewer", subagent_type: "general-purpose",
  prompt: "You are the security reviewer. Check src/auth/ for vulnerabilities. Focus on token handling, session management, and input validation. The app uses JWT tokens stored in httpOnly cookies. Report any issues with severity ratings." })
Task({ team_name: "auth-review", name: "perf-reviewer", subagent_type: "general-purpose",
  prompt: "You are the performance reviewer. Profile src/auth/ for bottlenecks and scaling issues." })
Task({ team_name: "auth-review", name: "test-reviewer", subagent_type: "general-purpose",
  prompt: "You are the test coverage reviewer. Validate tests/ completeness for the auth module." })
```

**Teammates do NOT inherit the lead's conversation history.** Include ALL task-specific context in the spawn prompt — file paths, constraints, what you've discovered, architectural decisions.

### Messaging

```typescript
// DM a specific teammate (use their NAME, not agent ID)
SendMessage({ type: "message", recipient: "security-reviewer",
  content: "Focus on the JWT token handling in auth/tokens.ts",
  summary: "Redirect to JWT tokens" })

// Broadcast to ALL (USE SPARINGLY - costs scale linearly with team size)
SendMessage({ type: "broadcast",
  content: "Stop all work - blocking bug found in shared module",
  summary: "Critical blocking issue" })

// Request graceful shutdown
SendMessage({ type: "shutdown_request", recipient: "security-reviewer",
  content: "Your review is complete, please wrap up" })

// Respond to shutdown (as teammate)
SendMessage({ type: "shutdown_response", request_id: "abc-123", approve: true })

// Approve a teammate's plan (when plan approval is required)
SendMessage({ type: "plan_approval_response", request_id: "abc-123",
  recipient: "security-reviewer", approve: true })
// Reject with feedback:
SendMessage({ type: "plan_approval_response", request_id: "abc-123",
  recipient: "security-reviewer", approve: false,
  content: "Please add error handling for the API calls" })
```

**Message delivery is automatic.** Messages from teammates arrive without polling.
**Idle is normal.** Teammates go idle after each turn — this just means they're waiting for input. Sending a message wakes them up.

### Display Modes

- **in-process** (default): All teammates in main terminal. Shift+Up/Down to select teammate. Enter to view session, Escape to interrupt, Ctrl+T for task list.
- **split-pane**: Each teammate gets own pane. Requires tmux or iTerm2 with `it2` CLI.

Configure in settings.json:
```json
{ "teammateMode": "in-process" }
```
Or per-session: `claude --teammate-mode in-process`

### Delegate Mode

Press **Shift+Tab** to enter delegate mode. Lead is restricted to coordination-only tools:
- Spawning, messaging, shutting down teammates
- Managing tasks (create, assign, update)
- NO direct file editing or bash commands

Use when you want the lead to purely orchestrate without touching code.

### Plan Approval for Teammates

For risky tasks, require teammates to plan before implementing:

```
Spawn an architect teammate to refactor the auth module.
Require plan approval before they make any changes.
```

The teammate works in read-only plan mode until the lead approves. If rejected, the teammate revises and resubmits. Give the lead criteria: "only approve plans that include test coverage."

### Task Coordination

The shared task list coordinates work across the team:
- **Lead assigns**: tell the lead which task to give to which teammate
- **Self-claim**: after finishing, a teammate picks up the next unassigned, unblocked task
- **Dependencies**: tasks can depend on other tasks via `addBlocks`/`addBlockedBy` — blocked tasks auto-unblock when dependencies complete
- **File locking**: task claiming uses file locking to prevent race conditions

Prefer 5-6 tasks per teammate to keep everyone productive and allow reassignment if someone gets stuck.

### Team Storage

Teams and tasks are stored locally:
- Team config: `~/.claude/teams/{team-name}/config.json`
- Task list: `~/.claude/tasks/{team-name}/`

Teammates can read the team config to discover other members (name, agentId, agentType).

### Best Practices

| Practice | Why |
|----------|-----|
| Give teammates full context in spawn prompt | They don't inherit lead's conversation history |
| Each teammate owns different files | Avoid overwrite conflicts |
| 5-6 tasks per teammate | Keeps everyone productive, allows reassignment |
| Use plan approval for risky changes | Teammate plans before implementing |
| Use delegate mode for pure orchestration | Prevents lead from implementing instead of delegating |
| Monitor and steer periodically | Don't let teams run unattended too long |
| Start with research/review tasks | Lower risk than parallel implementation |
| Shut down all teammates before TeamDelete | Cleanup fails with active members |
| Pre-approve common permissions | Reduces permission prompt interruptions |

### Anti-Patterns

| Anti-Pattern | Why Wrong | Do Instead |
|---|---|---|
| Two teammates editing same file | Overwrites | Each owns separate files |
| Using teams for sequential tasks | Overhead exceeds benefit | Single session or subagents |
| Lead implementing instead of delegating | Defeats team purpose | Use delegate mode (Shift+Tab) |
| Broadcasting for single-recipient messages | Token waste (N messages sent) | Use DM with `type: "message"` |
| Letting team run unattended | Wasted effort on wrong approaches | Monitor and steer |
| Teams for simple grep/search | Massive overhead for trivial work | Use subagents or direct tools |

### Limitations

- **No session resumption**: `/resume` and `/rewind` don't restore in-process teammates
- **One team per session**: clean up current team before starting a new one
- **No nested teams**: teammates cannot spawn their own teams
- **Lead is fixed**: can't promote a teammate to lead or transfer leadership
- **Permissions at spawn**: all teammates inherit lead's permission mode; can change individually after
- **Higher token cost**: each teammate is a separate Claude instance
- **Split panes**: require tmux or iTerm2 (not supported in VS Code terminal, Windows Terminal, or Ghostty)

### Troubleshooting

**Teammates not appearing:**
- In in-process mode, press Shift+Down to cycle through active teammates
- Check that the task was complex enough to warrant a team
- For split panes, ensure tmux is installed: `which tmux`
- For iTerm2, verify `it2` CLI is installed and Python API is enabled

**Too many permission prompts:**
Pre-approve common operations in permission settings before spawning teammates.

**Teammates stopping on errors:**
Check their output (Shift+Up/Down in in-process, click pane in split mode), then give additional instructions or spawn a replacement.

**Lead shuts down before work is done:**
Tell it to keep going. Use "Wait for your teammates to complete their tasks before proceeding."

**Orphaned tmux sessions:**
```bash
tmux ls
tmux kill-session -t <session-name>
```

### Use Case Examples

**Parallel code review:**
```
Create an agent team to review PR #142. Spawn three reviewers:
- One focused on security implications
- One checking performance impact
- One validating test coverage
Have them each review and report findings.
```

**Competing hypotheses debugging:**
```
Users report the app exits after one message instead of staying connected.
Spawn 5 agent teammates to investigate different hypotheses. Have them talk to
each other to try to disprove each other's theories, like a scientific
debate. Update the findings doc with whatever consensus emerges.
```

### Hooks

- **`TeammateIdle`**: runs when a teammate is about to go idle. Exit with code 2 to send feedback and keep the teammate working.
- **`TaskCompleted`**: runs when a task is being marked complete. Exit with code 2 to prevent completion and send feedback.

---

## Part 2: Subagent Prompting — Core Principles (Anthropic Guidelines)

> **These principles apply to ALL subagent prompts — whether using task() or spawning teammates.**

### Principle 1: Be Explicit With Instructions

Claude 4.x models respond well to clear, explicit instructions. The "above and beyond" behavior from previous models must be **explicitly requested**.

| Less Effective | More Effective |
|----------------|----------------|
| "Create an analytics dashboard" | "Create an analytics dashboard. Include as many relevant features and interactions as possible. Go beyond the basics to create a fully-featured implementation." |
| "Fix the bug" | "Fix the null pointer exception in UserService.getById() when user not found. Implement proper error handling that returns a typed Result<User, NotFoundError>." |

### Principle 2: Add Context to Improve Performance

Providing **motivation and reasoning** behind instructions helps Claude understand your goals.

| Less Effective | More Effective |
|----------------|----------------|
| "NEVER use ellipses" | "Your response will be read aloud by a text-to-speech engine, so never use ellipses since the TTS engine won't know how to pronounce them." |
| "Don't modify existing tests" | "Don't modify existing tests because they represent verified behavior that other teams depend on. Changing them could mask regressions." |

**Claude generalizes from explanations** — give the "why" and it will apply the principle correctly.

### Principle 3: Be Vigilant With Examples & Details

Claude 4.x models pay **close attention** to details and examples. Ensure your examples:
- Align with behaviors you want to encourage
- Minimize behaviors you want to avoid
- Are complete and correct (Claude will follow them precisely)

### Principle 4: Tool Usage Requires Explicit Direction

If you say "can you suggest some changes," it will **suggest** rather than **implement**.

| Less Effective (suggests only) | More Effective (takes action) |
|--------------------------------|-------------------------------|
| "Can you suggest some changes?" | "Change this function to improve its performance." |
| "How would you refactor this?" | "Refactor this code to use the repository pattern." |

### Principle 5: Communication Style

Claude 4.x models are more direct and concise. If you want progress updates:
```
After completing a task that involves tool use, provide a quick summary of the work you've done.
```

### Principle 6: Parallel Tool Calling

Claude 4.x excels at parallel execution. Add to prompts:
```
If you intend to call multiple tools and there are no dependencies between the calls,
make all independent calls in parallel. Never use placeholders or guess missing parameters.
```

### Principle 7: Avoid Overengineering

Claude Opus tends to overengineer. Add to prompts:
```
Avoid over-engineering. Only make changes that are directly requested or clearly necessary.
Don't add features, refactor code, or make "improvements" beyond what was asked.
Don't create helpers, utilities, or abstractions for one-time operations.
Don't design for hypothetical future requirements.
The right amount of complexity is the minimum needed for the current task.
```

### Principle 8: Encourage Code Exploration

```
ALWAYS read and understand relevant files before proposing code edits.
Do not speculate about code you have not inspected.
Be rigorous and persistent in searching code for key facts.
```

### Principle 9: Minimize Hallucinations

```
Never speculate about code you have not opened.
If the user references a specific file, you MUST read the file before answering.
Give grounded, hallucination-free answers.
```

### Principle 10: Thinking After Tool Use

```
After receiving tool results, carefully reflect on their quality and determine optimal
next steps before proceeding.
```

---

## Part 3: The 7-Section Prompt Structure (MANDATORY)

Every delegation prompt MUST include all 7 sections. Incomplete prompts produce incomplete results.

```
1. TASK: [Single atomic goal - one action per delegation]
2. EXPECTED OUTCOME: [Concrete deliverables with success criteria]
3. REQUIRED SKILLS: [Which capability to invoke]
4. REQUIRED TOOLS: [Explicit tool whitelist - prevents tool sprawl]
5. MUST DO: [Exhaustive requirements - leave NOTHING implicit]
6. MUST NOT DO: [Forbidden actions - anticipate and block rogue behavior]
7. CONTEXT: [File paths, existing patterns, constraints, discoveries]
```

### Section 1: TASK (Required)

Single, atomic, unambiguous action. If you need "and", split into multiple delegations.

- "Implement X" (will implement)
- "Create X" (will create)
- NOT "Can you suggest..." (will only suggest)

### Section 2: EXPECTED OUTCOME (Required)

```markdown
EXPECTED OUTCOME:
- Modified files: src/auth/jwt.service.ts, src/auth/auth.controller.ts
- New file: src/auth/jwt.guard.ts
- All endpoints under /api/protected/* require valid JWT
- Tests pass: npm run test:auth
- lsp_diagnostics shows no errors on changed files
```

### Section 3: REQUIRED SKILLS (Required)

Name the specific capability: `TypeScript backend development with NestJS`, `React component design with Tailwind CSS`, etc.

### Section 4: REQUIRED TOOLS (Required)

Explicitly whitelist tools. Unrestricted agents may spawn sub-subagents, use web search when they should read local files, or waste tokens exploring irrelevantly.

```markdown
REQUIRED TOOLS:
- Read: For examining existing code
- Edit: For modifying files
- Write: For creating new files
- Bash: For running tests
- Grep: For finding usage patterns
```

### Section 5: MUST DO (Required)

Exhaustive list. **Assume the subagent will do ONLY what's listed here.** Include motivation for important requirements:

```markdown
MUST DO:
- Follow existing code patterns in src/auth/ directory (consistency with codebase)
- Use the existing Logger service for all logging (centralized observability)
- Validate all input parameters (security best practice)
- Run lsp_diagnostics on all changed files before completing (verification)
- Provide a brief summary of changes made (visibility)
```

### Section 6: MUST NOT DO (Required)

Anticipate and block rogue behavior. Prevent overengineering:

```markdown
MUST NOT DO:
- Do NOT modify files outside src/auth/ directory
- Do NOT add new dependencies without explicit approval
- Do NOT add features beyond what was requested
- Do NOT refactor surrounding code "while you're there"
- Do NOT create helper utilities for one-time operations
```

### Section 7: CONTEXT (Required)

Everything discovered. The subagent starts with zero context:

```markdown
CONTEXT:
### Reference Files (MUST READ BEFORE IMPLEMENTING)
- /absolute/path/to/src/auth/local.strategy.ts (existing auth pattern)
- /absolute/path/to/src/config/jwt.config.ts (JWT configuration)

### What I Already Tried (DON'T REPEAT)
1. Adding @Injectable() to the guard - didn't fix the DI error
```

---

## Part 4: Agent-Specific Templates

### Template A: Implementation Agents

For: general-purpose, backend-architect, frontend-specialist, etc.

```markdown
## TASK
[Single atomic implementation goal]

## EXPECTED OUTCOME
- Files created: [absolute paths]
- Files modified: [absolute paths]
- Tests: [what should pass]
- Verification: lsp_diagnostics clean

## REQUIRED SKILLS
[Specific technical domain]

## REQUIRED TOOLS
Read, Edit, Write, Bash (for tests)

## MUST DO
- [ ] Read [reference files] BEFORE implementing
- [ ] Follow patterns in [reference file]
- [ ] Run lsp_diagnostics before completing
- [ ] Provide brief summary of changes

## MUST NOT DO
- Modify files outside [scope]
- Add features beyond what was requested
- Create unnecessary abstractions

## CONTEXT
[Project setup, existing patterns, file paths]
```

### Template B: Research Agents

For: scout, explore

```markdown
## TASK
Find [specific information/pattern/implementation]

## EXPECTED OUTCOME
- File paths (ABSOLUTE, not relative)
- Relevant code snippets with line numbers
- Summary of how the pattern works

## REQUIRED SKILLS
Codebase navigation and pattern recognition

## REQUIRED TOOLS
Read, Grep, Glob, LSP tools

## MUST DO
- Search exhaustively (multiple angles, parallel searches)
- Verify findings by reading actual files
- Return ABSOLUTE file paths only

## MUST NOT DO
- Modify any files
- Make assumptions without evidence
- Stop at first result (be thorough)

## CONTEXT
[What you're trying to accomplish, why you need this]
```

### Template C: Advisory Agents

For: oracle, architect

```markdown
## TASK
Advise on [specific decision]

## EXPECTED OUTCOME
- Clear recommendation with rationale
- Trade-offs analysis (pros/cons)
- Specific action steps

## REQUIRED SKILLS
System architecture and engineering judgment

## REQUIRED TOOLS
Read (for reviewing code)

## MUST DO
- Read relevant code before making recommendations
- Provide actionable steps, not abstract advice
- Flag concerns or risks

## MUST NOT DO
- Implement changes (advisory only)
- Ignore existing patterns without justification

## CONTEXT
[Full context of the decision, constraints]
```

---

## Part 5: Parallel Execution & Coordination

### Native task() Parallel (USE THIS MOST)

Multiple `task` calls in ONE response run in parallel automatically:

```typescript
// ONE response, THREE parallel tasks - ALL run simultaneously
task({ subagent_type: "scout", description: "Find auth", prompt: "..." })
task({ subagent_type: "scout", description: "Find logging", prompt: "..." })
task({ subagent_type: "scout", description: "Find docs", prompt: "..." })
// Parent waits for ALL to complete, then continues with all results
```

```
┌─────────────────────────────────────────────────────┐
│                   LLM Response                       │
│  task(A)         task(B)         task(C)            │
└───────┬──────────────┬──────────────┬───────────────┘
        │              │              │
        ▼              ▼              ▼
   [Agent 1]      [Agent 2]      [Agent 3]  <- PARALLEL
        │              │              │
        └──────────────┼──────────────┘
                       ▼
              All complete → Continue
```

### Phase-Based Execution Pattern

```
PHASE 1: Setup (3 independent tasks)
├── task: "Create database schema"
├── task: "Set up authentication config"    } Run all 3 in parallel
└── task: "Initialize logging infrastructure"
    ↓
[Wait for all Phase 1 tasks to complete]
    ↓
PHASE 2: Core Services (4 independent tasks)
├── task: "Implement UserService"
├── task: "Implement ProductService"        } Run all 4 in parallel
├── task: "Implement OrderService"
└── task: "Implement PaymentService"
    ↓
[Wait for all Phase 2 tasks to complete]
    ↓
PHASE 3: Integration
├── task: "Wire services together"
└── task: "Add API routes"
```

### Parallel Rules

1. **Non-overlapping scopes**: Each agent works on different files
2. **No dependencies**: Results don't depend on each other
3. **Clear boundaries**: MUST NOT DO sections prevent conflicts

### The Atomic Delegation Rule (NON-NEGOTIABLE)

Each subagent call MUST have ONE specific task. Never combine unrelated work.

```typescript
// WRONG: Monolithic
task({ prompt: "Fix auth, add logging, refactor utils, update tests" })

// CORRECT: Atomic
task({ prompt: "Fix JWT validation in auth/validate.ts" })
task({ prompt: "Add structured logging to auth module" })
task({ prompt: "Refactor string utils in lib/string.ts" })
task({ prompt: "Update auth tests for new validation" })
```

---

## Part 6: Long-Horizon & Multi-Context Workflows

For tasks spanning multiple context windows:

### State Management

```markdown
STATE MANAGEMENT REQUIREMENTS:
- Use structured formats (JSON) for test results and task status
- Use unstructured text for progress notes
- Use git for checkpoints and state tracking

Example state file (tests.json):
{
  "tests": [
    {"id": 1, "name": "auth_flow", "status": "passing"},
    {"id": 2, "name": "user_mgmt", "status": "failing"}
  ],
  "total": 50, "passing": 45, "failing": 5
}
```

### Context Continuation Directive

```markdown
CONTEXT CONTINUATION:
Your context window will be automatically compacted as it approaches its limit.
- Do NOT stop tasks early due to token budget concerns
- Save current progress and state to memory before context refreshes
- Be as persistent and autonomous as possible
- Complete tasks fully, even if approaching budget limit
```

---

## Part 7: Verification Protocol (MANDATORY)

After receiving subagent results or teammate completion, ALWAYS verify:

| Check | How | Why |
|-------|-----|-----|
| Files exist | `glob` or `read` the created/modified files | Confirm work was done |
| Code compiles | `lsp_diagnostics` on changed files | Catch type errors |
| Tests pass | `bash` to run test command | Verify functionality |
| Patterns followed | Compare against reference files | Consistency |
| No rogue changes | `git diff` to see all modifications | Scope creep detection |
| Requirements met | Cross-check against EXPECTED OUTCOME | Completeness |
| No overengineering | Review for unnecessary abstractions | Prevent bloat |

### Post-Delegation Verification Prompt

```markdown
VERIFY THE SUBAGENT'S WORK:
1. Read the modified files to confirm changes match requirements
2. Run lsp_diagnostics on each changed file
3. Run tests if applicable
4. Check git diff for unexpected changes or scope creep
5. Confirm all EXPECTED OUTCOME items are satisfied
6. Check for overengineering (unnecessary files, abstractions, features)
7. If issues found, provide specific feedback for correction
```

**Never assume subagent success.** Trust but verify.

---

## Part 8: Anti-Patterns (NEVER DO)

### 1. Vague Task Descriptions
```markdown
# BAD
TASK: Make the UI better

# GOOD
TASK: Redesign the UserProfile component with avatar upload capability,
editable name/email fields with inline validation, and a save button
that shows loading state during API call.
```

### 2. Missing Context / No "Why"
```markdown
# BAD
TASK: Add caching to the API

# GOOD
TASK: Add Redis caching to ProductService.getAll()
CONTEXT:
- Redis is already configured in src/config/redis.config.ts
- Cache key pattern: `products:category:{categoryId}` (matches team convention)
- TTL: 5 minutes (balances freshness vs DB load)
```

### 3. Implicit Expectations
```markdown
# BAD
MUST DO: Implement the feature

# GOOD
MUST DO:
- Create ProductCache service in src/cache/product.cache.ts
- Add cache check before database query (performance optimization)
- Add cache invalidation in mutation methods (data consistency)
- Log cache hits/misses at debug level (observability)
```

### 4. No Boundaries (Invites Overengineering)
```markdown
# BAD
MUST NOT DO: (empty)

# GOOD
MUST NOT DO:
- Modify any files outside src/products/
- Add new npm dependencies
- Create abstractions for one-time operations
- Add features not explicitly requested
```

### 5. Suggestion Instead of Action
```markdown
# BAD (Claude will only suggest)
TASK: Can you suggest how to improve the auth flow?

# GOOD (Claude will implement)
TASK: Improve the auth flow by adding refresh token rotation.
```

### 6. No Tool Restrictions
```markdown
# BAD
REQUIRED TOOLS: Any tools needed

# GOOD
REQUIRED TOOLS:
- Read: examine existing code
- Edit: modify ProductService
- Write: create ProductCache
- Bash: run tests
```

### 7. No Verification Requirement
```markdown
# BAD
MUST DO: Implement the feature. Done!

# GOOD
MUST DO:
- Implement the feature
- Run lsp_diagnostics on all changed files
- Run npm test and verify all tests pass
- Provide summary of changes made
```

---

## Part 9: Quick Reference Checklist

Before sending a prompt to a subagent, verify:

**Structure:**
- [ ] Is the TASK a single atomic action?
- [ ] Is the TASK explicit about action (implement/create/fix) vs suggestion?
- [ ] Does EXPECTED OUTCOME define "done" concretely?
- [ ] Are REQUIRED TOOLS explicitly listed?
- [ ] Does MUST DO cover ALL requirements (nothing implicit)?
- [ ] Does MUST DO include reasoning for important requirements?
- [ ] Does MUST NOT DO block overengineering?
- [ ] Does CONTEXT include all discovered information?

**Anthropic Guidelines:**
- [ ] Am I being explicit rather than vague?
- [ ] Have I added context/reasoning for instructions?
- [ ] Have I requested action explicitly (not just suggestions)?
- [ ] Have I included parallel execution directive if applicable?
- [ ] Have I added anti-overengineering instructions?
- [ ] Have I required code exploration before implementation?
- [ ] Have I required verification (lsp_diagnostics, tests)?

**Paths & Files:**
- [ ] Are all file paths ABSOLUTE?
- [ ] Have I included reference files for patterns?
- [ ] Have I specified which files the agent CAN and CANNOT modify?

---

## Part 10: Complete Example Prompt

```markdown
## TASK
Implement JWT authentication middleware for the Express API.
Create the middleware and apply it to protected routes.

## EXPECTED OUTCOME
- New file: /Users/dev/project/src/middleware/auth.middleware.ts
- Modified: /Users/dev/project/src/app.ts (add middleware import)
- Modified: /Users/dev/project/src/routes/protected.routes.ts (apply guard)
- All /api/protected/* routes require valid JWT
- Invalid tokens return 401: { "error": "Unauthorized", "code": "INVALID_TOKEN" }
- Token payload type: { userId: string, email: string, roles: string[] }
- Tests pass: npm run test:auth
- lsp_diagnostics shows no errors on changed files

## REQUIRED SKILLS
Node.js/Express middleware development, JWT handling, TypeScript

## REQUIRED TOOLS
- Read: examine existing middleware patterns (MUST read before implementing)
- Write: create new middleware file
- Edit: modify app.ts and routes
- Bash: run tests

## MUST DO
- READ /Users/dev/project/src/middleware/logging.middleware.ts BEFORE implementing
  (this is the canonical pattern — understanding it prevents errors)
- Use jsonwebtoken library (already installed, don't add dependencies)
- Get JWT_SECRET from process.env (validated at startup in env.ts)
- Add proper TypeScript types for decoded token (type safety is critical)
- Handle all error cases: missing token, malformed token, expired token, invalid signature
- Log authentication failures at 'warn' level (security observability)
- Run lsp_diagnostics on all created/modified files before completing
- Verify tests pass: npm run test:auth
- Provide brief summary of implementation decisions

## MUST NOT DO
- Add new npm dependencies (use existing jsonwebtoken)
- Modify existing route handlers (only wrap with middleware)
- Store tokens or create sessions (stateless auth pattern)
- Suppress TypeScript errors with 'any' or '@ts-ignore'
- Add features beyond what was requested
- Create abstractions for "future flexibility"
- Refactor existing middleware code

## CONTEXT
### Project Setup
- Express 4.x API with TypeScript strict mode
- Existing auth: Basic auth in src/middleware/basic-auth.middleware.ts (DEPRECATED - don't follow)
- Logging: Use Logger from src/utils/logger.ts
- Config: Environment variables loaded in src/config/env.ts

### Reference Files (READ THESE FIRST)
- /Users/dev/project/src/middleware/logging.middleware.ts (canonical middleware pattern)
- /Users/dev/project/src/middleware/error.middleware.ts (error handling pattern)

### Parallel Execution
If reading multiple files, read them in parallel.
```

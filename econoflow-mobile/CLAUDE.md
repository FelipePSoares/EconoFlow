@AGENTS.md

---

## Claude Code — Step 4 override

When running inside Claude Code, replace the architecture self-review checklist in
Step 4 with the **`codereview` subagent gate**:

1. Once tests, typecheck, and lint are all green, spawn the `codereview` subagent
   (defined in `.claude/agents/codereview.md`).
   - It runs in a **fresh, isolated context** — it has no knowledge of your
     implementation, which makes the review objective.
2. Read the report it returns.
3. Fix **every item listed under "Action Items"** — these are blocking.
4. Re-run the relevant tests after each fix to confirm nothing regressed.
5. Spawn `codereview` again — repeat until the report shows **no Action Items**.

**The task is not complete until the codereview report has no Action Items.**
Do not respond as if the work is done before reaching this state.

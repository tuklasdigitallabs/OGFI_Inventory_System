# AGENTS.md — Codex Project Rules

## Core Principle

You are working inside an existing codebase. Your job is to make the smallest correct change that solves the user's request.

Do not overbuild. Do not silently assume. Do not refactor unrelated code. Do not hide uncertainty.

Every changed line must be traceable to the requested task.

---

## 1. Understand Before Editing

Before changing code:

- Read the relevant files first.
- Identify the existing pattern before adding anything new.
- State assumptions when they affect implementation.
- If the request has multiple valid interpretations, briefly list them.
- If the request is unclear enough that implementation could go in the wrong direction, ask before editing.
- If a simpler solution exists, choose it unless there is a clear reason not to.

Do not guess how the system works when the answer is available in the code.

---

## 2. Define Success Criteria

Convert the user's request into a verifiable goal.

Examples:

- "Fix this bug" means reproduce the bug, patch it, then verify the bug is gone.
- "Add validation" means invalid inputs are blocked and valid inputs still work.
- "Update UI" means the visible behavior matches the requested change without breaking the existing layout.
- "Refactor" means behavior remains the same before and after.

For multi-step work, use this format:

```md
Plan:
1. Inspect [files/feature] -> verify: identify current behavior.
2. Change [specific area] -> verify: run/build/check affected path.
3. Test [specific scenario] -> verify: expected result is observed.
```

Keep plans short. Do not create a plan for trivial one-line fixes.

---

## 3. Simplicity First

Write the minimum code required.

Avoid:

- New abstractions for one-time logic.
- New configuration unless requested.
- New dependencies unless clearly necessary.
- Generic utilities unless reused immediately.
- Defensive handling for impossible states.
- Large rewrites when a small patch works.

Before finalizing, ask:

> Could this have been solved with fewer changed lines?

If yes, simplify.

---

## 4. Surgical Changes Only

Touch only the files and lines needed for the task.

Rules:

- Do not reformat unrelated code.
- Do not rename things unless required.
- Do not clean up nearby code.
- Do not change existing architecture without explicit need.
- Match the project's current style, even if another style is better.
- If unrelated dead code is found, mention it instead of deleting it.

When your own changes create unused imports, variables, functions, or files, remove them.

The test:

> Every changed line must directly support the requested outcome.

---

## 5. Respect Existing Project Conventions

Before adding code, check how the project already does the same thing.

Follow existing conventions for:

- File structure
- Naming
- Routing
- State management
- Error handling
- API responses
- UI spacing
- Styling
- Logging
- Tests
- Environment variables

Do not introduce a second pattern unless the current one is clearly wrong and the task requires changing it.

---

## 6. Project UI Rule

For UI work, preserve consistent spacing.

Use one shared spacing token when the project has one, such as:

```css
--gap: 16px;
```

Avoid one-off spacing values that create uneven layouts unless the existing project style already requires them.

---

## 7. Verify Before Claiming Success

After editing, run the most relevant checks available.

Prefer targeted checks first. Use the project's actual scripts. Do not invent commands.

Common examples:

```bash
npm test
npm run build
npm run lint
npm run typecheck
pytest
go test ./...
cargo test
```

If checks cannot be run, say why.

Never say "done" unless at least one of these is true:

- Tests passed.
- Build passed.
- Lint/typecheck passed.
- The exact affected flow was manually verified.
- You clearly state that verification could not be completed.

---

## 8. Do Not Mask Failures

If something fails:

- Show the failing command.
- Summarize the relevant error.
- Explain whether the failure is caused by your change or pre-existing.
- Fix it if it is caused by your change.
- Do not claim success while checks are failing.

Do not hide uncertainty behind confident wording.

---

## 9. Preserve Behavior Unless Asked

Do not change existing behavior unless the user asked for it.

Examples:

- Do not alter API response shape unless required.
- Do not change database schema unless required.
- Do not change styling globally for a local UI request.
- Do not change authentication/session logic unless the task touches it.
- Do not change business rules just because they look incomplete.

If a behavior looks wrong but is unrelated, mention it separately.

---

## 10. Tests Are Part of the Fix

When practical, add or update tests for the changed behavior.

For bugs:

1. Add or identify a test that fails before the fix.
2. Make the smallest code change.
3. Confirm the test passes.

For UI or integration tasks where automated tests are not practical, provide a manual verification checklist.

After each phase implementation, update `PHASE_TEST_INSTRUCTIONS.md` with the phase scope, validation flows, expected results, and known limitations.

---

## 11. Ask Before Risky Changes

Ask before doing any of the following unless explicitly requested:

- Database migrations
- Dependency upgrades
- Authentication changes
- Payment logic changes
- Production config changes
- Deleting files
- Rewriting major modules
- Changing public API contracts
- Changing deployment scripts
- Adding background jobs or scheduled tasks

---

## 12. Final Response Format

When finished, respond with:

```md
Summary:
- What changed
- Where it changed

Verification:
- Command/check run
- Result

Notes:
- Any limitations, assumptions, or follow-up risks
```

Keep it concise. Do not paste large code blocks unless asked.

# Prompt Log

Every change to `SYSTEM_PROMPT` in `api/analyze.js` gets a new `PROMPT_VERSION` and a row here.
The version is shown under the results in the UI, so each test result can be traced to a prompt.

| Version | Date | Change | Why | Test evidence |
|---------|------|--------|-----|---------------|
| v0 | 2026-10 | Starter prompt: "expert career coach", 5 flat fields, free-text JSON parsed with a regex. | Provided starter. | Key was exposed in the browser; no matched keywords, projects, or structured improvements; JSON could break. |
| v1 | 2026-10-29 | Rewrote as ROLE + TASK (4-step procedure) + SCORING rubric (40/25/15/10/10) with calibration bands + FORMAT (per-field rules) + RULES + one few-shot example. Moved to `systemInstruction` with a `responseSchema` (7 fields, structured `improvements`). Resume/JD wrapped in `<resume>`/`<job_description>` tags and marked as untrusted. | A rubric with calibration gives realistic, explainable scores instead of a gut number. The explicit "search the resume for variants" step and the "never in both lists" rule target false missing keywords. Requiring quoted evidence and a pasteable `example` per improvement blocks generic advice. Schema guarantees parseable JSON. Tags + rule defend against prompt injection. | Baseline — run TEST_PLAN.md and fill in the results log. |

## Model and config changes

These don't change the prompt text, so `PROMPT_VERSION` stays the same. The response's `model` field records which model answered, so results stay traceable.

| Date | Prompt | Change | Why | Evidence |
|------|--------|--------|-----|----------|
| 2026-10-30 | v1 | Default model `gemini-2.5-flash` → `gemini-3.5-flash`, with a one-time fallback to `gemini-3.1-flash-lite` on 503/429/404. Thinking setting changed from `thinkingBudget: 2048` (2.5 only) to `thinkingLevel: "low"` (Gemini 3). Added a 45 s Gemini timeout and `[analyze]` log lines. | The live app failed: `gemini-2.5-flash` returns 404 "no longer available to new users" for this key. 3.5-flash is a stable dated release (`3.5-flash-05-2026`), not a preview or a `-latest` alias. It also had frequent 503 "high demand" errors, which is why the fallback exists. | Probe with this key: 3.5-flash 200 with schema + JSON + both thinking settings. 3.1-flash-lite 200. 2.5-flash and 2.5-flash-lite 404. flash-latest 503 and 3.8-flash 503/timeouts. E2E R1 vs JD-A: score 62 twice (expected 55–70), answered by the fallback after a 503. |

## Observed in v1 (candidates for v2)

- **Invented facts in `example`** (R1 vs JD-A, 2026-10-30, 3.1-flash-lite): the rewrite examples added "evaluated using MAE and RMSE" and "optimizing database queries (MySQL)", which aren't in the resume. That breaks the "use ONLY facts from the resume" rule. Possible v2 fix: if the fix needs something the candidate hasn't done, the example must say "if true:" or use a `[placeholder]`, plus a contrasting bad/good pair in the few-shot.
- Re-check this on `gemini-3.5-flash` once it isn't returning 503, since the lite model may follow rules less strictly.

## How to iterate

1. Run the test matrix in `TEST_PLAN.md` and fill in the results log.
2. Pick the **one** most common failure (e.g. scores too high, a generic improvement, present keywords listed as missing).
3. Make **one** targeted change to `SYSTEM_PROMPT`. Changing several things at once means you can't tell which one helped.
4. Bump `PROMPT_VERSION` (v1 → v2), add a row above with the date, the exact change, why, and which test showed the problem.
5. Re-run the tests that failed **and** a couple that passed, to make sure you didn't break them.

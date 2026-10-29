# Prompt Log

Every change to `SYSTEM_PROMPT` in `api/analyze.js` gets a new `PROMPT_VERSION` and a row here.
The version is shown under the results in the UI, so each test result can be traced to a prompt.

| Version | Date | Change | Why | Test evidence |
|---------|------|--------|-----|---------------|
| v0 | 2026-10 | Starter prompt: "expert career coach", 5 flat fields, free-text JSON parsed with a regex. | Provided starter. | Key was exposed in the browser; no matched keywords, projects, or structured improvements; JSON could break. |
| v1 | 2026-10-29 | Rewrote as ROLE + TASK (4-step procedure) + SCORING rubric (40/25/15/10/10) with calibration bands + FORMAT (per-field rules) + RULES + one few-shot example. Moved to `systemInstruction` with a `responseSchema` (7 fields, structured `improvements`). Resume/JD wrapped in `<resume>`/`<job_description>` tags and marked as untrusted. | A rubric with calibration gives realistic, explainable scores instead of a gut number. The explicit "search the resume for variants" step and the "never in both lists" rule target false missing keywords. Requiring quoted evidence and a pasteable `example` per improvement blocks generic advice. Schema guarantees parseable JSON. Tags + rule defend against prompt injection. | Baseline — run TEST_PLAN.md and fill in the results log. |
| v2 | 2026-10-29 | (1) Replaced the `example` rule with: "In every example, use ONLY facts present in the resume. Never add tools, tasks, or results the candidate did not state — not even in a Skills line. For anything missing, use a placeholder like [X%], [N users], or [tool you actually used]. If no honest rewrite is possible, only reword what is already there." (2) New keyword rule: lists hold only skills, tools, technologies, and certifications, never degrees/majors/education. (3) Fixed the few-shot example, which itself invented facts ("5 KPIs", "to adjust staffing"); it now uses `[decision it informed]` and `[N hours]` placeholders. | v1 examples invented facts. For R1, the live app said "managed MySQL query optimizations" (the resume only says "Fixed bugs in a PHP admin panel") and added "FastAPI" and "Docker (Basic)" to Skills. "IT degree" also showed up as a matched keyword. The few-shot was demonstrating the very behaviour we wanted to stop, so it had to change too. | **Education in keyword lists: fixed** (0 in 9 runs). **Scores: all in range** (9/9). **Invented facts: reduced but not fixed.** R1: v1 had 2 inventions in each of 2 runs (Skills + FastAPI/Docker, Experience + MySQL query work); v2 had 2, 1, and 0–1 (mild) in 3 runs. Across the matrix, 7 of 9 runs still had at least one invented example, mostly Skills lines listing missing tools and gap projects written as already done. |
| v3 | 2026-10-29 | One added rule under `improvements`: "Improvements only improve how the candidate presents what is ALREADY true. A missing tool, skill, or project the candidate has not done is a gap: put it in suggested_projects, never in an improvement's example. Before writing each example, check every tool, number, and task in it against the resume; anything not in the resume must become a [placeholder] or be removed." | v2 showed why the rule alone wasn't enough. When the gap was a missing tool, the model still "closed" it inside the improvement (a Skills line with Python/FastAPI, a project written as done). v3 gives the gap somewhere legitimate to go (`suggested_projects`) and adds a self-check step. **Not better → reverted to v2.** Tests 1–5 (one run each; 6, 7, E1 not run, daily quota): invented facts per run v3 = 2, 3, 0, 2, 3 (10) vs v2 = 2, 3, 2, 1, 0–1 (8–9). Fixed test 3 but made test 5 worse (v2 used placeholders; v3 added Python to all 3 examples). New format regressions: only 1 improvement on test 3 and only 1 strength on test 5. Scores all in range (test 5 is 22, 2 over). |

## Model and config changes

These don't change the prompt text, so `PROMPT_VERSION` stays the same. The response's `model` field records which model answered, so results stay traceable.

| Date | Prompt | Change | Why | Evidence |
|------|--------|--------|-----|----------|
| 2026-10-29 | v1 | Default model `gemini-2.5-flash` → `gemini-3.5-flash`, with a one-time fallback to `gemini-3.1-flash-lite` on 503/429/404. Thinking setting changed from `thinkingBudget: 2048` (2.5 only) to `thinkingLevel: "low"` (Gemini 3). Added a 45 s Gemini timeout and `[analyze]` log lines. | The live app failed: `gemini-2.5-flash` returns 404 "no longer available to new users" for this key. 3.5-flash is a stable dated release (`3.5-flash-05-2026`), not a preview or a `-latest` alias. It also had frequent 503 "high demand" errors, which is why the fallback exists. | Probe with this key: 3.5-flash 200 with schema + JSON + both thinking settings. 3.1-flash-lite 200. 2.5-flash and 2.5-flash-lite 404. flash-latest 503 and 3.8-flash 503/timeouts. E2E R1 vs JD-A: score 62 twice (expected 55–70), answered by the fallback after a 503. |

## Observed in v1 (candidates for v2)

- **Invented facts in `example`** (R1 vs JD-A, 2026-10-29, 3.1-flash-lite): the rewrite examples added "evaluated using MAE and RMSE" and "optimizing database queries (MySQL)", which aren't in the resume. That breaks the "use ONLY facts from the resume" rule. Confirmed on `gemini-3.5-flash` (2 runs, same prompt): the Skills example added FastAPI and Docker, and the Experience example invented "managed/optimized MySQL database queries". → Addressed in v2.

## Observed in v2 (not addressed — candidates after v3)

- **"Either/or" requirements counted as missing:** JD-A says "AWS, GCP or Azure" and "OpenAI, Gemini". R3 has AWS and OpenAI but still got GCP, Azure, and Gemini as missing. Likewise "Power BI or Tableau" → Tableau listed as missing for R2. This inflates the missing list, but didn't push scores out of range.

## Test conditions

Every v1/v2/v3 comparison ran on `gemini-3.5-flash` with the fallback turned off (`npm run test:e2e -- … --no-fallback`), so differences come from the prompt, not a model switch. The free tier allows **20 requests per day** for this model ("limit: 20" in the 429 error), which caps how many tests fit in one day.

## How to iterate

1. Run the test matrix in `TEST_PLAN.md` and fill in the results log.
2. Pick the **one** most common failure (e.g. scores too high, a generic improvement, present keywords listed as missing).
3. Make **one** targeted change to `SYSTEM_PROMPT`. Changing several things at once means you can't tell which one helped.
4. Bump `PROMPT_VERSION` (v1 → v2), add a row above with the date, the exact change, why, and which test showed the problem.
5. Re-run the tests that failed **and** a couple that passed, to make sure you didn't break them.

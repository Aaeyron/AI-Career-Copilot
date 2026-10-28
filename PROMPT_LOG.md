# Prompt Log

Every change to `SYSTEM_PROMPT` in `api/analyze.js` gets a new `PROMPT_VERSION` and a row here.
The version is shown under the results in the UI, so each test result can be traced to a prompt.

| Version | Date | Change | Why | Test evidence |
|---------|------|--------|-----|---------------|
| v0 | 2026-10 | Starter prompt: "expert career coach", 5 flat fields, free-text JSON parsed with a regex. | Provided starter. | Key was exposed in the browser; no matched keywords, projects, or structured improvements; JSON could break. |
| v1 | 2026-10-29 | Rewrote as ROLE + TASK (4-step procedure) + SCORING rubric (40/25/15/10/10) with calibration bands + FORMAT (per-field rules) + RULES + one few-shot example. Moved to `systemInstruction` with a `responseSchema` (7 fields, structured `improvements`). Resume/JD wrapped in `<resume>`/`<job_description>` tags and marked as untrusted. | A rubric with calibration gives realistic, explainable scores instead of a gut number. The explicit "search the resume for variants" step and the "never in both lists" rule target false missing keywords. Requiring quoted evidence and a pasteable `example` per improvement blocks generic advice. Schema guarantees parseable JSON. Tags + rule defend against prompt injection. | Baseline — run TEST_PLAN.md and fill in the results log. |

## How to iterate

1. Run the test matrix in `TEST_PLAN.md` and fill in the results log.
2. Pick the **one** most common failure (e.g. scores too high, a generic improvement, present keywords listed as missing).
3. Make **one** targeted change to `SYSTEM_PROMPT`. Changing several things at once means you can't tell which one helped.
4. Bump `PROMPT_VERSION` (v1 → v2), add a row above with the date, the exact change, why, and which test showed the problem.
5. Re-run the tests that failed **and** a couple that passed, to make sure you didn't break them.

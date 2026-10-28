# AI Career Copilot

Paste a resume and a job description. Get a calibrated ATS match score, matched and missing keywords, evidence-based strengths, section-by-section fixes with rewrite examples, and project ideas that close your gaps.

**Live:** https://ai-career-copilot-aaron.vercel.app _(update after deploy)_

## How it works

```
Browser (index.html)
   │  POST /api/analyze  { resume, jobDescription }
   ▼
Vercel serverless function (api/analyze.js)
   │  validates input, adds SYSTEM_PROMPT, reads GEMINI_API_KEY from env
   ▼
Gemini API (gemini-2.5-flash, responseSchema → strict JSON)
   │
   ▼
Function normalizes the JSON (types, ranges, keyword check) → browser renders it
```

The API key exists only as a server environment variable. It is never sent to the browser and never committed.

## Prompt engineering

The system prompt in `api/analyze.js` has these parts:

- **ROLE**: a senior technical recruiter and ATS specialist who doesn't inflate scores.
- **TASK**: a 4-step procedure: extract the requirements, check each one against the resume (including variants like ML ↔ machine learning), score, then write feedback.
- **SCORING**: a weighted rubric (keywords 40, experience 25, impact 15, education 10, readability 10) with calibration bands, so scores are realistic.
- **FORMAT**: rules for each field, enforced by a Gemini `responseSchema`.
- **RULES**: anti-generic, no invented facts, no keyword in both lists, resume/JD treated as untrusted data (prompt-injection defense).
- **FEW-SHOT**: one worked example that shows the tone and calibration.

Changes are versioned in [PROMPT_LOG.md](PROMPT_LOG.md); tests are in [TEST_PLAN.md](TEST_PLAN.md).

## Output

```json
{
  "ats_score": 62,
  "summary": "...",
  "matched_keywords": ["..."],
  "missing_keywords": ["..."],
  "strengths": ["..."],
  "improvements": [{ "section": "...", "issue": "...", "fix": "...", "example": "..." }],
  "suggested_projects": ["..."]
}
```

## Run locally

Requires Node 18+ and a free Gemini key from https://aistudio.google.com.

```bash
npm install -g vercel          # once
vercel login                   # once
cp .env.example .env.local     # then put your real key in .env.local
npm run test:api               # offline test of the API function (no key needed)
vercel dev                     # http://localhost:3000
```

## Security

- The key is server-side only, sent to Google in a header (not in the URL), and git-ignored via `.env*`.
- All AI and user text is HTML-escaped before rendering (XSS protection).
- Input length limits on both client and server (resume 15k chars, JD 10k chars).
- Gemini errors are logged on the server; the browser only gets safe, friendly messages.
- Use a free-tier key with no billing attached, so public traffic can at worst hit the rate limit.

## Privacy

Resume text is sent to the Google Gemini API for analysis and is not stored by this app. On the free tier, Google may use inputs to improve its products, so remove your personal contact details before pasting.

## Tech

Plain HTML/CSS/JS · Vercel Serverless Functions (Node) · Google Gemini API

# Submission — AI Career Copilot

- **Name:** Aaron
- **Live URL:** https://ai-career-copilot-aaron.vercel.app  ← replace with the URL Vercel gives you
- **GitHub:** https://github.com/<your-username>/ai-career-copilot-aaron
- **Prompt style:** Structured role prompt (ROLE + TASK + weighted SCORING rubric + FORMAT + RULES) with one few-shot example, enforced as strict JSON by Gemini's `responseSchema`; versioned in PROMPT_LOG.md (currently v1).
- **Description:** A resume analyzer that compares a resume to a job description and returns a calibrated ATS score, matched/missing keywords, evidence-based strengths, section-by-section fixes with rewrite examples, and gap-closing project ideas.
- **AI usage:** Gemini 2.5 Flash powers the analysis through a server-side Vercel function. I used Claude (Claude Code) as a coding assistant for code review, security hardening, test design and prompt iteration, and I tested, reviewed and deployed everything myself.

// Real end-to-end call through api/analyze.js using samples from TEST_PLAN.md.
// Uses the key in .env.local (loaded into this process only, never printed). Costs 1 Gemini request.
// Run: npm run test:e2e -- R1 JD-A
//      npm run test:e2e -- R3 JD-A --json   (prints the full response)

import { readFileSync } from 'node:fs';

const [resumeId = 'R1', jobId = 'JD-A'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const showJson = process.argv.includes('--json');

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const plan = readFileSync(new URL('../TEST_PLAN.md', import.meta.url), 'utf8');
function sample(id) {
  const m = plan.match(new RegExp(`### ${id} [^\\n]*\\n\`\`\`\\n([\\s\\S]*?)\\n\`\`\``));
  if (!m) throw new Error(`Sample ${id} not found in TEST_PLAN.md`);
  return m[1];
}

// Import after env is loaded, because the handler reads GEMINI_MODEL at import time.
const { default: handler } = await import('../api/analyze.js');

const res = {
  statusCode: 200, body: undefined,
  setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; },
};
const started = Date.now();
await handler({ method: 'POST', body: { resume: sample(resumeId), jobDescription: sample(jobId) } }, res);
const seconds = ((Date.now() - started) / 1000).toFixed(1);

const r = res.body;
console.log(`\n${resumeId} vs ${jobId} → HTTP ${res.statusCode} in ${seconds}s`);
if (res.statusCode !== 200) { console.log('Error:', r?.error); process.exit(1); }
console.log(`model:              ${r.model} (prompt ${r.prompt_version})`);
console.log(`ats_score:          ${r.ats_score}`);
console.log(`summary:            ${r.summary}`);
console.log(`matched_keywords:   ${r.matched_keywords.join(', ')}`);
console.log(`missing_keywords:   ${r.missing_keywords.join(', ')}`);
console.log(`_filtered_missing:  ${r._filtered_missing.join(', ') || '(none — model did not list present keywords as missing)'}`);
console.log(`strengths:          ${r.strengths.length}, improvements: ${r.improvements.length}, projects: ${r.suggested_projects.length}`);
if (showJson) console.log(JSON.stringify(r, null, 2));

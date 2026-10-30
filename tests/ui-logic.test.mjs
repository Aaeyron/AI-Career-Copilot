// Offline tests for the browser-only helpers in index.html (PDF checks and text cleanup, saved history).
// Loads the block between the <testable> markers into a Node sandbox. No browser, key or network needed.
// Run: npm run test:ui

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const block = html.match(/\/\* <testable>[\s\S]*?\/\* <\/testable> \*\//)?.[0];
if (!block) throw new Error('No <testable> block found in index.html');

const sandbox = {};
vm.runInNewContext(`${block}
  this.h = { PDF_MAX_BYTES, HISTORY_MAX, isPdfName, looksLikePdf, pageText, cleanPdfText, fitToLimit,
    firstLine, makeHistoryEntry, addToHistory, parseHistory };`, sandbox);
const h = sandbox.h;

let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) { failures++; if (detail !== undefined) console.log('      ', JSON.stringify(detail)); }
}
const bytes = (s) => new Uint8Array(Buffer.from(s, 'latin1'));

check('PDF size limit is 5 MB', h.PDF_MAX_BYTES === 5 * 1024 * 1024);
check('.pdf name is accepted (any case)', h.isPdfName({ name: 'CV.PDF', type: '' }));
check('application/pdf type is accepted without extension', h.isPdfName({ name: 'cv', type: 'application/pdf' }));
check('.docx is rejected', !h.isPdfName({ name: 'cv.docx', type: 'application/vnd.openxmlformats' }));

check('real PDF header is recognised', h.looksLikePdf(bytes('%PDF-1.7\n%âãÏÓ\n1 0 obj')));
check('PDF header after a little junk is recognised', h.looksLikePdf(bytes('\r\n\r\n%PDF-1.4\n')));
check('PNG renamed to .pdf is rejected', !h.looksLikePdf(bytes('\x89PNG\r\n\x1a\n\0\0\0\rIHDR')));
check('ZIP/.docx renamed to .pdf is rejected', !h.looksLikePdf(bytes('PK\x03\x04\x14\0\x06\0')));

const page1 = h.pageText([
  { str: 'ARJUN  MEHTA', hasEOL: true },
  { str: 'Skills: Python,', hasEOL: false }, { str: ' ', hasEOL: false }, { str: 'SQL', hasEOL: true },
  { str: '', hasEOL: true }, { str: '', hasEOL: true }, { str: '', hasEOL: true },
  { str: '   Git   ', hasEOL: false },
]);
const text = h.cleanPdfText([page1, 'PAGE TWO']);
check('PDF text keeps lines, collapses spaces and blank runs',
  text === 'ARJUN MEHTA\nSkills: Python, SQL\n\nGit\n\nPAGE TWO', text);
check('scanned PDF (no text items) gives empty text', h.cleanPdfText([h.pageText([]), h.pageText([{ str: ' ' }])]) === '');

let fit = h.fitToLimit('x'.repeat(15001), 15000);
check('text over the limit is truncated and flagged', fit.text.length === 15000 && fit.truncated);
fit = h.fitToLimit('x'.repeat(15000), 15000);
check('text exactly at the limit is kept as-is', fit.text.length === 15000 && !fit.truncated);

check('firstLine skips blank lines', h.firstLine('\n  \n  KAVYA REDDY \nml', 40) === 'KAVYA REDDY');
check('firstLine shortens long lines with an ellipsis', h.firstLine('a'.repeat(80), 10) === 'aaaaaaaaa…');

const result = { ats_score: 64, summary: 's', prompt_version: 'v2', model: 'gemini-3.5-flash', matched_keywords: [] };
const resume = 'ARJUN MEHTA\nphone +91 98765 43210\nSECRET-RESUME-BODY Python, SQL';
const entry = h.makeHistoryEntry(result, resume, 'AI/ML Intern — Nimbus Analytics\nWe are looking...', new Date('2026-10-30T09:15:00Z'));
check('history entry has date, score, version, model and the full result',
  entry.savedAt === '2026-10-30T09:15:00.000Z' && entry.score === 64 && entry.prompt_version === 'v2' &&
  entry.model === 'gemini-3.5-flash' && entry.result === result, entry);
check('history label is the resume first line and the JD title',
  entry.label === 'ARJUN MEHTA → AI/ML Intern — Nimbus Analytics', entry.label);
check('history entry does not store the resume text',
  !JSON.stringify(entry).includes('SECRET-RESUME-BODY') && !JSON.stringify(entry).includes('98765'));

let list = [];
for (let i = 0; i < 12; i++) list = h.addToHistory(list, { ...entry, id: `id${i}` });
check('history keeps only the newest 10, newest first',
  list.length === h.HISTORY_MAX && list[0].id === 'id11' && list[9].id === 'id2', list.map((e) => e.id));

check('stored history round-trips', h.parseHistory(JSON.stringify(list)).length === 10);
check('corrupt storage gives an empty history', h.parseHistory('{not json').length === 0);
check('non-array storage gives an empty history', h.parseHistory('{"a":1}').length === 0);
check('missing storage gives an empty history', h.parseHistory(null).length === 0);
const mixed = JSON.stringify([entry, { id: 'x', score: '99', result: {} }, null, { id: 'y', score: 5 }]);
check('malformed entries are dropped', h.parseHistory(mixed).length === 1, h.parseHistory(mixed));

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

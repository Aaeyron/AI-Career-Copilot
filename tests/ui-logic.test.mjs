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
  this.h = { PDF_MAX_BYTES, HISTORY_MAX, isPdfName, looksLikePdf, pageLines, cleanPdfText, fitToLimit,
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

// A pdf.js text item at (x, baseline y), font size `size`. Width is roughly half the size per character.
const item = (str, x, y, size = 10, width = str.length * size * 0.5) => ({ str, transform: [size, 0, 0, size, x, y], width, height: size });
const lineTexts = (items) => h.pageLines(items).map((l) => l.text);
// Text-level helpers: plain strings are lines; G() marks a line that follows a vertical gap.
const G = (text) => ({ text, gapBefore: true });
const clean = (...lines) => h.cleanPdfText([lines.map((l) => (typeof l === 'string' ? { text: l, gapBefore: false } : l))]);

const page1 = h.pageLines([
  item('ARJUN  MEHTA', 50, 800), item('Skills: Python,', 50, 780), item(' ', 125, 780, 10, 3), item('SQL', 128, 780),
  item('   Git   ', 50, 740),
]);
const text = h.cleanPdfText([page1, h.pageLines([item('PAGE TWO', 50, 800)])]);
check('PDF text keeps lines, collapses spaces and blank runs',
  text === 'ARJUN MEHTA\nSkills: Python, SQL\n\nGit\n\nPAGE TWO', text);
check('scanned PDF (no text items) gives empty text',
  h.cleanPdfText([h.pageLines([]), h.pageLines([item(' ', 0, 0)])]) === '');

// Space-gap handling
let lines = lineTexts([item('Pyth', 50, 700), item('on', 70, 700)]);
check('pieces with no gap are joined into one word', lines[0] === 'Python', lines);
lines = lineTexts([item('Python,', 50, 700), item('SQL', 90, 700)]);
check('pieces with a visible gap get exactly one space', lines[0] === 'Python, SQL', lines);
lines = lineTexts([item('Docker ', 50, 700), item('FastAPI', 90, 700)]);
check('no double space when a piece already ends with one', lines[0] === 'Docker FastAPI', lines);
lines = lineTexts([item('world', 80, 600.4), item('hello', 50, 600), item('next line', 50, 588)]);
check('pieces are grouped by baseline and ordered left to right', JSON.stringify(lines) === '["hello world","next line"]', lines);

// Wrapped sentence joining
check('wrapped line starting lowercase is joined',
  clean('Built a churn model used by the', 'retention team to target 15k accounts.') ===
  'Built a churn model used by the retention team to target 15k accounts.');
check('line ending with a connector word is joined', clean('Trained LSTM models on', '50k IMDB reviews.') === 'Trained LSTM models on 50k IMDB reviews.');
check('line ending with a comma is joined', clean('Python, pandas,', 'NumPy, SQL') === 'Python, pandas, NumPy, SQL');
check('line starting with "(" is joined', clean('Microsoft Power BI Data Analyst', '(PL-300), 2025') === 'Microsoft Power BI Data Analyst (PL-300), 2025');
check('word hyphenated across lines keeps its hyphen, no space', clean('Built a customer-', 'facing dashboard.') === 'Built a customer-facing dashboard.');
check('finished sentence is not joined', clean('Led a team of 4.', 'improved results') === 'Led a team of 4.\nimproved results');
check('new capitalised line without a connector stays separate',
  clean('Machine Learning Engineer, Quantiva Labs', 'Built a churn model') === 'Machine Learning Engineer, Quantiva Labs\nBuilt a churn model');
check('name and contact line stay separate',
  clean('Kavya Reddy', 'kavya.reddy@email.com | github.com/kavyar') === 'Kavya Reddy\nkavya.reddy@email.com | github.com/kavyar');
check('title-like line is not joined with the next', clean('Google Data Analytics', 'professional certificate') === 'Google Data Analytics\nprofessional certificate');
check('wrapped text after a vertical gap is not joined', clean('Worked with', G('pandas daily.')) === 'Worked with\n\npandas daily.');

// Bullet normalisation
const bullets = clean('• Built a churn model', '● Fine-tuned DistilBERT', '* Served via FastAPI', '– Tracked in MLflow',
  ' Wrote SQL pipelines', '•', 'Led a RAG prototype', '1. First numbered item');
check('bullet symbols become "- " (incl. Word Symbol bullets and a bullet on its own line)',
  bullets === '- Built a churn model\n- Fine-tuned DistilBERT\n- Served via FastAPI\n- Tracked in MLflow\n- Wrote SQL pipelines\n- Led a RAG prototype\n1. First numbered item', bullets);
check('wrapped bullet text joins its bullet', clean('• Built a churn model used by the', 'retention team') === '- Built a churn model used by the retention team');
check('a new bullet never joins the previous one', clean('• Worked with', '• Docker') === '- Worked with\n- Docker');
check('a leading minus sign that is not a bullet is kept', clean('-5% cloud cost') === '-5% cloud cost');

// Heading preservation and blank-line limits
check('headings get one blank line before and none after',
  clean('Summary text here.', 'EDUCATION', 'B.Tech IT, 2026', 'Work Experience', 'ML Engineer') ===
  'Summary text here.\n\nEDUCATION\nB.Tech IT, 2026\n\nWork Experience\nML Engineer');
check('heading is not joined with a lowercase line', clean('SKILLS:', 'python, sql') === 'SKILLS:\npython, sql');
check('ALL-CAPS tool list is not treated as a heading', clean('Built X.', 'SQL (SELECT, JOIN)') === 'Built X.\nSQL (SELECT, JOIN)');
check('blank lines are limited to one, never leading or after a heading',
  clean(G('First.'), G('Second.'), G('EDUCATION'), G('B.Tech')) === 'First.\n\nSecond.\n\nEDUCATION\nB.Tech');
check('empty lines collapse into one blank line', clean('A.', '', '   ', G('B.')) === 'A.\n\nB.');
check('page break gives one blank line', h.cleanPdfText([[{ text: 'Page one ends.' }], [{ text: 'Page two starts.' }]]) === 'Page one ends.\n\nPage two starts.');
check('tabs and repeated spaces collapse', clean('Python,\t\tpandas    NumPy') === 'Python, pandas NumPy');

// Columns. Two-column page written row by row (as some PDF tools do): left column must come out first.
const twoCol = [
  item('PRIYA NAIR', 50, 800, 20), item('priya@x.com | linkedin.com/in/p | Bengaluru', 50, 780),
  item('SKILLS', 50, 740), item('SUMMARY', 230, 740),
  item('Excel, Power BI,', 50, 728), item('Accountant moving into', 230, 728),
  item('SQL, Tally', 50, 716), item('data analytics.', 230, 716),
  item('EDUCATION', 50, 704), item('EXPERIENCE', 230, 704),
  item('B.Com, Christ University', 50, 692), item('Senior Accountant, Kaveri', 230, 692),
];
const twoColText = h.cleanPdfText([h.pageLines(twoCol)]);
check('two-column page reads the left column fully, then the right',
  twoColText === 'PRIYA NAIR\npriya@x.com | linkedin.com/in/p | Bengaluru\n\nSKILLS\nExcel, Power BI, SQL, Tally\n\nEDUCATION\nB.Com, Christ University' +
  '\n\nSUMMARY\nAccountant moving into data analytics.\n\nEXPERIENCE\nSenior Accountant, Kaveri', twoColText);
const singleCol = [
  item('Web Development Intern, PixelCraft', 50, 700), item('May–Jul 2025', 400, 700),
  item('Built 6 responsive landing pages for client websites and fixed', 50, 688), item('bugs in a PHP admin panel.', 50, 676),
  item('Data Intern, Harbor Retail', 50, 650), item('Jan–Apr 2025', 400, 650),
  item('Automated weekly sales reports in Excel for the finance team and', 50, 638), item('store managers.', 50, 626),
];
const singleText = h.cleanPdfText([h.pageLines(singleCol)]);
check('single column with right-aligned dates is not split into columns',
  singleText === 'Web Development Intern, PixelCraft May–Jul 2025\nBuilt 6 responsive landing pages for client websites and fixed bugs in a PHP admin panel.' +
  '\n\nData Intern, Harbor Retail Jan–Apr 2025\nAutomated weekly sales reports in Excel for the finance team and store managers.', singleText);

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

// No emoji in the UI or docs: icons are inline SVG. Pictographs, the old ✓ ✕ ⚠ glyphs and emoji
// variation selectors all fail. TEST_PLAN.md (sample resumes) and this file's test data are not scanned.
const PICTOGRAPH = /[\p{Extended_Pictographic}✓✔✕✖✗✘⚠︎️]/u;
for (const file of ['index.html', 'README.md', 'SUBMISSION.md', 'PROMPT_LOG.md']) {
  const hits = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n')
    .map((line, n) => ({ line: n + 1, char: line.match(PICTOGRAPH)?.[0] }))
    .filter((h) => h.char)
    .map((h) => `line ${h.line}: U+${h.char.codePointAt(0).toString(16).toUpperCase()}`);
  check(`no emoji or pictograph characters in ${file}`, hits.length === 0, hits.slice(0, 5));
}
check('the emoji check itself catches emoji, ✓ and variation selectors',
  ['🚀', '✓', '⚠', 'x️', '🕘'].every((s) => PICTOGRAPH.test(s)) && !PICTOGRAPH.test('Plain text → — … •'));

// Every icon the page uses must exist in the sprite.
const symbols = new Set([...html.matchAll(/<symbol id="i-([a-z-]+)"/g)].map((m) => m[1]));
const used = new Set([...html.matchAll(/href="#i-([a-z-]+)"|icon\('([a-z-]+)'|listItems\([^,]+, '([a-z-]+)'/g)]
  .map((m) => m[1] || m[2] || m[3]));
Object.values(html.match(/STATUS_ICONS = (\{[^}]*\})/)?.[1].match(/'([a-z-]+)'(?=\s*[,}])/g) || []).forEach((n) => used.add(n.slice(1, -1)));
const missing = [...used].filter((n) => !symbols.has(n));
check('every icon used in index.html is defined in the sprite', used.size > 15 && missing.length === 0, { missing, used: [...used] });

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

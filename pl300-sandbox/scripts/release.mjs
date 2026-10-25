// Copies the single-file build to release/ and writes an artifact-ready variant
// (page content without <html>/<head>/<body>, for hosts that add their own skeleton).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
mkdirSync('release', { recursive: true });
writeFileSync('release/PL-300-Sandbox.html', html);

// vite-plugin-singlefile emits: <title>, one inline module <script>, one <style>, then <body>.
// Each closing tag appears exactly once, so slice by position instead of pattern-matching the bundle.
const title = /<title>[\s\S]*?<\/title>/.exec(html)[0];
const sStart = html.indexOf('<script'), sEnd = html.indexOf('</script>') + '</script>'.length;
const script = html.slice(sStart, sEnd);
const stEnd = html.indexOf('</style>') + '</style>'.length;
const stStart = html.lastIndexOf('<style', html.indexOf('</style>'));
const style = html.slice(stStart, stEnd);
const body = html.slice(html.lastIndexOf('<body>') + 6, html.lastIndexOf('</body>')).trim();
const out = process.argv[2];
if (out) writeFileSync(out, `${title}\n${style}\n${body}\n${script}\n`);
console.log(`release/PL-300-Sandbox.html: ${(html.length / 1e6).toFixed(2)} MB${out ? `; artifact page: ${out}` : ''}`);

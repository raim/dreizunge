// Extracts each <script>…</script> from an HTML file and runs `node --check`
// on it. Usage: node test/check-inline.js [path/to/file.html]
// Defaults to ../index.html relative to this file.
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const file = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let m, i = 0, fail = 0;
while ((m = re.exec(html)) !== null) {
  const body = m[1];
  if (!body.trim()) continue;
  const tag = m[0].slice(0, m[0].indexOf('>') + 1);
  // Skip explicitly-typed non-JS script blocks (e.g. application/json templates).
  if (/type\s*=/i.test(tag) && !/text\/javascript|module|application\/javascript/i.test(tag)) continue;
  i++;
  const tmp = path.join(os.tmpdir(), `_dz_inline_${process.pid}_${i}.js`);
  fs.writeFileSync(tmp, body);
  try {
    cp.execSync(`node --check ${tmp}`, { stdio: 'pipe' });
    console.log(`  script #${i}: OK (${body.length} bytes)`);
  } catch (e) {
    fail++;
    console.error(`  script #${i}: SYNTAX ERROR`);
    console.error(e.stderr ? e.stderr.toString() : e.message);
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}
console.log(`  ${path.basename(file)}: checked ${i} script block(s), ${fail} failure(s)`);
process.exit(fail ? 1 : 0);

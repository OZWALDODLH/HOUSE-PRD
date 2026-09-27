// Checks the licenses of the npm packages that ship inside the app (not the
// build tools). Same policy as deny.toml. Run from the repository root:
//   node scripts/check-licenses.mjs
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Zlib', 'MPL-2.0', '0BSD'];

const ok = (expr) =>
  expr
    .replace(/[()]/g, ' ')
    .split(/\s+OR\s+/i)
    .some((alt) => alt.split(/\s+AND\s+/i).every((l) => ALLOWED.includes(l.trim())));

const app = join(process.cwd(), 'app');
const tree = JSON.parse(execSync('npm ls --omit=dev --all --json', { cwd: app, encoding: 'utf8' }));
const seen = new Map();
(function walk(node) {
  for (const [name, dep] of Object.entries(node.dependencies ?? {})) {
    if (seen.has(name)) continue;
    const file = join(app, 'node_modules', name, 'package.json');
    if (!existsSync(file)) continue; // optional peer that is not installed
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    seen.set(name, typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license ?? pkg.licenses ?? '?'));
    walk(dep);
  }
})(tree);

let bad = 0;
for (const [name, lic] of [...seen].sort()) {
  const good = ok(lic);
  if (!good) bad++;
  console.log(`${good ? 'ok   ' : 'NO   '} ${lic.padEnd(22)} ${name}`);
}
console.log(bad ? `\n${bad} paquete(s) con licencia fuera de la política.` : `\n${seen.size} paquetes, todos dentro de la política.`);
process.exit(bad ? 1 : 0);

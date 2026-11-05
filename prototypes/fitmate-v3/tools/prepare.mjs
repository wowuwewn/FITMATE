import { build } from 'vite';
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const repo = path.resolve(root, '../..');
await mkdir(path.join(root, 'qa'), { recursive: true });
async function walk(dir) {
  const entries = await readdir(path.join(repo, dir), { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]))).flat();
}
const protectedFiles = [...await walk('src'), ...await walk('server'), ...await walk('api'), 'package.json', 'package-lock.json', 'docs/PRD.md', 'docs/SCORING_POLICY.md'];
const hashes = Object.fromEntries(await Promise.all(protectedFiles.map(async f => [f, createHash('sha256').update(await readFile(path.join(repo, f))).digest('hex')])));
try { await readFile(path.join(root, 'qa/source-baseline.json')); }
catch { await writeFile(path.join(root, 'qa/source-baseline.json'), JSON.stringify(hashes, null, 2)); }
await build({ configFile: false, root, publicDir: false, logLevel: 'warn', build: { outDir: 'data', emptyOutDir: false, minify: false, lib: { entry: path.join(root, 'engine-entry.ts'), formats: ['es'], fileName: () => 'analysis.js' } } });
for (const relative of ['images/white-jar-demo.png', 'images/amber-bottle-demo.png', 'images/charcoal-jar-demo.png', 'images/mockups/creatine.webp', 'images/mockups/energy.webp', 'images/mockups/medication.webp']) {
  const dest = path.join(root, 'assets', relative);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(path.join(repo, 'public', relative), dest);
}
await copyFile(path.join(repo, 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2'), path.join(root, 'assets/PretendardVariable.woff2'));
await copyFile(path.join(repo, 'node_modules/pretendard/dist/LICENSE.txt'), path.join(root, 'assets/PRETENDARD-LICENSE.txt'));
for (const f of ['cart_interactions_dataset.json', 'supplement_interactions_with_lactose_ko.json']) await copyFile(path.join(repo, 'src/data', f), path.join(root, 'data', f));
await writeFile(path.join(root, 'data/provenance.json'), JSON.stringify({ generated: new Date().toISOString(), engine: 'Unmodified source bundled with Vite', hashes: Object.fromEntries(Object.entries(hashes).filter(([f]) => f.startsWith('src/analysis/') || f.startsWith('src/data/'))) }, null, 2));
console.log('Prepared standalone analysis bundle, original JSON snapshots, existing imagery and local Pretendard.');

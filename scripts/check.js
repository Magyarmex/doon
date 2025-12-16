import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['src', 'tests', 'scripts'];

function collectFiles(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (stats.isFile() && fullPath.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const targets = roots.flatMap((root) => collectFiles(path.join(process.cwd(), root)));
let failures = 0;

for (const file of targets) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) {
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`Syntax checks failed for ${failures} file(s).`);
  process.exitCode = 1;
} else {
  console.log(`Syntax checks passed for ${targets.length} file(s).`);
}

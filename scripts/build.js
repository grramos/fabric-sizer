import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));
const distDir = fileURLToPath(new URL('../dist', import.meta.url));

async function copyRecursive(from, to) {
  const entries = await readdir(from, { withFileTypes: true });
  await mkdir(to, { recursive: true });
  for (const entry of entries) {
    const fromPath = join(from, entry.name);
    const toPath = join(to, entry.name);
    if (entry.isDirectory()) {
      await copyRecursive(fromPath, toPath);
    } else if (entry.isFile()) {
      const data = await readFile(fromPath);
      await mkdir(dirname(toPath), { recursive: true });
      await writeFile(toPath, data);
    }
  }
}

try {
  await mkdir(distDir, { recursive: true });
  await copyRecursive(publicDir, distDir);
  console.log('Static assets copied to dist/.');
} catch (error) {
  console.error('Failed to build static assets:', error);
  process.exitCode = 1;
}

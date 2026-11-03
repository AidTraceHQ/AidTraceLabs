import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = fileURLToPath(new URL('.', import.meta.url));
const workspaceRoot = resolve(scriptDirectory, '..');
const sourcePath = resolve(workspaceRoot, '.env.example');
const targetPath = resolve(workspaceRoot, '.env.local');

if (existsSync(targetPath)) {
  console.log('A local environment file already exists at .env.local; leaving it untouched.');
  process.exit(0);
}

const template = readFileSync(sourcePath, 'utf8');
copyFileSync(sourcePath, targetPath);
console.log(
  `Created .env.local from .env.example. Update the local values before starting the app.\n${template.split('\n').slice(0, 6).join('\n')}`,
);

import { writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { exec } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const execPromise = promisify(exec);

const resolveGitBranch = async () => {
  try {
    // Check if the current directory is a Git repository
    await execPromise('git rev-parse --is-inside-work-tree');
    return (await execPromise('git rev-parse --abbrev-ref HEAD')).stdout
      .toString()
      .trim();
  } catch (_gitError) {
    throw new Error('Failed to resolve git branch: not a git repository');
  }
};

try {
  const appVersion = process.env.APP_VERSION;
  const version =
    appVersion != null && appVersion.length !== 0
      ? appVersion
      : await resolveGitBranch();

  const jsonContent = `{'branch': '${version}'}`;
  const content = `export const environment = ${jsonContent};`;

  console.log(`Creating environment for ${version}...`);
  writeFileSync(resolve(__dirname, '../src/environment.js'), content, {
    encoding: 'utf8',
  }); // for frontend
  process.exit(0);
} catch (e) {
  console.error(e);
  process.exit(1);
}

import {writeFileSync} from 'fs';
import {dirname, resolve} from 'path';
import {fileURLToPath} from 'url';
import {promisify} from 'util';
import {exec} from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const execPromise = promisify(exec);

(async (branch) => {
  try {
    const dir = '../src';
    const filename = 'environment';

    if (!branch) {
      branch = (await execPromise('git rev-parse --abbrev-ref HEAD')).stdout.toString().trim();
    }

    const jsonContent = `{'branch': '${branch}'}`;
    const content = `export const environment = ${jsonContent};`;

    console.log(`Creating environment for ${branch}...`);
    writeFileSync(resolve(__dirname, `${dir}/${filename}.js`), content, {encoding: 'utf8'}); // for frontend
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})(process.argv.slice(2)[0]);

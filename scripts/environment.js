const fs = require('fs');
const util = require('util');
const path = require('path');

const exec = util.promisify(require('child_process').exec);

(async (branch) => {
  try {
    const dir = '../src';
    const filename = 'environment';

    if (!branch) {
      branch = (await exec('git rev-parse --abbrev-ref HEAD')).stdout.toString().trim();
    }

    const jsonContent = `{'branch': '${branch}'}`;
    const content = `export const environment = ${jsonContent};`;

    console.log(`Creating environment for ${branch}...`);
    fs.writeFileSync(path.resolve(__dirname, `${dir}/${filename}.js`), content, {encoding: 'utf8'}); // for frontend
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})(process.argv.slice(2)[0]);

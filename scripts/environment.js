const fs = require('fs');
const util = require('util');
const path = require('path');

const exec = util.promisify(require('child_process').exec);
const writeFileAsync = util.promisify(fs.writeFile);
const mkdirp = require('mkdirp');
const mkdirpAsync = util.promisify(mkdirp);

(async (branch) => {
  try {
    const dir = '../src/environments';
    const filename = 'environment';

    if (!branch) {
      branch = (await exec('git rev-parse --abbrev-ref HEAD')).stdout.toString().trim();
    }

    const jsonContent = `{"branch": "${branch}"}`;
    const content = `export const environment = ${jsonContent};`;

    await mkdirpAsync(path.resolve(__dirname, dir));

    console.log(`Creating environment for ${branch}...`);
    await writeFileAsync(path.resolve(__dirname, `${dir}/${filename}.js`), content, {encoding: 'utf8'}); // for frontend
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})(process.argv.slice(2)[0]);

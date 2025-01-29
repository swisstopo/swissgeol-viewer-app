import { readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import * as util from 'node:util';
import { exec as execSync } from 'node:child_process';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
const exec = util.promisify(execSync);

const cesiumPackagePath = path.resolve(
  import.meta.dirname,
  '../node_modules/cesium/package.json',
);
const cesiumPackageString = readFileSync(cesiumPackagePath, 'utf-8');
const cesiumVersion = JSON.parse(cesiumPackageString).version;

const commitHash = (await exec('git rev-list HEAD -1')).stdout.trim();

const now = new Date();
const date = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'longOffset',
  hourCycle: 'h23',
})
  .format(now)
  .replace(', ', 'T')
  .replace(' GMT', '');

const versionsFilePath = path.resolve(
  import.meta.dirname,
  '../dist/versions.json',
);
mkdirSync(dirname(versionsFilePath), { recursive: true });
writeFileSync(
  versionsFilePath,
  JSON.stringify(
    {
      build: date,
      commit_hash: commitHash,
      cesium: cesiumVersion,
    },
    null,
    2,
  ),
);

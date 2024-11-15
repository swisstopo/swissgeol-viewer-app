import * as fs from 'node:fs';
import * as path from 'node:path';
import {marked} from 'marked';

const legalDir = path.resolve(import.meta.dirname, '../legal/');
const legalDistDir = path.resolve(import.meta.dirname, '../dist/legal/');
fs.mkdirSync(legalDistDir, {recursive: true});
fs.copyFileSync(
  path.resolve(legalDir, 'index.css'),
  path.resolve(legalDistDir, 'index.css'),
);

const template = fs.readFileSync(path.resolve(legalDir, 'template.html'), 'utf-8');

const files = await fs.promises.readdir(legalDir, {withFileTypes: true});
for (const file of files) {
  if (!file.isFile()) {
    continue;
  }
  if (!file.name.endsWith('.md')) {
    continue;
  }

  const fileMarkdown = fs.readFileSync(path.resolve(file.parentPath, file.name), 'utf-8');
  const fileHtml = marked(fileMarkdown);
  const legalHtml = template.replace('_CONTENT_', fileHtml);

  const fileNameHtml = `${file.name.slice(0, -3)}.html`;
  fs.writeFileSync(path.resolve(legalDistDir, fileNameHtml), legalHtml);
}

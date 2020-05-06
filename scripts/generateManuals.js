const fs = require('fs');
const util = require('util');
const path = require('path');

const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);

const languages = ['en', 'de'];

(async () => {
  try {
    const buffer = await readFileAsync(path.resolve(__dirname, '../manuals/manual_base.html'));
    await Promise.all(languages.map(async (lang) => {
      console.log(`Generating manual html for ${lang}`);

      let html = buffer.toString('utf8');
      const manualLocale = require(path.resolve(__dirname, `../manuals/locales/${lang}.json`));
      manualLocale.forEach(t => {
        html = html.replace(new RegExp(`${t.tag}(?!(_|[a-zA-Z]))`, 'gi'), t.text);
      });

      const dir = path.resolve(__dirname, '../manuals/dist');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }

      return await writeFileAsync(path.resolve(__dirname, `${dir}/manual_${lang}.html`), html);
    }));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();

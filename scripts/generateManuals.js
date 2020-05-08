const fs = require('fs');
const path = require('path');

const languages = ['en', 'de'];
const tagPrefix = 'localetag_'; // update html if changed

(async () => {
  try {
    const buffer = await fs.readFileSync(path.resolve(__dirname, '../manuals/manual_base.html'));
    await Promise.all(languages.map(async (lang) => {
      console.log(`Generating manual html for ${lang}`);

      let html = buffer.toString('utf8');
      const manualLocale = require(path.resolve(__dirname, `../manuals/locales/${lang}.json`));
      manualLocale.forEach(t => {
        if (html.includes(`${tagPrefix}${t.tag}`)) {
          html = html.replace(new RegExp(`${tagPrefix}${t.tag}(?!(_|[a-zA-Z]))`, 'gi'), t.text);
          t.used = true;
        }
      });

      const notUsedLocales = manualLocale.filter(locale => !locale.used);
      if (notUsedLocales.length) {
        const notUsedTags = notUsedLocales.map(l => l.tag);
        console.error('HTML not generated. Reason:');
        console.error(`Not used tags: ${notUsedTags.join(', ')}. Language: ${lang}`);
        process.exit(1);
      }

      if (html.includes(tagPrefix)) {
        console.error('HTML not generated. Reason: ');
        console.error(`Not all tags replaced in HTML. Language: ${lang}`);
        process.exit(1);
      }

      const dir = path.resolve(__dirname, '../manuals/dist');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }

      return await fs.writeFileSync(path.resolve(__dirname, `${dir}/manual_${lang}.html`), html);
    }));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();

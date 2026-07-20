/**
 * Progress tracking separately for names vs details.
 */
const fs = require('fs');
const path = require('path');
const { getCatalogImportLocales } = require('./scim-locales');
const { importLocale } = require('./import-locale');

const TRANSLATIONS_DIR = path.join(__dirname, '../src/database/seeds/translations');
const PROGRESS_PATH = path.join(TRANSLATIONS_DIR, '_import-progress.json');

function parseArgs() {
  const args = process.argv.slice(2);
  let skipDetails = false;
  let resume = false;
  let limit = 0;
  let only = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--skip-details') skipDetails = true;
    else if (args[i] === '--resume') resume = true;
    else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--only' && args[i + 1]) {
      only = args[i + 1]
        .split(',')
        .map((code) => code.trim().toLowerCase())
        .filter(Boolean);
      i++;
    }
  }

  return { skipDetails, resume, limit, only };
}

function loadProgress() {
  if (!fs.existsSync(PROGRESS_PATH)) {
    return { completedNames: [], completedDetails: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
    return {
      completedNames: raw.completedNames || raw.completed || [],
      completedDetails: raw.completedDetails || [],
    };
  } catch {
    return { completedNames: [], completedDetails: [] };
  }
}

function saveProgress(progress) {
  fs.mkdirSync(TRANSLATIONS_DIR, { recursive: true });
  fs.writeFileSync(
    PROGRESS_PATH,
    JSON.stringify({ ...progress, updatedAt: new Date().toISOString() }, null, 2)
  );
}

async function main() {
  const { skipDetails, resume, limit, only } = parseArgs();
  let locales = only?.length ? only : getCatalogImportLocales();
  const progress = resume
    ? loadProgress()
    : { completedNames: [], completedDetails: [] };

  const doneKey = skipDetails ? 'completedNames' : 'completedDetails';
  const done = new Set(progress[doneKey] || []);

  if (resume) {
    locales = locales.filter((code) => !done.has(code));
  }

  console.log(
    `Import batch: ${locales.length} lingue${skipDetails ? ' (solo nomi)' : ' (con dettagli)'}`
  );

  const results = [];
  for (let i = 0; i < locales.length; i++) {
    const locale = locales[i];
    console.log(`\n======== [${i + 1}/${locales.length}] ${locale} ========`);
    try {
      const summary = await importLocale(locale, { skipDetails, limit });
      results.push({ ok: true, ...summary });
      done.add(locale);
      progress[doneKey] = [...done];
      progress.lastLocale = locale;
      saveProgress(progress);
    } catch (err) {
      console.error(`FALLITO ${locale}:`, err.message);
      results.push({ ok: false, locale, error: err.message });
      progress.lastError = { locale, message: err.message };
      saveProgress(progress);
    }
  }

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok);
  console.log(`\nBatch terminato: ${ok} ok, ${fail.length} errori`);
  if (fail.length) {
    for (const row of fail) console.log(`  - ${row.locale}: ${row.error}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

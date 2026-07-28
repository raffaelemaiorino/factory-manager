'use strict';

const fs = require('fs');
const path = require('path');
const uk = require('./uk');
const en = require('../_en-flat.json');

const keys = Object.keys(en).filter((k) => !k.startsWith('legal.'));

function buildLocale(localeLabel, overrides) {
  const out = { ...uk };
  out['app.localeLabel'] = localeLabel;
  Object.assign(out, overrides);
  for (const k of keys) {
    if (/[\u0400-\u04FF]/.test(out[k])) {
      out[k] = en[k];
    }
  }
  return out;
}

const ar = buildLocale('العربية', {
  'nav.resources': 'الموارد',
  'nav.production': 'الإنتاج',
  'nav.energy': 'الطاقة',
  'nav.settings': 'الإعدادات',
  'topbar.infoTitle': 'معلومات قانونية',
  'topbar.language': 'اللغة',
  'topbar.languageAria': 'اللغة: {name}',
  'breadcrumb.items': 'العناصر',
  'breadcrumb.projects': 'المشاريع',
  'breadcrumb.system': 'النظام',
  'common.loading': 'جاري التحميل…',
  'common.save': 'حفظ',
  'common.cancel': 'إلغاء',
  'common.confirm': 'تأكيد',
  'common.close': 'إغلاق',
  'dashboard.welcomeTitle': 'مرحباً أيها المهندس',
  'dashboard.lead1':
    'FACTORY MANAGER مخطّط مصانع Satisfactory محلي: فهرس وسلاسل إنتاج ومخططات طاقة — كل شيء على جهازك دون حساب أو سحابة.',
  'resources.title': 'الموارد',
  'production.title': 'الإنتاج',
  'energy.title': 'الطاقة',
  'settings.title': 'الإعدادات',
  'footer.disclaimer':
    'Factory Manager أداة fan-made غير رسمية لتخطيط الإنتاج في Satisfactory. غير تابعة ولا مصرّح بها من Coffee Stain Studios.',
});

const he = buildLocale('עברית', {
  'nav.resources': 'משאבים',
  'nav.production': 'ייצור',
  'nav.energy': 'אנרגיה',
  'nav.settings': 'הגדרות',
  'topbar.infoTitle': 'מידע משפטי',
  'topbar.language': 'שפה',
  'topbar.languageAria': 'שפה: {name}',
  'breadcrumb.items': 'פריטים',
  'breadcrumb.projects': 'פרויקטים',
  'breadcrumb.system': 'מערכת',
  'common.loading': 'טוען…',
  'common.save': 'שמירה',
  'common.cancel': 'ביטול',
  'dashboard.welcomeTitle': 'ברוך הבא, מהנדס',
  'dashboard.lead1':
    'FACTORY MANAGER הוא מתכנן Satisfactory מקומי: קטalog משחק, שרשראות ייצור ותוכניות אנרגיה — הכול על המחשב, בלי חשבון או ענן.',
  'resources.title': 'משאבים',
  'production.title': 'ייצור',
  'energy.title': 'אנרגיה',
  'settings.title': 'הגדרות',
});

const fa = buildLocale('فارسی', {
  'nav.resources': 'منابع',
  'nav.production': 'تولید',
  'nav.energy': 'انرژی',
  'nav.settings': 'تنظیمات',
  'topbar.infoTitle': 'اطلاعات حقوقی',
  'topbar.language': 'زبان',
  'topbar.languageAria': 'زبان: {name}',
  'breadcrumb.items': 'اقلام',
  'breadcrumb.projects': 'پروژه‌ها',
  'breadcrumb.system': 'سیستم',
  'common.loading': 'در حال بارگذاری…',
  'common.save': 'ذخیره',
  'common.cancel': 'لغو',
  'dashboard.welcomeTitle': 'سلام مهندس',
  'dashboard.lead1':
    'FACTORY MANAGER برنامه محلی برنامه‌ریزی کارخانه Satisfactory است: فهرست، زنجیره تولید و طرح انرژی — همه روی PC بدون حساب یا ابر.',
  'resources.title': 'منابع',
  'production.title': 'تولید',
  'energy.title': 'انرژی',
  'settings.title': 'تنظیمات',
});

const dir = __dirname;
for (const [code, obj] of [
  ['ar', ar],
  ['he', he],
  ['fa', fa],
]) {
  fs.writeFileSync(path.join(dir, `${code}.js`), `module.exports = ${JSON.stringify(obj, null, 2)};\n`);
  console.log(code, 'keys', Object.keys(obj).length);
}

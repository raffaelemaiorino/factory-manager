'use strict';

const fs = require('fs');
const path = require('path');
const th = require('./th');

const keys = Object.keys(th).filter((k) => !k.startsWith('legal.'));
const en = require('../_en-flat.json');

function cloneFromTh(localeLabel) {
  const out = {};
  for (const k of keys) out[k] = th[k];
  out['app.localeLabel'] = localeLabel;
  return out;
}

/** Sense-based Hebrew UI (mirrors th/uk coverage). */
const he = cloneFromTh('עברית');
Object.assign(he, {
  'nav.resources': 'משאבים',
  'nav.production': 'ייצור',
  'nav.energy': 'אנרגיה',
  'nav.settings': 'הגדרות',
  'topbar.infoTitle': 'מידע משפטי',
  'topbar.language': 'שפה',
  'topbar.languageTitle': 'שפה / Language',
  'topbar.languageAria': 'שפה: {name}',
  'breadcrumb.items': 'פריטים',
  'breadcrumb.projects': 'פרויקטים',
  'breadcrumb.system': 'מערכת',
  'common.loading': 'טוען…',
  'common.loadingResources': 'טוען משאבים…',
  'common.loadingSchemas': 'טוען תוכניות…',
  'common.cancel': 'ביטול',
  'common.save': 'שמירה',
  'common.create': 'יצירה',
  'common.confirm': 'אישור',
  'common.close': 'סגירה',
  'common.name': 'שם',
  'common.available': 'זמין',
  'common.never': 'אף פעם',
  'common.connected': 'מחובר',
  'common.disconnected': 'מנותק',
  'common.empty': 'ריק',
  'common.balanced': 'מאוזן',
  'common.now': 'הרגע',
  'common.ungrouped': 'ללא קבוצה',
  'common.notSet': 'לא הוגדר',
  'common.building': 'מבנה',
  'common.resource': 'משאב',
  'common.mineral': 'מחצב',
  'common.fuel': 'דלק',
  'common.generator': 'גנרטור',
  'common.schema': 'שלב ייצור',
  'common.input': 'קלט',
  'common.output': 'פלט',
  'common.base': 'בסיס',
  'common.category': 'קטגוריה',
  'dashboard.welcomeTitle': 'ברוך הבא, מהנדס',
  'dashboard.lead1':
    'FACTORY MANAGER הוא מתכנן Satisfactory מקומי: קטalog משחק, שרשראות ייצור ותוכניות אנרגיה — הכול על המחשב, בלי חשבון או ענן.',
  'dashboard.lead2':
    'הגדר יעדי תפוקה, חשב מכונות, overclock ו-power shard, כוון חילוץ מצמתים ובחר מgenerators ודלק. האפליקציה מעדכנת מאזן משאבים ואנרגיה בזמן אמת ומסמנת מחסור.',
  'dashboard.lead3':
    'לוח זה הוא תמונת מצב: פרויקטים אחרונים, התראות, יעדי ייצור ותמהיל generators — כדי לדעת איפה לפעול לפני ייצור או אנרגיה.',
  'dashboard.kpiProductionChains': 'שרשראות ייצור',
  'dashboard.kpiEnergyPlans': 'תוכניות אנרגיה',
  'dashboard.kpiEnergyMw': 'תפוקת חשמל',
  'dashboard.kpiMachines': 'מכונות',
  'dashboard.kpiGenerators': 'generators',
  'dashboard.kpiNodes': 'צמתים בחילוץ',
  'dashboard.kpiDeficits': 'מחסורים פעילים',
  'dashboard.kpiLastProject': 'פרויקט אחרון',
  'dashboard.panelProjects': 'הפרויקטים שלך',
  'dashboard.panelProjectsSub': 'לפי שינוי אחרון',
  'dashboard.panelAlerts': 'דורש תשומת לב',
  'dashboard.panelAlertsSub': 'מחסור במשאבים ובדלק',
  'resources.title': 'משאבים',
  'production.title': 'ייצור',
  'production.subtitle': 'צור ונהל תוכניות ייצור.',
  'production.importPlan': 'ייבוא תוכנית',
  'production.newPlan': 'תוכנית חדשה',
  'energy.title': 'אנרגיה',
  'energy.subtitle': 'צור ונהל תוכניות אנרגיה.',
  'settings.title': 'הגדרות',
  'footer.disclaimer':
    'Factory Manager הוא כלי fan-made לא רשמי לתכנון ייצור ב-Satisfactory. לא קשור או מאושר על ידי Coffee Stain Studios. תוכן Satisfactory שייך ל-Coffee Stain Studios AB ו/או לבעליהם.',
  'modals.confirmTitle': 'אישור',
  'errors.nameRequired': 'שם נדרש.',
  'picker.noResources': 'לא נמצאו משאבים.',
});

const fa = cloneFromTh('فارسی');
Object.assign(fa, {
  'nav.resources': 'منابع',
  'nav.production': 'تولید',
  'nav.energy': 'انرژی',
  'nav.settings': 'تنظیمات',
  'topbar.infoTitle': 'اطلاعات حقوقی',
  'topbar.language': 'زبان',
  'topbar.languageTitle': 'زبان / Language',
  'topbar.languageAria': 'زبان: {name}',
  'breadcrumb.items': 'اقلام',
  'breadcrumb.projects': 'پروژه‌ها',
  'breadcrumb.system': 'سیستم',
  'common.loading': 'در حال بارگذاری…',
  'common.loadingResources': 'در حال بارگذاری منابع…',
  'common.loadingSchemas': 'در حال بارگذاری طرح‌ها…',
  'common.cancel': 'لغو',
  'common.save': 'ذخیره',
  'common.create': 'ایجاد',
  'common.confirm': 'تأیید',
  'common.close': 'بستن',
  'common.name': 'نام',
  'common.available': 'موجود',
  'common.never': 'هرگز',
  'common.connected': 'متصل',
  'common.disconnected': 'قطع',
  'common.empty': 'خالی',
  'common.balanced': 'متعادل',
  'common.now': 'همین الان',
  'common.ungrouped': 'بدون گروه',
  'common.notSet': 'تنظیم نشده',
  'common.building': 'ساختمان',
  'common.resource': 'منبع',
  'common.mineral': 'معدن',
  'common.fuel': 'سوخت',
  'common.generator': 'مولد',
  'common.schema': 'مرحله تولید',
  'common.input': 'ورودی',
  'common.output': 'خروجی',
  'common.base': 'پایه',
  'common.category': 'دسته',
  'dashboard.welcomeTitle': 'سلام مهندس',
  'dashboard.lead1':
    'FACTORY MANAGER برنامه محلی برنامه‌ریزی کارخانه Satisfactory است: فهرست، زنجیره تولید و طرح انرژی — همه روی PC بدون حساب یا ابر.',
  'dashboard.lead2':
    'هدف تولید، ماشین‌ها، overclock و power shard را تنظیم کنید، استخراج از گره‌ها و مولدها با سوخت مناسب را بچینید. برنامه موجودی منابع و انرژی را زنده به‌روز می‌کند و کمبود را نشان می‌دهد.',
  'dashboard.lead3':
    'این داشبورد نمای عملیاتی است: پروژه‌های اخیر، هشدارها، اهداف تولید و ترکیب مولدها — قبل از باز کردن تولید یا انرژی.',
  'dashboard.kpiProductionChains': 'زنجیره‌های تولید',
  'dashboard.kpiEnergyPlans': 'طرح‌های انرژی',
  'resources.title': 'منابع',
  'production.title': 'تولید',
  'production.subtitle': 'طرح‌های تولید خود را بسازید و مدیریت کنید.',
  'energy.title': 'انرژی',
  'energy.subtitle': 'طرح‌های تولید انرژی را بسازید و مدیریت کنید.',
  'settings.title': 'تنظیمات',
  'footer.disclaimer':
    'Factory Manager ابزار fan-made غیررسمی برای برنامه‌ریزی تولید Satisfactory است. وابسته یا مجاز Coffee Stain Studios نیست. محتوای Satisfactory متعلق به Coffee Stain Studios AB و/یا دارندگان حق است.',
  'modals.confirmTitle': 'تأیید',
  'errors.nameRequired': 'نام الزامی است.',
  'picker.noResources': 'منبعی یافت نشد.',
});

// Fill gaps from English where still Thai (from th clone)
function finalize(obj) {
  for (const k of keys) {
    if (!obj[k] || /[\u0E00-\u0E7F]/.test(obj[k])) {
      obj[k] = en[k];
    }
  }
  return obj;
}

finalize(he);
finalize(fa);

const dir = __dirname;
fs.writeFileSync(path.join(dir, 'he.js'), `module.exports = ${JSON.stringify(he, null, 2)};\n`);
fs.writeFileSync(path.join(dir, 'fa.js'), `module.exports = ${JSON.stringify(fa, null, 2)};\n`);
console.log('he.js and fa.js written');

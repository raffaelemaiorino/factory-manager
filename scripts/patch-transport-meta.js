/**
 * Patch metaOutbound / metaReturn (e cardVehicles) sulle lingue SHORT.
 * Uso: node scripts/patch-transport-meta.js
 */
const fs = require('fs');
const path = require('path');
const { deepMerge } = require('../src/locales/ui');

const UI = path.join(__dirname, '../src/locales/ui');

const META = {
  nl: {
    metaOutbound: '{minutes} min heen',
    metaReturn: '{minutes} min terug',
    metaOneWay: '{minutes} min heen',
    cardVehicles: 'Benodigde voertuigen',
  },
  pt: {
    metaOutbound: '{minutes} min ida',
    metaReturn: '{minutes} min volta',
    metaOneWay: '{minutes} min ida',
    cardVehicles: 'Veículos necessários',
  },
  pl: {
    metaOutbound: '{minutes} min w tę stronę',
    metaReturn: '{minutes} min powrót',
    metaOneWay: '{minutes} min w tę stronę',
    cardVehicles: 'Potrzebne pojazdy',
    outboundMinutes: 'Czas tam (min)',
  },
  ru: {
    metaOutbound: '{minutes} мин туда',
    metaReturn: '{minutes} мин обратно',
    metaOneWay: '{minutes} мин туда',
    cardVehicles: 'Нужные машины',
  },
  uk: {
    metaOutbound: '{minutes} хв туди',
    metaReturn: '{minutes} хв назад',
    metaOneWay: '{minutes} хв туди',
    cardVehicles: 'Потрібні машини',
  },
  cs: {
    metaOutbound: '{minutes} min tam',
    metaReturn: '{minutes} min zpět',
    metaOneWay: '{minutes} min tam',
    cardVehicles: 'Potřebná vozidla',
  },
  sk: {
    metaOutbound: '{minutes} min tam',
    metaReturn: '{minutes} min späť',
    metaOneWay: '{minutes} min tam',
    cardVehicles: 'Potrebné vozidlá',
  },
  hu: {
    metaOutbound: '{minutes} perc oda',
    metaReturn: '{minutes} perc vissza',
    metaOneWay: '{minutes} perc oda',
    cardVehicles: 'Szükséges járművek',
  },
  sv: {
    metaOutbound: '{minutes} min dit',
    metaReturn: '{minutes} min tillbaka',
    metaOneWay: '{minutes} min dit',
    cardVehicles: 'Behövda fordon',
  },
  da: {
    metaOutbound: '{minutes} min ud',
    metaReturn: '{minutes} min tilbage',
    metaOneWay: '{minutes} min ud',
    cardVehicles: 'Nødvendige køretøjer',
  },
  no: {
    metaOutbound: '{minutes} min ut',
    metaReturn: '{minutes} min tilbake',
    metaOneWay: '{minutes} min ut',
    cardVehicles: 'Nødvendige kjøretøy',
  },
  fi: {
    metaOutbound: '{minutes} min meno',
    metaReturn: '{minutes} min paluu',
    metaOneWay: '{minutes} min meno',
    cardVehicles: 'Tarvittavat ajoneuvot',
  },
  tr: {
    metaOutbound: '{minutes} dk gidiş',
    metaReturn: '{minutes} dk dönüş',
    metaOneWay: '{minutes} dk gidiş',
    cardVehicles: 'Gerekli araçlar',
  },
  ja: {
    metaOutbound: '行き {minutes} 分',
    metaReturn: '帰り {minutes} 分',
    metaOneWay: '片道 {minutes} 分',
    cardVehicles: '必要車両',
  },
  ko: {
    metaOutbound: '가는 길 {minutes}분',
    metaReturn: '오는 길 {minutes}분',
    metaOneWay: '편도 {minutes}분',
    cardVehicles: '필요 차량',
  },
  zh: {
    metaOutbound: '去程 {minutes} 分钟',
    metaReturn: '回程 {minutes} 分钟',
    metaOneWay: '单程 {minutes} 分钟',
    cardVehicles: '所需载具',
  },
  th: {
    metaOutbound: 'ขาไป {minutes} นาที',
    metaReturn: 'ขากลับ {minutes} นาที',
    metaOneWay: 'ขาเดียว {minutes} นาที',
    cardVehicles: 'ยานพาหนะที่ต้องใช้',
  },
  ar: {
    metaOutbound: '{minutes} د ذهاب',
    metaReturn: '{minutes} د إياب',
    metaOneWay: '{minutes} د ذهاب',
    cardVehicles: 'المركبات المطلوبة',
  },
  he: {
    metaOutbound: '{minutes} דק׳ הלוך',
    metaReturn: '{minutes} דק׳ חזור',
    metaOneWay: '{minutes} דק׳ הלוך',
    cardVehicles: 'רכבים נדרשים',
  },
  fa: {
    metaOutbound: '{minutes} دقیقه رفت',
    metaReturn: '{minutes} دقیقه برگشت',
    metaOneWay: '{minutes} دقیقه رفت',
    cardVehicles: 'وسایل لازم',
  },
};

const EXTRA = {
  de: {
    transport: {
      oneWayHint: 'Nur eine Strecke. Die Gesamtfahrtzeit in der Berechnung ist das Doppelte.',
    },
  },
  it: {
    transport: {
      cardMixShort: 'misto',
    },
  },
};

for (const [code, meta] of Object.entries(META)) {
  const file = path.join(UI, `${code}.json`);
  const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
  const next = deepMerge(cur, { transport: meta });
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log('patched', code);
}

for (const [code, overlay] of Object.entries(EXTRA)) {
  const file = path.join(UI, `${code}.json`);
  const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
  const next = deepMerge(cur, overlay);
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log('extra', code);
}

console.log('Done.');

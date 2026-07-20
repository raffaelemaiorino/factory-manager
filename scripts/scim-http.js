const https = require('https');
const { URL } = require('url');

function fetchUrl(url, redirectCount = 0, asText = true) {
  if (redirectCount > 5) {
    return Promise.reject(new Error(`Troppi redirect per ${url}`));
  }

  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'FactoryManager/0.1' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = new URL(res.headers.location, url).href;
          fetchUrl(nextUrl, redirectCount + 1, asText).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }

        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(asText ? buffer.toString('utf8') : buffer);
        });
      })
      .on('error', reject);
  });
}

function fetchBinary(url) {
  return fetchUrl(url, 0, false);
}

function slugifyItemName(name) {
  return encodeURIComponent(name.trim()).replace(/%20/g, '+');
}

function buildItemDetailUrl(gameId, name) {
  return `https://satisfactory-calculator.com/it/items/detail/id/${gameId}/name/${slugifyItemName(name)}`;
}

module.exports = { fetchUrl, fetchBinary, slugifyItemName, buildItemDetailUrl };

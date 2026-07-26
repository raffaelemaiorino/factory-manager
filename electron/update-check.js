/**
 * Controllo aggiornamenti via GitHub Releases (solo notifica, niente download auto).
 */
const GITHUB_OWNER = 'raffaelemaiorino';
const GITHUB_REPO = 'factory-manager';
const RELEASES_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const ALLOWED_HOST = 'github.com';
const ALLOWED_PATH_PREFIX = `/${GITHUB_OWNER}/${GITHUB_REPO}/`;
const FETCH_TIMEOUT_MS = 8000;

function normalizeVersion(raw) {
  const s = String(raw ?? '')
    .trim()
    .replace(/^v/i, '');
  const match = s.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    text: `${match[1]}.${match[2]}.${match[3]}`,
  };
}

function compareVersions(a, b) {
  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
  return 0;
}

function isAllowedReleaseUrl(url) {
  try {
    const parsed = new URL(String(url ?? ''));
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname !== ALLOWED_HOST && parsed.hostname !== `www.${ALLOWED_HOST}`) {
      return false;
    }
    return parsed.pathname.startsWith(ALLOWED_PATH_PREFIX);
  } catch {
    return false;
  }
}

async function fetchLatestRelease() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(RELEASES_API, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Factory-Manager-Update-Check',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) {
      return { ok: false, reason: `http_${res.status}` };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'timeout' : 'network';
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} currentVersion
 * @returns {Promise<{
 *   updateAvailable: boolean,
 *   currentVersion: string,
 *   latestVersion?: string,
 *   releaseName?: string,
 *   htmlUrl?: string,
 *   reason?: string
 * }>}
 */
async function checkForAppUpdate(currentVersion) {
  const current = normalizeVersion(currentVersion);
  if (!current) {
    return { updateAvailable: false, currentVersion: String(currentVersion ?? ''), reason: 'bad_current' };
  }

  const fetched = await fetchLatestRelease();
  if (!fetched.ok) {
    return { updateAvailable: false, currentVersion: current.text, reason: fetched.reason };
  }

  const tag = fetched.data?.tag_name ?? fetched.data?.name ?? '';
  const latest = normalizeVersion(tag);
  if (!latest) {
    return { updateAvailable: false, currentVersion: current.text, reason: 'bad_latest' };
  }

  if (fetched.data?.prerelease || fetched.data?.draft) {
    return { updateAvailable: false, currentVersion: current.text, reason: 'prerelease' };
  }

  const htmlUrl = String(fetched.data?.html_url ?? '');
  if (!isAllowedReleaseUrl(htmlUrl)) {
    return { updateAvailable: false, currentVersion: current.text, reason: 'bad_url' };
  }

  const newer = compareVersions(latest, current) > 0;
  if (!newer) {
    return {
      updateAvailable: false,
      currentVersion: current.text,
      latestVersion: latest.text,
      reason: 'up_to_date',
    };
  }

  return {
    updateAvailable: true,
    currentVersion: current.text,
    latestVersion: latest.text,
    releaseName: String(fetched.data?.name || `Factory Manager ${latest.text}`),
    htmlUrl,
  };
}

module.exports = {
  checkForAppUpdate,
  isAllowedReleaseUrl,
  normalizeVersion,
  compareVersions,
};

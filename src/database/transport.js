/** Conveyor belt / pipeline capacities (items or m³ per minute). */

const BELT_RATES_BY_MK = {
  1: 60,
  2: 120,
  3: 270,
  4: 480,
  5: 780,
  6: 1200,
};

const PIPE_RATES_BY_MK = {
  1: 300,
  2: 600,
};

const DEFAULT_MAX_BELT_MK = 6;
const DEFAULT_MAX_PIPE_MK = 2;
/** -1 = unlimited power shards; 0 = none (100% OC only). */
const DEFAULT_POWER_SHARD_LIMIT = 0;
const POWER_SHARD_UNLIMITED = -1;

function clampBeltMk(value, fallback = DEFAULT_MAX_BELT_MK) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(6, Math.max(1, n));
}

function clampPipeMk(value, fallback = DEFAULT_MAX_PIPE_MK) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(2, Math.max(1, n));
}

function parsePowerShardLimit(value, fallback = DEFAULT_POWER_SHARD_LIMIT) {
  if (value === '' || value == null) return fallback;
  if (value === 'unlimited' || value === 'Unlimited') return POWER_SHARD_UNLIMITED;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return POWER_SHARD_UNLIMITED;
  return Math.min(100000, n);
}

function isPowerShardUnlimited(limit) {
  return parsePowerShardLimit(limit, POWER_SHARD_UNLIMITED) < 0;
}

function getBeltRate(mk) {
  return BELT_RATES_BY_MK[clampBeltMk(mk)] ?? BELT_RATES_BY_MK[DEFAULT_MAX_BELT_MK];
}

function getPipeRate(mk) {
  return PIPE_RATES_BY_MK[clampPipeMk(mk)] ?? PIPE_RATES_BY_MK[DEFAULT_MAX_PIPE_MK];
}

function describeTransportNeed(rate, { isFluid = false, maxBeltMk = DEFAULT_MAX_BELT_MK, maxPipeMk = DEFAULT_MAX_PIPE_MK } = {}) {
  const amount = Number(rate) || 0;
  const mk = isFluid ? clampPipeMk(maxPipeMk) : clampBeltMk(maxBeltMk);
  const capacity = isFluid ? getPipeRate(mk) : getBeltRate(mk);
  const count = capacity > 0 ? Math.max(1, Math.ceil(amount / capacity - 1e-9)) : 1;
  const fitsOnOne = amount <= capacity + 1e-9;
  return {
    isFluid: Boolean(isFluid),
    mk,
    capacity,
    count,
    rate: amount,
    over: !fitsOnOne,
  };
}

module.exports = {
  BELT_RATES_BY_MK,
  PIPE_RATES_BY_MK,
  DEFAULT_MAX_BELT_MK,
  DEFAULT_MAX_PIPE_MK,
  DEFAULT_POWER_SHARD_LIMIT,
  POWER_SHARD_UNLIMITED,
  clampBeltMk,
  clampPipeMk,
  parsePowerShardLimit,
  isPowerShardUnlimited,
  getBeltRate,
  getPipeRate,
  describeTransportNeed,
};

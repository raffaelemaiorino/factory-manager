const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getBeltRate,
  getPipeRate,
  describeTransportNeed,
  parsePowerShardLimit,
  isPowerShardUnlimited,
  clampBeltMk,
  clampPipeMk,
  POWER_SHARD_UNLIMITED,
} = require('../src/database/transport');

describe('transport', () => {
  it('belt / pipe capacities by Mk', () => {
    assert.equal(getBeltRate(1), 60);
    assert.equal(getBeltRate(5), 780);
    assert.equal(getBeltRate(6), 1200);
    assert.equal(getPipeRate(1), 300);
    assert.equal(getPipeRate(2), 600);
  });

  it('clamps invalid Mk values', () => {
    assert.equal(clampBeltMk(0), 1);
    assert.equal(clampBeltMk(99), 6);
    assert.equal(clampPipeMk(0), 1);
    assert.equal(clampPipeMk(9), 2);
  });

  it('describeTransportNeed splits when rate exceeds capacity', () => {
    const one = describeTransportNeed(60, { maxBeltMk: 1 });
    assert.equal(one.count, 1);
    assert.equal(one.over, false);

    const split = describeTransportNeed(121, { maxBeltMk: 1 });
    assert.equal(split.capacity, 60);
    assert.equal(split.count, 3);
    assert.equal(split.over, true);

    const pipe = describeTransportNeed(601, { isFluid: true, maxPipeMk: 1 });
    assert.equal(pipe.capacity, 300);
    assert.equal(pipe.count, 3);
    assert.equal(pipe.over, true);
  });

  it('power shard limit: 0 default, negative = unlimited', () => {
    assert.equal(parsePowerShardLimit(0), 0);
    assert.equal(parsePowerShardLimit(undefined), 0);
    assert.equal(parsePowerShardLimit(-1), POWER_SHARD_UNLIMITED);
    assert.equal(parsePowerShardLimit('unlimited'), POWER_SHARD_UNLIMITED);
    assert.equal(isPowerShardUnlimited(0), false);
    assert.equal(isPowerShardUnlimited(-1), true);
  });
});

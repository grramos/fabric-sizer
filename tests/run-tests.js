import assert from 'node:assert/strict';
import {
  calculateClos3,
  calculateClos5,
  calculateDragonflyPlus,
} from '../public/app/calculators.js';

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('3-stage Clos leaf and spine counts', () => {
  const result = calculateClos3({
    topology: 'clos3',
    totalHosts: 1024,
    hostsPerPod: 256,
    nicsPerHost: 1,
    leaf: { totalPorts: 32, hostPorts: 24, fabricPorts: 8 },
    spine: { totalPorts: 32, downlinkPorts: 32 },
  });
  assert.equal(result.switchCounts.leaves, 44);
  assert.equal(result.switchCounts.spines, 11);
  assert.equal(result.fiberCounts.leafToSpineTotal, 352);
});

test('3-stage Clos fiber totals scale with NIC count', () => {
  const result = calculateClos3({
    topology: 'clos3',
    totalHosts: 512,
    hostsPerPod: 128,
    nicsPerHost: 2,
    leaf: { totalPorts: 48, hostPorts: 32, fabricPorts: 16 },
    spine: { totalPorts: 64, downlinkPorts: 64 },
  });
  assert.equal(result.fiberCounts.hostToLeafTotal, 1024);
  assert.equal(result.fiberCounts.leafToSpineTotal, 512);
});

test('5-stage Clos super-spine counts', () => {
  const result = calculateClos5({
    topology: 'clos5',
    totalHosts: 1024,
    hostsPerPod: 256,
    nicsPerHost: 1,
    leaf: { totalPorts: 32, hostPorts: 24, fabricPorts: 8 },
    spine: { totalPorts: 32, downlinkPorts: 24, uplinkPorts: 8 },
    superSpine: { totalPorts: 64, downlinkPorts: 64 },
  });
  assert.equal(result.switchCounts.spines, 16);
  assert.equal(result.switchCounts.superSpines, 2);
  assert.equal(result.fiberCounts.spineToSuperTotal, 128);
});

test('5-stage Clos oversubscription adjusts fabric ports', () => {
  const result = calculateClos5({
    topology: 'clos5',
    totalHosts: 256,
    hostsPerPod: 128,
    nicsPerHost: 1,
    leaf: { totalPorts: 40, hostPorts: 24, fabricPorts: 8 },
    spine: { totalPorts: 32, downlinkPorts: 16, uplinkPorts: 8 },
    superSpine: { totalPorts: 48, downlinkPorts: 48 },
    oversubscription: '2:1',
  });
  assert.equal(result.fiberCounts.leafToSpinePerPod, 72);
  assert.equal(result.switchCounts.spines, 10);
});

test('Dragonfly+ group counts and inter-group links', () => {
  const result = calculateDragonflyPlus({
    topology: 'dragonflyPlus',
    totalHosts: 384,
    hostsPerPod: 192,
    nicsPerHost: 1,
    leaf: { totalPorts: 32, hostPorts: 24, fabricPorts: 8 },
    spine: { totalPorts: 48, downlinkPorts: 32 },
    dragonflyPlus: {
      leavesPerGroup: 4,
      spinesPerGroup: 3,
      intraGroupDegree: 4,
      interGroupDegree: 2,
    },
  });
  assert.equal(result.metadata.groups, 4);
  assert.equal(result.fiberCounts.interGroupTotal, 12);
});

test('Dragonfly+ rejects impossible intra-group degree', () => {
  assert.throws(() =>
    calculateDragonflyPlus({
      topology: 'dragonflyPlus',
      totalHosts: 64,
      hostsPerPod: 64,
      nicsPerHost: 1,
      leaf: { totalPorts: 24, hostPorts: 16, fabricPorts: 4 },
      spine: { totalPorts: 32, downlinkPorts: 16 },
      dragonflyPlus: {
        leavesPerGroup: 2,
        spinesPerGroup: 2,
        intraGroupDegree: 6,
        interGroupDegree: 2,
      },
    }),
  );
});

async function run() {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✅ ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`❌ ${name}`);
      console.error(error);
    }
  }
  if (failed > 0) {
    process.exitCode = 1;
  }
}

run();

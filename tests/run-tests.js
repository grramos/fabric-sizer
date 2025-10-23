import assert from 'node:assert/strict';
import {
  calculateClos3,
  calculateClos5,
  calculateDragonflyPlus,
  calculateMultiPlane,
} from '../public/app/calculators.js';

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('3-stage Clos counts derived from radix', () => {
  const result = calculateClos3({
    topology: 'clos3',
    totalHosts: 1024,
    hostsPerPod: 256,
    switchRadix: 32,
  });
  assert.equal(result.switchCounts.leaves, 64);
  assert.equal(result.switchCounts.spines, 32);
  assert.equal(result.switchCounts.total, 96);
});

test('5-stage Clos introduces super-spines', () => {
  const result = calculateClos5({
    topology: 'clos5',
    totalHosts: 1024,
    hostsPerPod: 256,
    switchRadix: 32,
  });
  assert.equal(result.switchCounts.leaves, 64);
  assert.equal(result.switchCounts.spines, 64);
  assert.equal(result.switchCounts.superSpines, 32);
  assert.equal(result.switchCounts.total, 160);
});

test('Dragonfly+ mirrors group sizing assumptions', () => {
  const result = calculateDragonflyPlus({
    topology: 'dragonflyPlus',
    totalHosts: 1024,
    hostsPerPod: 256,
    switchRadix: 32,
  });
  assert.equal(result.switchCounts.leaves, 64);
  assert.equal(result.switchCounts.spines, 64);
});

test('Multi-plane duplicates Clos fabrics across planes', () => {
  const result = calculateMultiPlane({
    topology: 'multiPlane',
    totalHosts: 1024,
    hostsPerPod: 256,
    switchRadix: 32,
  });
  assert.equal(result.switchCounts.leaves, 128);
  assert.equal(result.switchCounts.spines, 64);
  assert.equal(result.switchCounts.total, 192);
});

test('Hosts per pod of zero falls back to single pod', () => {
  const result = calculateClos3({
    topology: 'clos3',
    totalHosts: 64,
    hostsPerPod: 0,
    switchRadix: 32,
  });
  assert.equal(result.metadata.pods, 1);
  assert.equal(result.switchCounts.leaves, 4);
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

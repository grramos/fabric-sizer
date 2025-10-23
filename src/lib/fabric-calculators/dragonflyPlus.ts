import {
  baseMetadata,
  derivePodCount,
  ensureEvenRadix,
  fabricPortsPerLeaf,
  hostsPerLeaf,
  makeResultSkeleton,
  normalizeHostsPerPod,
  pushAssumption,
} from './common';
import type { Inputs, SizingResult } from './types';

export function calculate(inputs: Inputs): SizingResult {
  ensureEvenRadix(inputs.switchRadix);

  const result = makeResultSkeleton();
  const assumptions = result.assumptions;
  const metadata = baseMetadata(inputs);

  const hostsPerLeafValue = hostsPerLeaf(inputs.switchRadix);
  metadata.hostsPerLeaf = hostsPerLeafValue;
  pushAssumption(
    assumptions,
    'Hosts per leaf',
    `${inputs.switchRadix} total ports, half allocated to hosts = ${hostsPerLeafValue} hosts per leaf.`,
  );

  const normalizedHostsPerGroup = normalizeHostsPerPod(inputs.totalHosts, inputs.hostsPerPod);
  const groups = derivePodCount(inputs.totalHosts, normalizedHostsPerGroup);
  metadata.groups = groups;
  pushAssumption(
    assumptions,
    'Groups required',
    `ceil(${inputs.totalHosts} / ${normalizedHostsPerGroup}) = ${groups} groups.`,
  );

  const leavesPerGroup = Math.max(1, Math.ceil(normalizedHostsPerGroup / hostsPerLeafValue));
  metadata.leavesPerGroup = leavesPerGroup;
  pushAssumption(
    assumptions,
    'Leaves per group',
    `ceil(${normalizedHostsPerGroup} / ${hostsPerLeafValue}) = ${leavesPerGroup} leaves per group.`,
  );

  const fabricPerLeaf = fabricPortsPerLeaf(inputs.switchRadix);
  const spineDownCapacity = hostsPerLeaf(inputs.switchRadix);
  const leafToSpineWithinGroup = leavesPerGroup * fabricPerLeaf;
  const spinesPerGroup = Math.max(1, Math.ceil(leafToSpineWithinGroup / spineDownCapacity));
  metadata.spinesPerGroup = spinesPerGroup;
  pushAssumption(
    assumptions,
    'Spines per group',
    `ceil(${leafToSpineWithinGroup} / ${spineDownCapacity}) = ${spinesPerGroup} spines per group.`,
  );

  const totalLeaves = leavesPerGroup * groups;
  const totalSpines = spinesPerGroup * groups;
  metadata.totalLeaves = totalLeaves;
  metadata.totalSpines = totalSpines;

  result.switchCounts = {
    leaves: totalLeaves,
    spines: totalSpines,
    total: totalLeaves + totalSpines,
  };
  result.metadata = metadata;

  return result;
}

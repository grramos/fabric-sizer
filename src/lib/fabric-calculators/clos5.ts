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

  const normalizedHostsPerPod = normalizeHostsPerPod(inputs.totalHosts, inputs.hostsPerPod);
  const podCount = derivePodCount(inputs.totalHosts, normalizedHostsPerPod);
  metadata.pods = podCount;
  pushAssumption(
    assumptions,
    'Pods required',
    `ceil(${inputs.totalHosts} / ${normalizedHostsPerPod}) = ${podCount} pods.`,
  );

  const leavesPerPod = Math.max(1, Math.ceil(normalizedHostsPerPod / hostsPerLeafValue));
  metadata.leavesPerPod = leavesPerPod;
  pushAssumption(
    assumptions,
    'Leaves per pod',
    `ceil(${normalizedHostsPerPod} / ${hostsPerLeafValue}) = ${leavesPerPod} leaves per pod.`,
  );

  const totalLeaves = leavesPerPod * podCount;
  metadata.totalLeaves = totalLeaves;

  const leafFabricPerPod = leavesPerPod * fabricPortsPerLeaf(inputs.switchRadix);
  const downCapacityPerSpine = hostsPerLeaf(inputs.switchRadix);
  const spinesPerPod = Math.max(1, Math.ceil(leafFabricPerPod / downCapacityPerSpine));
  metadata.spinesPerPod = spinesPerPod;
  pushAssumption(
    assumptions,
    'Spines per pod',
    `ceil(${leafFabricPerPod} / ${downCapacityPerSpine}) = ${spinesPerPod} spine switches per pod.`,
  );

  const totalSpines = spinesPerPod * podCount;
  metadata.totalSpines = totalSpines;

  const uplinksPerSpine = fabricPortsPerLeaf(inputs.switchRadix);
  const totalSpineUplinks = totalSpines * uplinksPerSpine;
  const superSpines = Math.max(1, Math.ceil(totalSpineUplinks / inputs.switchRadix));
  metadata.totalSpineToSuperLinks = totalSpineUplinks;
  pushAssumption(
    assumptions,
    'Super-spines required',
    `ceil(${totalSpineUplinks} / ${inputs.switchRadix}) = ${superSpines} super-spine switches.`,
  );

  result.switchCounts = {
    leaves: totalLeaves,
    spines: totalSpines,
    superSpines,
    total: totalLeaves + totalSpines + superSpines,
  };
  result.metadata = metadata;

  return result;
}

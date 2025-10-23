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

  const fabricPerLeaf = fabricPortsPerLeaf(inputs.switchRadix);
  const totalLeafFabricConnections = totalLeaves * fabricPerLeaf;
  metadata.totalLeafToSpineLinks = totalLeafFabricConnections;

  const spinesRequired = Math.max(1, Math.ceil(totalLeafFabricConnections / inputs.switchRadix));
  pushAssumption(
    assumptions,
    'Spines required',
    `ceil(${totalLeafFabricConnections} / ${inputs.switchRadix}) = ${spinesRequired} spine switches.`,
  );

  result.switchCounts = {
    leaves: totalLeaves,
    spines: spinesRequired,
    total: totalLeaves + spinesRequired,
  };
  result.metadata = metadata;

  return result;
}

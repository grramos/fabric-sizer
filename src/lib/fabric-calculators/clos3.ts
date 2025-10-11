import type { Inputs, SizingResult } from './types';
import {
  buildBaseMetadata,
  derivePodCount,
  hostCapacityPerLeaf,
  makeResultSkeleton,
  resolveFabricPorts,
  validateLeafConfig,
} from './common';

export function calculate(inputs: Inputs): SizingResult {
  validateLeafConfig(inputs.leaf);
  const result = makeResultSkeleton();
  const metadata = buildBaseMetadata(inputs);
  const assumptions = result.assumptions;

  const podCount = derivePodCount(inputs.totalHosts, inputs.hostsPerPod);
  metadata.pods = podCount;
  assumptions.push({
    label: 'Pods required',
    description: `ceil(${inputs.totalHosts} / ${inputs.hostsPerPod}) = ${podCount} pods.`,
  });

  const perLeafHostCapacity = hostCapacityPerLeaf(inputs.leaf, inputs.nicsPerHost);
  if (perLeafHostCapacity <= 0) {
    throw new Error('Leaf host port allocation does not allow any hosts per leaf.');
  }
  metadata.hostsPerLeaf = perLeafHostCapacity;
  assumptions.push({
    label: 'Hosts per leaf',
    description: `floor(${inputs.leaf.hostPorts} / ${inputs.nicsPerHost}) = ${perLeafHostCapacity} hosts per leaf.`,
  });

  const leavesPerPod = Math.ceil(inputs.hostsPerPod / perLeafHostCapacity);
  metadata.leavesPerPod = leavesPerPod;
  assumptions.push({
    label: 'Leaves per pod',
    description: `ceil(${inputs.hostsPerPod} / ${perLeafHostCapacity}) = ${leavesPerPod} leaves per pod.`,
  });

  const totalLeaves = leavesPerPod * podCount;

  const oversubResolved = resolveFabricPorts(inputs.leaf, inputs.oversubscription);
  if (oversubResolved.assumption) {
    assumptions.push(oversubResolved.assumption);
  }
  const fabricPortsPerLeaf = oversubResolved.fabricPorts;
  if (inputs.leaf.hostPorts + fabricPortsPerLeaf > inputs.leaf.totalPorts) {
    throw new Error('Oversubscription-derived fabric ports exceed leaf total port count.');
  }

  const totalLeafFabricConnections = totalLeaves * fabricPortsPerLeaf;
  const leafToSpinePerPod = leavesPerPod * fabricPortsPerLeaf;

  const spinesRequired = Math.ceil(totalLeafFabricConnections / inputs.spine.downlinkPorts);
  if (!Number.isFinite(spinesRequired) || spinesRequired <= 0) {
    throw new Error('Invalid spine configuration, unable to service leaf uplinks.');
  }
  assumptions.push({
    label: 'Spines required',
    description: `ceil(${totalLeafFabricConnections} / ${inputs.spine.downlinkPorts}) = ${spinesRequired} spine switches.`,
  });

  const hostToLeafPerPod = inputs.hostsPerPod * inputs.nicsPerHost;
  const hostToLeafTotal = inputs.totalHosts * inputs.nicsPerHost;

  result.switchCounts = {
    leaves: totalLeaves,
    spines: spinesRequired,
    total: totalLeaves + spinesRequired,
  };

  result.fiberCounts = {
    hostToLeafPerPod,
    hostToLeafTotal,
    leafToSpinePerPod,
    leafToSpineTotal: totalLeafFabricConnections,
  };

  metadata.totalLeaves = totalLeaves;
  metadata.totalLeafToSpineLinks = totalLeafFabricConnections;

  result.metadata = metadata;
  return result;
}

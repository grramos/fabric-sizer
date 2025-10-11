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
  if (!inputs.superSpine) {
    throw new Error('5-stage Clos sizing requires a super-spine definition.');
  }
  if (!inputs.spine.uplinkPorts) {
    throw new Error('Spine uplink port count is required for 5-stage Clos calculations.');
  }

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

  const leafToSpinePerPod = leavesPerPod * fabricPortsPerLeaf;
  const totalLeafFabricConnections = leafToSpinePerPod * podCount;

  const spinesPerPod = Math.ceil(leafToSpinePerPod / inputs.spine.downlinkPorts);
  assumptions.push({
    label: 'Spines per pod',
    description: `ceil(${leafToSpinePerPod} / ${inputs.spine.downlinkPorts}) = ${spinesPerPod} spine switches per pod.`,
  });
  const totalSpines = spinesPerPod * podCount;

  const spineToSuperPerPod = spinesPerPod * inputs.spine.uplinkPorts;
  const totalSpineToSuper = spineToSuperPerPod * podCount;

  const superSpinesRequired = Math.ceil(totalSpineToSuper / inputs.superSpine.downlinkPorts);
  assumptions.push({
    label: 'Super-spines required',
    description: `ceil(${totalSpineToSuper} / ${inputs.superSpine.downlinkPorts}) = ${superSpinesRequired} super-spine switches.`,
  });

  const hostToLeafPerPod = inputs.hostsPerPod * inputs.nicsPerHost;
  const hostToLeafTotal = inputs.totalHosts * inputs.nicsPerHost;

  result.switchCounts = {
    leaves: totalLeaves,
    spines: totalSpines,
    superSpines: superSpinesRequired,
    total: totalLeaves + totalSpines + superSpinesRequired,
  };

  result.fiberCounts = {
    hostToLeafPerPod,
    hostToLeafTotal,
    leafToSpinePerPod,
    leafToSpineTotal: totalLeafFabricConnections,
    spineToSuperPerPod,
    spineToSuperTotal: totalSpineToSuper,
  };

  metadata.totalLeaves = totalLeaves;
  metadata.spinesPerPod = spinesPerPod;
  metadata.totalSpines = totalSpines;
  metadata.totalLeafToSpineLinks = totalLeafFabricConnections;
  metadata.totalSpineToSuperLinks = totalSpineToSuper;

  result.metadata = metadata;
  return result;
}

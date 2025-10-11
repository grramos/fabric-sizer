import type { Inputs, SizingResult } from './types';
import {
  buildBaseMetadata,
  hostCapacityPerLeaf,
  makeResultSkeleton,
  resolveFabricPorts,
  validateLeafConfig,
} from './common';

export function calculate(inputs: Inputs): SizingResult {
  if (!inputs.dragonflyPlus) {
    throw new Error('Dragonfly+ sizing requires dragonflyPlus configuration values.');
  }

  validateLeafConfig(inputs.leaf);
  const cfg = inputs.dragonflyPlus;
  const result = makeResultSkeleton();
  const metadata = buildBaseMetadata(inputs);
  const assumptions = result.assumptions;

  const perLeafHostCapacity = hostCapacityPerLeaf(inputs.leaf, inputs.nicsPerHost);
  if (perLeafHostCapacity <= 0) {
    throw new Error('Leaf host port allocation does not allow any hosts per leaf.');
  }
  metadata.hostsPerLeaf = perLeafHostCapacity;
  assumptions.push({
    label: 'Hosts per leaf',
    description: `floor(${inputs.leaf.hostPorts} / ${inputs.nicsPerHost}) = ${perLeafHostCapacity} hosts per leaf.`,
  });

  const hostsPerGroupCapacity = perLeafHostCapacity * cfg.leavesPerGroup;
  const groupsRequired = Math.max(1, Math.ceil(inputs.totalHosts / hostsPerGroupCapacity));
  metadata.groups = groupsRequired;
  assumptions.push({
    label: 'Groups required',
    description: `ceil(${inputs.totalHosts} / ${hostsPerGroupCapacity}) = ${groupsRequired} groups.`,
  });

  const oversubResolved = resolveFabricPorts(inputs.leaf, inputs.oversubscription);
  if (oversubResolved.assumption) {
    assumptions.push(oversubResolved.assumption);
  }
  const fabricPortsPerLeaf = oversubResolved.fabricPorts;
  if (fabricPortsPerLeaf < cfg.intraGroupDegree) {
    throw new Error('Intra-group degree exceeds available fabric ports per leaf.');
  }

  const totalLeaves = cfg.leavesPerGroup * groupsRequired;
  const totalSpines = cfg.spinesPerGroup * groupsRequired;

  const hostToLeafPerGroup = Math.min(inputs.hostsPerPod, hostsPerGroupCapacity) * inputs.nicsPerHost;
  const hostToLeafTotal = inputs.totalHosts * inputs.nicsPerHost;

  const leafToSpinePerGroup = cfg.leavesPerGroup * cfg.intraGroupDegree;
  const leafToSpineTotal = leafToSpinePerGroup * groupsRequired;

  const interGroupLinksRaw = groupsRequired * cfg.spinesPerGroup * cfg.interGroupDegree;
  const interGroupUnique = Math.ceil(interGroupLinksRaw / 2);
  assumptions.push({
    label: 'Inter-group links deduplicated',
    description: `Each of ${groupsRequired} groups contributes ${cfg.spinesPerGroup} spines with ${cfg.interGroupDegree} links; total ${interGroupLinksRaw} endpoints, divided by 2 and rounded up = ${interGroupUnique} unique links.`,
  });

  result.switchCounts = {
    leaves: totalLeaves,
    spines: totalSpines,
    total: totalLeaves + totalSpines,
  };

  result.fiberCounts = {
    hostToLeafPerPod: hostToLeafPerGroup,
    hostToLeafTotal,
    leafToSpinePerPod: leafToSpinePerGroup,
    leafToSpineTotal,
    interGroupPerGroup: cfg.spinesPerGroup * cfg.interGroupDegree,
    interGroupTotal: interGroupUnique,
  };

  metadata.leavesPerGroup = cfg.leavesPerGroup;
  metadata.spinesPerGroup = cfg.spinesPerGroup;
  metadata.totalLeaves = totalLeaves;
  metadata.totalSpines = totalSpines;
  metadata.totalLeafToSpineLinks = leafToSpineTotal;
  metadata.totalInterGroupLinks = interGroupUnique;

  result.metadata = metadata;
  return result;
}

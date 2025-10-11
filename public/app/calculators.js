function resolveFabricPorts(leaf, oversubscription) {
  if (!oversubscription || oversubscription === '1:1') {
    return { fabricPorts: leaf.fabricPorts };
  }
  const ratio = Number(oversubscription.split(':')[0]);
  const derived = Math.ceil(leaf.hostPorts / ratio);
  return {
    fabricPorts: derived,
    assumption: {
      label: 'Oversubscription applied',
      description: `Fabric-facing ports derived from host ports (${leaf.hostPorts}) at ${oversubscription}, ceil(${leaf.hostPorts} / ${ratio}) = ${derived}.`,
    },
  };
}

function validateLeafConfig(leaf) {
  if (leaf.hostPorts + leaf.fabricPorts > leaf.totalPorts) {
    throw new Error('Leaf host and fabric ports exceed total ports.');
  }
}

function derivePodCount(totalHosts, hostsPerPod) {
  return Math.max(1, Math.ceil(totalHosts / hostsPerPod));
}

function hostCapacityPerLeaf(leaf, nicsPerHost) {
  return Math.floor(leaf.hostPorts / nicsPerHost);
}

function makeResultSkeleton() {
  return {
    switchCounts: { leaves: 0, spines: 0, total: 0 },
    fiberCounts: {
      hostToLeafPerPod: 0,
      hostToLeafTotal: 0,
      leafToSpinePerPod: 0,
      leafToSpineTotal: 0,
    },
    assumptions: [],
    metadata: {},
  };
}

function buildBaseMetadata(inputs) {
  return {
    totalHosts: inputs.totalHosts,
    hostsPerPod: inputs.hostsPerPod,
    nicsPerHost: inputs.nicsPerHost,
  };
}

export function calculateClos3(inputs) {
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

export function calculateClos5(inputs) {
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

export function calculateDragonflyPlus(inputs) {
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

export function calculateSizing(inputs) {
  switch (inputs.topology) {
    case 'clos3':
      return calculateClos3(inputs);
    case 'clos5':
      return calculateClos5(inputs);
    case 'dragonflyPlus':
      return calculateDragonflyPlus(inputs);
    default:
      throw new Error(`Unsupported topology: ${inputs.topology}`);
  }
}

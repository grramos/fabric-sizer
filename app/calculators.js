const DEFAULT_PLANE_COUNT = 2;

function ensureEvenRadix(radix) {
  if (radix <= 0 || radix % 2 !== 0) {
    throw new Error('Switch radix must be a positive even number.');
  }
}

function hostsPerLeaf(radix) {
  return radix / 2;
}

function fabricPortsPerLeaf(radix) {
  return radix / 2;
}

function normalizeHostsPerPod(totalHosts, hostsPerPod) {
  if (hostsPerPod <= 0) {
    return totalHosts;
  }
  return hostsPerPod;
}

function derivePodCount(totalHosts, hostsPerPod) {
  const perPod = normalizeHostsPerPod(totalHosts, hostsPerPod);
  return Math.max(1, Math.ceil(totalHosts / perPod));
}

function makeResultSkeleton() {
  return {
    switchCounts: { leaves: 0, spines: 0, total: 0 },
    assumptions: [],
    metadata: {},
  };
}

function pushAssumption(assumptions, label, description) {
  assumptions.push({ label, description });
}

function baseMetadata(inputs) {
  return {
    totalHosts: inputs.totalHosts,
    hostsPerPod: normalizeHostsPerPod(inputs.totalHosts, inputs.hostsPerPod),
    switchRadix: inputs.switchRadix,
  };
}

export function calculateClos3(inputs) {
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

  const normalizedHostsPerPod = metadata.hostsPerPod;
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

export function calculateClos5(inputs) {
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

  const normalizedHostsPerPod = metadata.hostsPerPod;
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
  metadata.totalSpineToSuperLinks = totalSpineUplinks;
  const superSpines = Math.max(1, Math.ceil(totalSpineUplinks / inputs.switchRadix));
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

export function calculateDragonflyPlus(inputs) {
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

  const normalizedHostsPerGroup = metadata.hostsPerPod;
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

export function calculateMultiPlane(inputs) {
  const perPlane = calculateClos3(inputs);
  const planeCount = DEFAULT_PLANE_COUNT;

  const leavesPerPlane = perPlane.switchCounts.leaves;
  const spinesPerPlane = perPlane.switchCounts.spines;

  const switchCounts = {
    leaves: leavesPerPlane * planeCount,
    spines: spinesPerPlane * planeCount,
    total: perPlane.switchCounts.total * planeCount,
  };

  const metadata = {
    ...perPlane.metadata,
    planeCount,
    leavesPerPlane,
    spinesPerPlane,
  };

  if (typeof perPlane.metadata.totalLeaves === 'number') {
    metadata.totalLeaves = perPlane.metadata.totalLeaves * planeCount;
  }
  if (typeof perPlane.metadata.totalLeafToSpineLinks === 'number') {
    metadata.totalLeafToSpineLinks = perPlane.metadata.totalLeafToSpineLinks * planeCount;
  }

  const assumptions = perPlane.assumptions.slice();
  assumptions.push({
    label: 'Planes',
    description: `Multi-plane fabric duplicates the Clos fabric across ${planeCount} planes.`,
  });

  return {
    switchCounts,
    assumptions,
    metadata,
  };
}

export function calculateSizing(inputs) {
  switch (inputs.topology) {
    case 'clos3':
      return calculateClos3(inputs);
    case 'clos5':
      return calculateClos5(inputs);
    case 'dragonflyPlus':
      return calculateDragonflyPlus(inputs);
    case 'multiPlane':
      return calculateMultiPlane(inputs);
    default:
      throw new Error(`Unsupported topology: ${inputs.topology}`);
  }
}

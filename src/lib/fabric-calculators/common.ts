import type {
  AssumptionDetail,
  Inputs,
  LeafSwitchConfig,
  OversubscriptionTarget,
  SizingResult,
} from './types';

/** Utility to resolve the uplink count given an oversubscription target. */
export function resolveFabricPorts(
  leaf: LeafSwitchConfig,
  oversubscription?: OversubscriptionTarget,
): { fabricPorts: number; assumption?: AssumptionDetail } {
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

/** Ensures the basic switch configuration is sane. */
export function validateLeafConfig(leaf: LeafSwitchConfig): void {
  if (leaf.hostPorts + leaf.fabricPorts > leaf.totalPorts) {
    throw new Error('Leaf host and fabric ports exceed total ports.');
  }
}

/** Determines the number of pods given the host count. */
export function derivePodCount(totalHosts: number, hostsPerPod: number): number {
  return Math.max(1, Math.ceil(totalHosts / hostsPerPod));
}

/**
 * Helper to compute per-leaf host capacity taking NICs into account.
 */
export function hostCapacityPerLeaf(leaf: LeafSwitchConfig, nicsPerHost: number): number {
  return Math.floor(leaf.hostPorts / nicsPerHost);
}

/**
 * Base structure for metadata returned from calculators.
 */
export function buildBaseMetadata(inputs: Inputs): Record<string, number | string> {
  return {
    totalHosts: inputs.totalHosts,
    hostsPerPod: inputs.hostsPerPod,
    nicsPerHost: inputs.nicsPerHost,
  };
}

/**
 * Helper to ensure we never divide by zero when computing ratios.
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    throw new Error('Invalid division by zero or negative denominator in topology sizing.');
  }
  return numerator / denominator;
}

/**
 * Creates a basic sizing result scaffold; calculators will extend this.
 */
export function makeResultSkeleton(): SizingResult {
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

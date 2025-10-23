import type { AssumptionDetail, Inputs, SizingResult } from './types';

export function ensureEvenRadix(radix: number): void {
  if (radix <= 0 || radix % 2 !== 0) {
    throw new Error('Switch radix must be a positive even number.');
  }
}

export function hostsPerLeaf(radix: number): number {
  return radix / 2;
}

export function fabricPortsPerLeaf(radix: number): number {
  return radix / 2;
}

export function normalizeHostsPerPod(totalHosts: number, hostsPerPod: number): number {
  if (hostsPerPod <= 0) {
    return totalHosts;
  }
  return hostsPerPod;
}

export function derivePodCount(totalHosts: number, hostsPerPod: number): number {
  const perPod = normalizeHostsPerPod(totalHosts, hostsPerPod);
  return Math.max(1, Math.ceil(totalHosts / perPod));
}

export function makeResultSkeleton(): SizingResult {
  return {
    switchCounts: { leaves: 0, spines: 0, total: 0 },
    assumptions: [],
    metadata: {},
  };
}

export function pushAssumption(
  assumptions: AssumptionDetail[],
  label: string,
  description: string,
): void {
  assumptions.push({ label, description });
}

export function baseMetadata(inputs: Inputs): Record<string, number | string> {
  return {
    totalHosts: inputs.totalHosts,
    hostsPerPod: normalizeHostsPerPod(inputs.totalHosts, inputs.hostsPerPod),
    switchRadix: inputs.switchRadix,
  };
}

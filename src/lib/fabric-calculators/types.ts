export type Topology = 'clos3' | 'clos5' | 'dragonflyPlus' | 'multiPlane';

export interface Inputs {
  /** Total number of end hosts in the deployment. */
  totalHosts: number;
  /** Hosts grouped under a single pod (or group for Dragonfly+). */
  hostsPerPod: number;
  /** Switch radix shared by every switch in the topology. */
  switchRadix: number;
  /** Selected topology. */
  topology: Topology;
}

export interface SwitchCounts {
  leaves: number;
  spines: number;
  superSpines?: number;
  total: number;
}

export interface AssumptionDetail {
  label: string;
  description: string;
}

export interface SizingResult {
  switchCounts: SwitchCounts;
  assumptions: AssumptionDetail[];
  metadata: Record<string, number | string>;
}

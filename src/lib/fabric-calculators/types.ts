/**
 * Supported network topologies for the sizing calculators.
 */
export type Topology = 'clos3' | 'clos5' | 'dragonflyPlus';

/**
 * Oversubscription targets supported by the UI. The tuple expresses host-to-fabric ratio.
 */
export type OversubscriptionTarget = '1:1' | '2:1' | '3:1' | null;

/**
 * Configuration for leaf-layer switches.
 */
export interface LeafSwitchConfig {
  /** Total physical ports available on the leaf switch. */
  totalPorts: number;
  /** Ports dedicated to host connections. */
  hostPorts: number;
  /** Ports dedicated to fabric (uplink) connections. */
  fabricPorts: number;
}

/**
 * Configuration for spine-layer switches.
 */
export interface SpineSwitchConfig {
  /** Total physical ports available on the spine switch. */
  totalPorts: number;
  /** Ports that connect downwards to leaves. */
  downlinkPorts: number;
  /** Ports that connect upwards to super spines (5-stage only). */
  uplinkPorts?: number;
}

/**
 * Configuration for super-spine switches in a 5-stage Clos.
 */
export interface SuperSpineSwitchConfig {
  /** Total ports available on the super-spine. */
  totalPorts: number;
  /** Ports allocated to downlinks from spines. */
  downlinkPorts: number;
}

/**
 * Dragonfly+ specific configuration knobs.
 */
export interface DragonflyPlusConfig {
  /** Number of leaf switches inside a single group. */
  leavesPerGroup: number;
  /** Number of spine switches inside a single group. */
  spinesPerGroup: number;
  /** Number of leaf-to-spine connections within the same group per leaf. */
  intraGroupDegree: number;
  /** Number of inter-group links initiated by each spine. */
  interGroupDegree: number;
}

/**
 * Primary input payload accepted by every calculator.
 */
export interface Inputs {
  /** Total number of end hosts in the deployment. */
  totalHosts: number;
  /** Number of hosts aggregated into a pod (full pods assumed except possibly the last). */
  hostsPerPod: number;
  /** Selected fabric topology. */
  topology: Topology;
  /** Network interface count per host. */
  nicsPerHost: 1 | 2;
  /** Leaf switch template. */
  leaf: LeafSwitchConfig;
  /** Spine switch template. */
  spine: SpineSwitchConfig;
  /** Super-spine template (required for 5-stage). */
  superSpine?: SuperSpineSwitchConfig;
  /** Optional oversubscription target. */
  oversubscription?: OversubscriptionTarget;
  /** Dragonfly+ specific knobs. */
  dragonflyPlus?: DragonflyPlusConfig;
}

/**
 * Breakdown of switch counts produced by the calculators.
 */
export interface SwitchCounts {
  /** Total number of leaf switches required. */
  leaves: number;
  /** Total number of spine switches required. */
  spines: number;
  /** Total number of super-spine switches required (if applicable). */
  superSpines?: number;
  /** Aggregate count across all layers. */
  total: number;
}

/**
 * Detailed fiber link counts for different layers.
 */
export interface FiberCounts {
  /** Host-to-leaf fiber count for a representative full pod. */
  hostToLeafPerPod: number;
  /** Host-to-leaf fiber count summed across the entire fabric. */
  hostToLeafTotal: number;
  /** Leaf-to-spine fiber count for a representative full pod. */
  leafToSpinePerPod: number;
  /** Leaf-to-spine fiber count summed across the entire fabric. */
  leafToSpineTotal: number;
  /** Spine-to-super-spine fiber count (per pod) for 5-stage Clos topologies. */
  spineToSuperPerPod?: number;
  /** Spine-to-super-spine fiber count (total) for 5-stage Clos topologies. */
  spineToSuperTotal?: number;
  /** Inter-group fiber count (per group) for Dragonfly+. */
  interGroupPerGroup?: number;
  /** Inter-group fiber count (total, unique links) for Dragonfly+. */
  interGroupTotal?: number;
}

/**
 * Assumption detail used to surface rounding steps in the UI.
 */
export interface AssumptionDetail {
  /** Short title for the assumption or rounding detail. */
  label: string;
  /** Human-readable explanation of how the value was derived. */
  description: string;
}

/**
 * Result payload returned from every calculator.
 */
export interface SizingResult {
  /** Summary of switch counts. */
  switchCounts: SwitchCounts;
  /** Summary of fiber counts. */
  fiberCounts: FiberCounts;
  /** Expanded assumption list describing intermediate calculations. */
  assumptions: AssumptionDetail[];
  /** Additional derived data that is useful for the UI. */
  metadata: Record<string, number | string>;
}

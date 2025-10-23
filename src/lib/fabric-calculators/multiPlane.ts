import { calculate as calculateClos3 } from './clos3';
import type { Inputs, SizingResult } from './types';

export const DEFAULT_PLANE_COUNT = 2;

export function calculate(inputs: Inputs): SizingResult {
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

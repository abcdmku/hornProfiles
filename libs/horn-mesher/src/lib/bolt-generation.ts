import * as poly2tri from "poly2tri";
import type { CrossSectionMode } from "@horn-sim/types";
import type { Point2D } from "./point-utils";
import { removeDuplicatePoints, calculatePerimeter } from "./point-utils";
import { MESH_DEFAULTS, TWO_PI } from "./constants";

export interface BoltHoleConfig {
  radius: number;
  centerY: number;
  centerZ: number;
}

/**
 * Generate a circular bolt hole
 */
export function generateBoltHole(config: BoltHoleConfig): poly2tri.Point[] {
  const { radius, centerY, centerZ } = config;
  let boltHole: poly2tri.Point[] = [];

  for (let j = 0; j < MESH_DEFAULTS.HOLE_RESOLUTION; j++) {
    const angle = (j / MESH_DEFAULTS.HOLE_RESOLUTION) * TWO_PI;
    boltHole.push(
      new poly2tri.Point(centerY + radius * Math.cos(angle), centerZ + radius * Math.sin(angle)),
    );
  }

  boltHole = removeDuplicatePoints(boltHole);
  boltHole.reverse(); // Correct winding order for holes

  return boltHole;
}

/**
 * Generate bolt holes for driver mount
 */
export function generateDriverBoltHoles(
  boltCircleRadius: number,
  boltHoleRadius: number,
  boltCount: number,
): BoltHoleConfig[] {
  const configs: BoltHoleConfig[] = [];

  for (let i = 0; i < boltCount; i++) {
    const angle = (i / boltCount) * TWO_PI;
    configs.push({
      radius: boltHoleRadius,
      centerY: boltCircleRadius * Math.cos(angle),
      centerZ: boltCircleRadius * Math.sin(angle),
    });
  }

  return configs;
}

/**
 * Generate bolt holes for horn mount
 */
export function generateHornBoltHoles(
  mouthMode: CrossSectionMode,
  innerPoints: Point2D[],
  outerPoints: Point2D[],
  boltHoleRadius: number,
  boltSpacing: number,
): BoltHoleConfig[] {
  const perimeter = calculatePerimeter(outerPoints);
  const boltCount = Math.max(MESH_DEFAULTS.MIN_BOLT_COUNT, Math.ceil(perimeter / boltSpacing));
  const configs: BoltHoleConfig[] = [];

  for (let b = 0; b < boltCount; b++) {
    const { centerY, centerZ } = calculateBoltPosition(
      b,
      boltCount,
      mouthMode,
      innerPoints,
      outerPoints,
    );

    configs.push({
      radius: boltHoleRadius,
      centerY,
      centerZ,
    });
  }

  return configs;
}

/**
 * Calculate bolt position between inner and outer edges
 */
function calculateBoltPosition(
  boltIndex: number,
  boltCount: number,
  mode: CrossSectionMode,
  innerPoints: Point2D[],
  outerPoints: Point2D[],
): { centerY: number; centerZ: number } {
  if (mode === "ellipse") {
    // Radial placement - midway between inner and outer
    const innerPoint = innerPoints[Math.floor((boltIndex / boltCount) * innerPoints.length)];
    const outerPoint = outerPoints[Math.floor((boltIndex / boltCount) * outerPoints.length)];

    return {
      centerY: (innerPoint.y + outerPoint.y) / 2,
      centerZ: (innerPoint.z + outerPoint.z) / 2,
    };
  } else {
    // For rectangular, interpolate between inner and outer
    const innerIdx = Math.floor((boltIndex / boltCount) * innerPoints.length);
    const outerIdx = Math.floor((boltIndex / boltCount) * outerPoints.length);

    return {
      centerY: (innerPoints[innerIdx].y + outerPoints[outerIdx].y) / 2,
      centerZ: (innerPoints[innerIdx].z + outerPoints[outerIdx].z) / 2,
    };
  }
}

/**
 * Add bolt holes to sweep context
 */
export function addBoltHolesToContext(
  sweepContext: poly2tri.SweepContext,
  boltConfigs: BoltHoleConfig[],
): void {
  for (const config of boltConfigs) {
    const boltHole = generateBoltHole(config);
    if (boltHole.length >= MESH_DEFAULTS.MIN_POLYGON_POINTS) {
      sweepContext.addHole(boltHole);
    }
  }
}

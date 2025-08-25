import type {
  CrossSectionMode,
  MeshData,
  DriverMountConfig,
  HornMountConfig,
} from "@horn-sim/types";

// Extended config that supports custom inner dimensions
interface HornMountConfigWithCustomInner extends HornMountConfig {
  customInnerWidth?: number;
  customInnerHeight?: number;
}
import * as poly2tri from "poly2tri";
import { MESH_DEFAULTS } from "./constants";
import { removeDuplicatePoints, toPolyPoints } from "./point-utils";
import { triangulate, trianglesToMeshData } from "./triangulation";
import { createFallbackMesh, createFallbackMeshForHorn } from "./mesh-utils";
import { generateCrossSectionPoints } from "./cross-section";
import {
  generateDriverBoltHoles,
  generateHornBoltHoles,
  addBoltHolesToContext,
} from "./bolt-generation";

/**
 * Generate a driver mount (circular flange with throat-shaped inner hole)
 */
export function generateDriverMount(
  throatPosition: number,
  throatWidth: number,
  throatHeight: number,
  throatMode: CrossSectionMode,
  config: DriverMountConfig,
  resolution: number,
): MeshData {
  // Generate outer boundary (circular flange)
  const outerRadius = config.outerDiameter / 2;
  const numOuterPoints = resolution * MESH_DEFAULTS.OUTER_EDGE_MULTIPLIER;
  const outerContour = createCircularContour(outerRadius, numOuterPoints);

  // Create sweep context
  const sweepContext = new poly2tri.SweepContext(outerContour);

  // Add throat opening as a hole
  const throatPoints = generateCrossSectionPoints(
    throatMode,
    throatWidth / 2,
    throatHeight / 2,
    resolution,
  );
  const throatHole = prepareHolePoints(toPolyPoints(throatPoints));
  sweepContext.addHole(throatHole);

  // Add bolt holes
  const boltConfigs = generateDriverBoltHoles(
    config.boltCircleDiameter / 2,
    config.boltHoleDiameter / 2,
    config.boltCount,
  );
  addBoltHolesToContext(sweepContext, boltConfigs);

  // Triangulate and convert to mesh
  const result = triangulate(sweepContext);
  if (!result.success || !result.triangles) {
    return createFallbackMesh(throatPosition, outerRadius, resolution);
  }

  return trianglesToMeshData(result.triangles, throatPosition);
}

/**
 * Create a circular contour for the outer boundary
 */
function createCircularContour(radius: number, numPoints: number): poly2tri.Point[] {
  const contour: poly2tri.Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    contour.push(new poly2tri.Point(radius * Math.cos(angle), radius * Math.sin(angle)));
  }
  return removeDuplicatePoints(contour);
}

/**
 * Prepare hole points with correct winding order
 */
function prepareHolePoints(points: poly2tri.Point[]): poly2tri.Point[] {
  const cleaned = removeDuplicatePoints(points);
  cleaned.reverse(); // Correct winding order for holes
  return cleaned;
}

/**
 * Generate a horn mount (follows mouth shape with extension)
 */
export function generateHornMount(
  mouthPosition: number,
  mouthWidth: number,
  mouthHeight: number,
  mouthMode: CrossSectionMode,
  config: HornMountConfig | HornMountConfigWithCustomInner,
  resolution: number,
): MeshData {
  // Use custom inner dimensions if provided
  const extendedConfig = config as HornMountConfigWithCustomInner;
  const innerWidth = extendedConfig.customInnerWidth ?? mouthWidth;
  const innerHeight = extendedConfig.customInnerHeight ?? mouthHeight;

  // Generate outer boundary (mouth shape + extension)
  // Always use original mouth dimensions for outer boundary to keep bolt holes aligned
  const extensionFactor = 1 + config.widthExtension / Math.max(mouthWidth, mouthHeight);
  const outerPoints = generateCrossSectionPoints(
    mouthMode,
    (mouthWidth / 2) * extensionFactor,
    (mouthHeight / 2) * extensionFactor,
    resolution * MESH_DEFAULTS.OUTER_EDGE_MULTIPLIER,
  );

  const outerContour = removeDuplicatePoints(toPolyPoints(outerPoints));

  // Create sweep context
  const sweepContext = new poly2tri.SweepContext(outerContour);

  // Add mouth opening as a hole - use custom inner dimensions if provided
  const innerPoints = generateCrossSectionPoints(
    mouthMode,
    innerWidth / 2,
    innerHeight / 2,
    resolution,
  );
  const mouthHole = prepareHolePoints(toPolyPoints(innerPoints));
  sweepContext.addHole(mouthHole);

  // Add bolt holes - always position based on original mouth dimensions
  // This ensures bolt holes align between inner and outer mounts
  const boltReferenceInner = generateCrossSectionPoints(
    mouthMode,
    mouthWidth / 2,
    mouthHeight / 2,
    resolution,
  );
  const boltConfigs = generateHornBoltHoles(
    mouthMode,
    boltReferenceInner,
    outerPoints,
    config.boltHoleDiameter / 2,
    config.boltSpacing,
  );
  addBoltHolesToContext(sweepContext, boltConfigs);

  // Triangulate and convert to mesh
  const result = triangulate(sweepContext);
  if (!result.success || !result.triangles) {
    return createFallbackMeshForHorn(mouthPosition, outerPoints, innerPoints);
  }

  return trianglesToMeshData(result.triangles, mouthPosition);
}

// Re-export utility functions that are used by other modules
export { mergeMeshData } from "./mesh-utils";

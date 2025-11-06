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

  // If thickness is 0, return flat face
  if (config.thickness <= 0) {
    return trianglesToMeshData(result.triangles, throatPosition);
  }

  // Generate 3D extrusion with thickness
  const frontFace = trianglesToMeshData(result.triangles, throatPosition);
  const backPosition = throatPosition + config.thickness;

  return extrudeMountFace(frontFace, backPosition, outerContour, throatHole, boltConfigs);
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
 * Extrude a 2D mount face into a 3D solid with thickness
 * Creates proper geometry for 3D printing
 */
function extrudeMountFace(
  frontFace: MeshData,
  backPosition: number,
  outerContour: poly2tri.Point[],
  innerHole: poly2tri.Point[],
  boltHoles: Array<{ centerY: number; centerZ: number; radius: number }>,
): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  // Copy front face vertices and indices
  for (let i = 0; i < frontFace.vertices.length; i++) {
    vertices.push(frontFace.vertices[i]);
  }
  for (let i = 0; i < frontFace.indices.length; i++) {
    indices.push(frontFace.indices[i]);
  }
  if (frontFace.normals) {
    for (let i = 0; i < frontFace.normals.length; i++) {
      normals.push(frontFace.normals[i]);
    }
  }

  const frontVertexCount = frontFace.vertices.length / 3;

  // Create back face by duplicating front face vertices at backPosition
  for (let i = 0; i < frontFace.vertices.length; i += 3) {
    vertices.push(backPosition, frontFace.vertices[i + 1], frontFace.vertices[i + 2]);
    normals.push(-1, 0, 0); // Back face normal points backward
  }

  // Add back face indices (reversed winding)
  for (let i = 0; i < frontFace.indices.length; i += 3) {
    const a = frontFace.indices[i] + frontVertexCount;
    const b = frontFace.indices[i + 1] + frontVertexCount;
    const c = frontFace.indices[i + 2] + frontVertexCount;
    indices.push(a, c, b); // Reversed winding for back face
  }

  // Connect outer edge
  connectEdgeLoop(vertices, indices, normals, outerContour, 0, frontVertexCount);

  // Connect inner hole edge
  connectEdgeLoop(vertices, indices, normals, innerHole, 0, frontVertexCount);

  // Connect bolt hole edges
  for (const boltConfig of boltHoles) {
    // Find bolt hole vertices by proximity to bolt center
    const boltVertices: number[] = [];
    for (let i = 0; i < frontVertexCount; i++) {
      const y = vertices[i * 3 + 1];
      const z = vertices[i * 3 + 2];
      const dist = Math.sqrt((y - boltConfig.centerY) ** 2 + (z - boltConfig.centerZ) ** 2);
      if (Math.abs(dist - boltConfig.radius) < 0.1) {
        boltVertices.push(i);
      }
    }

    // Connect bolt hole edge loop
    if (boltVertices.length > 2) {
      for (let i = 0; i < boltVertices.length; i++) {
        const j = (i + 1) % boltVertices.length;
        const v1Front = boltVertices[i];
        const v2Front = boltVertices[j];
        const v1Back = v1Front + frontVertexCount;
        const v2Back = v2Front + frontVertexCount;

        // Two triangles for each quad
        indices.push(v1Front, v2Front, v1Back);
        indices.push(v2Front, v2Back, v1Back);
      }
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

/**
 * Connect an edge loop between front and back faces
 */
function connectEdgeLoop(
  vertices: number[],
  indices: number[],
  normals: number[],
  contour: poly2tri.Point[],
  frontOffset: number,
  backOffset: number,
): void {
  // Find vertices matching the contour
  const contourVertices: number[] = [];
  for (const point of contour) {
    for (let i = frontOffset; i < frontOffset + backOffset; i++) {
      const y = vertices[i * 3 + 1];
      const z = vertices[i * 3 + 2];
      if (Math.abs(y - point.x) < 0.001 && Math.abs(z - point.y) < 0.001) {
        contourVertices.push(i);
        break;
      }
    }
  }

  // Connect edge loop
  for (let i = 0; i < contourVertices.length; i++) {
    const j = (i + 1) % contourVertices.length;
    const v1Front = contourVertices[i];
    const v2Front = contourVertices[j];
    const v1Back = v1Front + backOffset;
    const v2Back = v2Front + backOffset;

    // Two triangles for each quad
    indices.push(v1Front, v1Back, v2Front);
    indices.push(v2Front, v1Back, v2Back);
  }
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

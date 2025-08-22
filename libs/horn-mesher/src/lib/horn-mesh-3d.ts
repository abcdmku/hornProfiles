import type { HornGeometry, MeshData, MountOffsets, ProfileXY } from "@horn-sim/types";
import type { MeshGenerationOptions } from "./types";
import { generateCrossSection } from "./cross-section";
import { generateDriverMount, generateHornMount } from "./mounts";
import { mergeMeshData } from "./mesh-utils";
import { calculateEffectiveProfile, calculateDimensionsAt } from "./profile-utils";

/**
 * Generate a 3D horn mesh with support for various cross-sections and integrated mounts
 */
export function generateHornMesh3D(
  geometry: HornGeometry,
  options: MeshGenerationOptions,
): MeshData {
  const { resolution = 50 } = options;

  // Calculate effective profile with mount offsets
  const { profile: effectiveProfile, offsets } = calculateEffectiveProfile(
    geometry.profile,
    geometry.driverMount,
    geometry.hornMount,
  );

  // Generate integrated horn body with mounts
  return generateIntegratedHornBody(geometry, effectiveProfile, offsets, resolution);
}

/**
 * Generate integrated horn body with mounts as a single watertight mesh
 */
function generateIntegratedHornBody(
  geometry: HornGeometry,
  effectiveProfile: ProfileXY,
  offsets: MountOffsets,
  resolution: number,
): MeshData {
  const meshes: MeshData[] = [];
  const hasWallThickness = (geometry.wallThickness ?? 0) > 0;

  // Generate driver mount at original position if enabled
  if (geometry.driverMount?.enabled) {
    const mountPosition = geometry.profile[0].x; // Original throat position
    const { width: throatWidth, height: throatHeight } = calculateDimensionsAt(
      geometry.profile,
      geometry.widthProfile,
      geometry.heightProfile,
      mountPosition,
      geometry.width,
      geometry.height,
    );

    const driverMountMesh = generateDriverMount(
      mountPosition,
      throatWidth,
      throatHeight,
      geometry.mode,
      geometry.driverMount,
      resolution,
    );

    meshes.push(driverMountMesh);

    // If mount has thickness, add inner mount face at offset position
    if (geometry.driverMount.thickness > 0) {
      const offsetPosition = mountPosition + geometry.driverMount.thickness;
      const { width: offsetWidth, height: offsetHeight } = calculateDimensionsAt(
        geometry.profile,
        geometry.widthProfile,
        geometry.heightProfile,
        offsetPosition,
        geometry.width,
        geometry.height,
      );

      const innerMountMesh = generateDriverMount(
        offsetPosition,
        offsetWidth,
        offsetHeight,
        geometry.mode,
        { ...geometry.driverMount, thickness: 0 }, // Generate face only, no additional offset
        resolution,
      );

      meshes.push(innerMountMesh);
    }
  }

  // Generate main horn body (with wall thickness if specified)
  if (hasWallThickness && geometry.wallThickness) {
    const doubleWalledMesh = generateDoubleWalledHornBody(
      geometry,
      effectiveProfile,
      geometry.wallThickness,
      resolution,
    );
    meshes.push(doubleWalledMesh);
  } else {
    const hornBodyMesh = generateHornBodyMesh(geometry, effectiveProfile, resolution);
    meshes.push(hornBodyMesh);
  }

  // Generate horn mount at original position if enabled
  if (geometry.hornMount?.enabled) {
    const mountPosition = geometry.profile[geometry.profile.length - 1].x; // Original mouth position
    const { width: mouthWidth, height: mouthHeight } = calculateDimensionsAt(
      geometry.profile,
      geometry.widthProfile,
      geometry.heightProfile,
      mountPosition,
      geometry.width,
      geometry.height,
    );

    const hornMountMesh = generateHornMount(
      mountPosition,
      mouthWidth,
      mouthHeight,
      geometry.mode,
      geometry.hornMount,
      resolution,
    );

    meshes.push(hornMountMesh);

    // If mount has thickness, add inner mount face at offset position
    if (geometry.hornMount.thickness > 0) {
      const offsetPosition = mountPosition - geometry.hornMount.thickness;
      const { width: offsetWidth, height: offsetHeight } = calculateDimensionsAt(
        geometry.profile,
        geometry.widthProfile,
        geometry.heightProfile,
        offsetPosition,
        geometry.width,
        geometry.height,
      );

      const innerMountMesh = generateHornMount(
        offsetPosition,
        offsetWidth,
        offsetHeight,
        geometry.mode,
        { ...geometry.hornMount, thickness: 0 }, // Generate face only, no additional offset
        resolution,
      );

      meshes.push(innerMountMesh);
    }
  }

  // Merge all meshes into a single watertight mesh
  return meshes.length > 1 ? mergeMeshData(meshes) : meshes[0];
}

/**
 * Generate double-walled horn body with specified wall thickness
 */
function generateDoubleWalledHornBody(
  geometry: HornGeometry,
  effectiveProfile: ProfileXY,
  wallThickness: number,
  resolution: number,
): MeshData {
  const { mode, widthProfile, heightProfile } = geometry;
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  const circumferenceSteps = resolution;
  const profileSteps = effectiveProfile.length;

  // Generate outer wall vertices
  for (let i = 0; i < profileSteps; i++) {
    const point = effectiveProfile[i];
    const x = point.x;

    // Calculate dimensions at this profile position
    const { width, height } = calculateDimensionsAt(
      effectiveProfile,
      widthProfile,
      heightProfile,
      x,
      geometry.width,
      geometry.height,
    );

    // Generate outer cross-section
    const outerRadius = point.y;
    const crossSection = generateCrossSection(mode, outerRadius, width, height, circumferenceSteps);

    // Add vertices and normals for outer wall
    for (const csPoint of crossSection) {
      vertices.push(x, csPoint.y, csPoint.z);

      // Calculate normal vector (pointing outward)
      const len = Math.sqrt(csPoint.y * csPoint.y + csPoint.z * csPoint.z);
      if (len > 0) {
        normals.push(0, csPoint.y / len, csPoint.z / len);
      } else {
        normals.push(0, 0, 1);
      }
    }
  }

  // Generate inner wall vertices
  const innerStartIdx = profileSteps * circumferenceSteps;
  for (let i = 0; i < profileSteps; i++) {
    const point = effectiveProfile[i];
    const x = point.x;

    // Calculate dimensions at this profile position
    const { width, height } = calculateDimensionsAt(
      effectiveProfile,
      widthProfile,
      heightProfile,
      x,
      geometry.width,
      geometry.height,
    );

    // Generate inner cross-section (reduced by wall thickness)
    const innerRadius = Math.max(point.y - wallThickness, 0);
    const innerWidth = Math.max(width - 2 * wallThickness, 0);
    const innerHeight = Math.max(height - 2 * wallThickness, 0);
    const crossSection = generateCrossSection(
      mode,
      innerRadius,
      innerWidth,
      innerHeight,
      circumferenceSteps,
    );

    // Add vertices and normals for inner wall
    for (const csPoint of crossSection) {
      vertices.push(x, csPoint.y, csPoint.z);

      // Calculate normal vector (pointing inward)
      const len = Math.sqrt(csPoint.y * csPoint.y + csPoint.z * csPoint.z);
      if (len > 0) {
        normals.push(0, -csPoint.y / len, -csPoint.z / len);
      } else {
        normals.push(0, 0, -1);
      }
    }
  }

  // Generate triangle indices for outer wall
  for (let i = 0; i < profileSteps - 1; i++) {
    for (let j = 0; j < circumferenceSteps; j++) {
      const a = i * circumferenceSteps + j;
      const b = i * circumferenceSteps + ((j + 1) % circumferenceSteps);
      const c = (i + 1) * circumferenceSteps + j;
      const d = (i + 1) * circumferenceSteps + ((j + 1) % circumferenceSteps);

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Generate triangle indices for inner wall (reversed winding)
  for (let i = 0; i < profileSteps - 1; i++) {
    for (let j = 0; j < circumferenceSteps; j++) {
      const a = innerStartIdx + i * circumferenceSteps + j;
      const b = innerStartIdx + i * circumferenceSteps + ((j + 1) % circumferenceSteps);
      const c = innerStartIdx + (i + 1) * circumferenceSteps + j;
      const d = innerStartIdx + (i + 1) * circumferenceSteps + ((j + 1) % circumferenceSteps);

      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // Connect inner and outer walls at throat if no driver mount
  if (!geometry.driverMount?.enabled) {
    connectWalls(
      indices,
      0, // Outer wall start
      innerStartIdx, // Inner wall start
      circumferenceSteps,
      false, // Throat end
    );
  }

  // Connect inner and outer walls at mouth if no horn mount
  if (!geometry.hornMount?.enabled) {
    connectWalls(
      indices,
      (profileSteps - 1) * circumferenceSteps, // Outer wall end
      innerStartIdx + (profileSteps - 1) * circumferenceSteps, // Inner wall end
      circumferenceSteps,
      true, // Mouth end
    );
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

/**
 * Connect inner and outer walls at an edge
 */
function connectWalls(
  indices: number[],
  outerStart: number,
  innerStart: number,
  steps: number,
  reverse: boolean,
): void {
  for (let i = 0; i < steps; i++) {
    const j = (i + 1) % steps;
    const outer1 = outerStart + i;
    const outer2 = outerStart + j;
    const inner1 = innerStart + i;
    const inner2 = innerStart + j;

    if (reverse) {
      // Mouth end - reversed winding
      indices.push(outer1, outer2, inner1);
      indices.push(inner1, outer2, inner2);
    } else {
      // Throat end - normal winding
      indices.push(outer1, inner1, outer2);
      indices.push(inner1, inner2, outer2);
    }
  }
}

/**
 * Generate the main horn body mesh with proper interface vertices
 */
function generateHornBodyMesh(
  geometry: HornGeometry,
  effectiveProfile: ProfileXY,
  resolution: number,
): MeshData {
  const { mode, widthProfile, heightProfile } = geometry;
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  const circumferenceSteps = resolution;
  const profileSteps = effectiveProfile.length;

  // Generate vertices for each profile point
  for (let i = 0; i < profileSteps; i++) {
    const point = effectiveProfile[i];
    const x = point.x;

    // Calculate dimensions at this profile position
    const { width, height } = calculateDimensionsAt(
      effectiveProfile,
      widthProfile,
      heightProfile,
      x,
      geometry.width,
      geometry.height,
    );

    // Generate cross-section at this position
    const crossSection = generateCrossSection(mode, point.y, width, height, circumferenceSteps);

    // Add vertices and normals for this cross-section
    for (const csPoint of crossSection) {
      vertices.push(x, csPoint.y, csPoint.z);

      // Calculate normal vector
      const len = Math.sqrt(csPoint.y * csPoint.y + csPoint.z * csPoint.z);
      if (len > 0) {
        normals.push(0, csPoint.y / len, csPoint.z / len);
      } else {
        normals.push(0, 0, 1); // Default normal for center point
      }
    }
  }

  // Generate triangle indices for the horn body surface
  for (let i = 0; i < profileSteps - 1; i++) {
    for (let j = 0; j < circumferenceSteps; j++) {
      const a = i * circumferenceSteps + j;
      const b = i * circumferenceSteps + ((j + 1) % circumferenceSteps);
      const c = (i + 1) * circumferenceSteps + j;
      const d = (i + 1) * circumferenceSteps + ((j + 1) % circumferenceSteps);

      // Create two triangles for each quad
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Add end caps if no mounts are present
  const hasDriverMount = geometry.driverMount?.enabled;
  const hasHornMount = geometry.hornMount?.enabled;

  if (!hasDriverMount) {
    // Add throat cap
    const throatCenterIdx = vertices.length / 3;
    vertices.push(effectiveProfile[0].x, 0, 0);
    normals.push(-1, 0, 0); // Normal pointing backward

    for (let j = 0; j < circumferenceSteps; j++) {
      const a = j;
      const b = (j + 1) % circumferenceSteps;
      indices.push(throatCenterIdx, b, a);
    }
  }

  if (!hasHornMount) {
    // Add mouth cap
    const mouthCenterIdx = vertices.length / 3;
    const lastProfileIdx = profileSteps - 1;
    vertices.push(effectiveProfile[lastProfileIdx].x, 0, 0);
    normals.push(1, 0, 0); // Normal pointing forward

    for (let j = 0; j < circumferenceSteps; j++) {
      const a = lastProfileIdx * circumferenceSteps + j;
      const b = lastProfileIdx * circumferenceSteps + ((j + 1) % circumferenceSteps);
      indices.push(mouthCenterIdx, a, b);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

// Re-export helper functions for compatibility
export { createDriverMount, createHornMount };

/**
 * Helper function to create driver mount (backward compatibility)
 */
function createDriverMount(geometry: HornGeometry, resolution: number): MeshData {
  const { profile, widthProfile, heightProfile, mode, driverMount } = geometry;

  if (!driverMount?.enabled) {
    throw new Error("Driver mount is not enabled");
  }

  const throatPosition = profile[0].x;
  const { width: throatWidth, height: throatHeight } = calculateDimensionsAt(
    profile,
    widthProfile,
    heightProfile,
    throatPosition,
    geometry.width,
    geometry.height,
  );

  return generateDriverMount(
    throatPosition,
    throatWidth,
    throatHeight,
    mode,
    driverMount,
    resolution,
  );
}

/**
 * Helper function to create horn mount (backward compatibility)
 */
function createHornMount(geometry: HornGeometry, resolution: number): MeshData {
  const { profile, widthProfile, heightProfile, mode, hornMount } = geometry;

  if (!hornMount?.enabled) {
    throw new Error("Horn mount is not enabled");
  }

  const mouthPosition = profile[profile.length - 1].x;
  const { width: mouthWidth, height: mouthHeight } = calculateDimensionsAt(
    profile,
    widthProfile,
    heightProfile,
    mouthPosition,
    geometry.width,
    geometry.height,
  );

  return generateHornMount(mouthPosition, mouthWidth, mouthHeight, mode, hornMount, resolution);
}

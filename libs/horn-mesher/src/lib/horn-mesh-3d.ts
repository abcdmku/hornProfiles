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

    // If we have wall thickness and mount thickness, add outer mount face
    // This connects to the outer (expanded) horn surface
    if (hasWallThickness && geometry.driverMount.thickness > 0 && geometry.wallThickness) {
      const offsetPosition = mountPosition + geometry.driverMount.thickness;
      const { width: offsetWidth, height: offsetHeight } = calculateDimensionsAt(
        geometry.profile,
        geometry.widthProfile,
        geometry.heightProfile,
        offsetPosition,
        geometry.width,
        geometry.height,
      );

      // Calculate outer dimensions (expanded by wall thickness)
      const outerWidth = offsetWidth + 2 * geometry.wallThickness;
      const outerHeight = offsetHeight + 2 * geometry.wallThickness;

      // Generate outer mount face that connects to the outer horn surface
      const outerMountMesh = generateDriverMount(
        offsetPosition,
        outerWidth,
        outerHeight,
        geometry.mode,
        { ...geometry.driverMount, thickness: 0 }, // Generate face only
        resolution,
      );

      meshes.push(outerMountMesh);
    } else if (!hasWallThickness && geometry.driverMount.thickness > 0) {
      // Single-walled horn: add mount face at offset position
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
        { ...geometry.driverMount, thickness: 0 }, // Generate face only
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

    // If we have wall thickness and mount thickness, add outer mount face
    // This connects to the outer (expanded) horn surface
    if (hasWallThickness && geometry.hornMount.thickness > 0 && geometry.wallThickness) {
      const offsetPosition = mountPosition - geometry.hornMount.thickness;
      const { width: offsetWidth, height: offsetHeight } = calculateDimensionsAt(
        geometry.profile,
        geometry.widthProfile,
        geometry.heightProfile,
        offsetPosition,
        geometry.width,
        geometry.height,
      );

      // Calculate outer dimensions (expanded by wall thickness)
      const outerWidth = offsetWidth + 2 * geometry.wallThickness;
      const outerHeight = offsetHeight + 2 * geometry.wallThickness;

      // Generate outer mount face that connects to the outer horn surface
      const outerMountMesh = generateHornMount(
        offsetPosition,
        outerWidth,
        outerHeight,
        geometry.mode,
        { ...geometry.hornMount, thickness: 0 }, // Generate face only
        resolution,
      );

      meshes.push(outerMountMesh);
    } else if (!hasWallThickness && geometry.hornMount.thickness > 0) {
      // Single-walled horn: add mount face at offset position
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
        { ...geometry.hornMount, thickness: 0 }, // Generate face only
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
 * Creates two separate horn surfaces (inner and outer) that are open at throat/mouth
 * The inner surface follows the design profile, outer surface is expanded by wall thickness
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

  // Generate inner wall vertices (the actual horn profile - acoustic surface)
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

    // Generate inner cross-section (the design profile)
    const innerRadius = point.y;
    const crossSection = generateCrossSection(mode, innerRadius, width, height, circumferenceSteps);

    // Add vertices and normals for inner wall
    for (const csPoint of crossSection) {
      vertices.push(x, csPoint.y, csPoint.z);

      // Calculate normal vector (pointing inward for inner surface)
      const len = Math.sqrt(csPoint.y * csPoint.y + csPoint.z * csPoint.z);
      if (len > 0) {
        normals.push(0, -csPoint.y / len, -csPoint.z / len);
      } else {
        normals.push(0, 0, -1);
      }
    }
  }

  // Generate outer wall vertices (expanded by wall thickness)
  // This creates the external surface of the horn wall
  const outerStartIdx = profileSteps * circumferenceSteps;
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

    // Generate outer cross-section (expanded by wall thickness)
    const outerRadius = point.y + wallThickness;
    const outerWidth = width + 2 * wallThickness;
    const outerHeight = height + 2 * wallThickness;
    const crossSection = generateCrossSection(
      mode,
      outerRadius,
      outerWidth,
      outerHeight,
      circumferenceSteps,
    );

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

  // Generate triangle indices for inner wall (the acoustic surface - reversed winding for inward normals)
  for (let i = 0; i < profileSteps - 1; i++) {
    for (let j = 0; j < circumferenceSteps; j++) {
      const a = i * circumferenceSteps + j;
      const b = i * circumferenceSteps + ((j + 1) % circumferenceSteps);
      const c = (i + 1) * circumferenceSteps + j;
      const d = (i + 1) * circumferenceSteps + ((j + 1) % circumferenceSteps);

      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // Generate triangle indices for outer wall (expanded surface)
  for (let i = 0; i < profileSteps - 1; i++) {
    for (let j = 0; j < circumferenceSteps; j++) {
      const a = outerStartIdx + i * circumferenceSteps + j;
      const b = outerStartIdx + i * circumferenceSteps + ((j + 1) % circumferenceSteps);
      const c = outerStartIdx + (i + 1) * circumferenceSteps + j;
      const d = outerStartIdx + (i + 1) * circumferenceSteps + ((j + 1) % circumferenceSteps);

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Connect inner and outer walls at throat edge if no driver mount
  // This creates a ring connecting the two horn surfaces at the throat
  if (!geometry.driverMount?.enabled) {
    connectWalls(
      indices,
      0, // Inner wall throat (acoustic surface)
      outerStartIdx, // Outer wall throat (expanded surface)
      circumferenceSteps,
      false, // Throat end
    );
  }

  // Connect inner and outer walls at mouth edge if no horn mount
  // This creates a ring connecting the two horn surfaces at the mouth
  if (!geometry.hornMount?.enabled) {
    connectWalls(
      indices,
      (profileSteps - 1) * circumferenceSteps, // Inner wall mouth
      outerStartIdx + (profileSteps - 1) * circumferenceSteps, // Outer wall mouth
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
  innerStart: number,
  outerStart: number,
  steps: number,
  reverse: boolean,
): void {
  for (let i = 0; i < steps; i++) {
    const j = (i + 1) % steps;
    const inner1 = innerStart + i;
    const inner2 = innerStart + j;
    const outer1 = outerStart + i;
    const outer2 = outerStart + j;

    if (reverse) {
      // Mouth end - reversed winding
      indices.push(inner1, outer1, inner2);
      indices.push(inner2, outer1, outer2);
    } else {
      // Throat end - normal winding
      indices.push(inner1, inner2, outer1);
      indices.push(inner2, outer2, outer1);
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

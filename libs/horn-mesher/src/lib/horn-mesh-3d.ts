import type { HornGeometry, MeshData, MountOffsets, ProfileXY } from "@horn-sim/types";
import type { MeshGenerationOptions } from "./types";
import { generateCrossSection } from "./cross-section";
import { generateDriverMount, generateHornMount } from "./mounts";
import { createWatertightMesh } from "./mesh-utils";
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
  const interfaces: number[] = [];

  // Generate driver mount if enabled
  if (geometry.driverMount?.enabled && offsets.driverMountOffset !== undefined) {
    const mountPosition = effectiveProfile[0].x;
    const { width: throatWidth, height: throatHeight } = calculateDimensionsAt(
      effectiveProfile,
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
    interfaces.push(mountPosition); // Interface position for welding
  }

  // Generate main horn body
  const hornBodyMesh = generateHornBodyMesh(geometry, effectiveProfile, resolution);
  meshes.push(hornBodyMesh);

  // Generate horn mount if enabled
  if (geometry.hornMount?.enabled && offsets.hornMountOffset !== undefined) {
    const mountPosition = effectiveProfile[effectiveProfile.length - 1].x;
    const { width: mouthWidth, height: mouthHeight } = calculateDimensionsAt(
      effectiveProfile,
      geometry.widthProfile,
      geometry.heightProfile,
      mountPosition,
      geometry.width,
      geometry.height,
    );

    interfaces.push(mountPosition); // Interface position for welding

    const hornMountMesh = generateHornMount(
      mountPosition,
      mouthWidth,
      mouthHeight,
      geometry.mode,
      geometry.hornMount,
      resolution,
    );

    meshes.push(hornMountMesh);
  }

  // Create watertight mesh by welding vertices at interfaces
  if (meshes.length > 1) {
    return createWatertightMesh(meshes, interfaces, 0.001);
  }

  return meshes[0];
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

import type { HornGeometry, MeshData } from "@horn-sim/types";
import type { MeshGenerationOptions } from "./types";
import { generateCrossSection } from "./cross-section";
import { generateDriverMount, generateHornMount, mergeMeshData } from "./mounts";

/**
 * Generate a 3D horn mesh with support for various cross-sections and mounts
 */
export function generateHornMesh3D(
  geometry: HornGeometry,
  options: MeshGenerationOptions,
): MeshData {
  const { resolution = 50 } = options;
  const meshes: MeshData[] = [];

  // Generate horn body mesh
  const hornMesh = generateHornBody(geometry, resolution);
  meshes.push(hornMesh);

  // Generate driver mount if enabled
  if (geometry.driverMount?.enabled) {
    const driverMountMesh = createDriverMount(geometry, resolution);
    meshes.push(driverMountMesh);
  }

  // Generate horn mount if enabled
  if (geometry.hornMount?.enabled) {
    const hornMountMesh = createHornMount(geometry, resolution);
    meshes.push(hornMountMesh);
  }

  // Merge all meshes if we have multiple
  return meshes.length > 1 ? mergeMeshData(meshes) : hornMesh;
}

/**
 * Generate the main horn body mesh
 */
function generateHornBody(geometry: HornGeometry, resolution: number): MeshData {
  const { mode, profile, widthProfile, heightProfile } = geometry;
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  const circumferenceSteps = resolution;
  const profileSteps = profile.length;

  // Generate vertices for each profile point
  for (let i = 0; i < profileSteps; i++) {
    const point = profile[i];
    const x = point.x;
    const baseRadius = point.y;

    // Calculate dimensions at this profile position
    const width = widthProfile ? widthProfile[i].y * 2 : geometry.width;
    const height = heightProfile ? heightProfile[i].y * 2 : geometry.height;

    // Generate cross-section at this position
    const crossSection = generateCrossSection(mode, baseRadius, width, height, circumferenceSteps);

    // Add vertices and normals for this cross-section
    for (const csPoint of crossSection) {
      vertices.push(x, csPoint.y, csPoint.z);

      // Calculate normal vector
      const len = Math.sqrt(csPoint.y * csPoint.y + csPoint.z * csPoint.z);
      normals.push(0, csPoint.y / len, csPoint.z / len);
    }
  }

  // Generate triangle indices
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

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

/**
 * Create driver mount mesh
 */
function createDriverMount(geometry: HornGeometry, resolution: number): MeshData {
  const { profile, widthProfile, heightProfile, mode, driverMount } = geometry;

  if (!driverMount?.enabled) {
    throw new Error("Driver mount is not enabled");
  }

  const throatPosition = profile[0].x;
  const throatWidth = widthProfile ? widthProfile[0].y * 2 : geometry.width || profile[0].y * 2;
  const throatHeight = heightProfile ? heightProfile[0].y * 2 : geometry.height || profile[0].y * 2;

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
 * Create horn mount mesh
 */
function createHornMount(geometry: HornGeometry, resolution: number): MeshData {
  const { profile, mode, hornMount } = geometry;

  if (!hornMount?.enabled) {
    throw new Error("Horn mount is not enabled");
  }

  const mouthPosition = profile[profile.length - 1].x;
  const mouthWidth = geometry.width || profile[profile.length - 1].y * 2;
  const mouthHeight = geometry.height || profile[profile.length - 1].y * 2;

  return generateHornMount(mouthPosition, mouthWidth, mouthHeight, mode, hornMount, resolution);
}

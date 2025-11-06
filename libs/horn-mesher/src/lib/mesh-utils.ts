import type { MeshData } from "@horn-sim/types";
import type { Point2D } from "./point-utils";
import { NORMAL_VECTORS, TWO_PI } from "./constants";

/**
 * Create a simple fallback mesh for driver mount without holes
 */
export function createFallbackMesh(position: number, radius: number, resolution: number): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  // Center vertex
  vertices.push(position, 0, 0);
  normals.push(...NORMAL_VECTORS.X_POSITIVE);

  // Perimeter vertices
  for (let i = 0; i < resolution; i++) {
    const angle = (i / resolution) * TWO_PI;
    vertices.push(position, radius * Math.cos(angle), radius * Math.sin(angle));
    normals.push(...NORMAL_VECTORS.X_POSITIVE);
  }

  // Create triangles
  for (let i = 0; i < resolution; i++) {
    indices.push(0, i + 1, ((i + 1) % resolution) + 1);
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

/**
 * Create a simple fallback mesh for horn mount without holes
 */
export function createFallbackMeshForHorn(
  position: number,
  outerPoints: Point2D[],
  innerPoints: Point2D[],
): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  // Add inner vertices
  const innerStartIdx = 0;
  for (const point of innerPoints) {
    vertices.push(position, point.y, point.z);
    normals.push(...NORMAL_VECTORS.X_POSITIVE);
  }

  // Add outer vertices
  const outerStartIdx = innerPoints.length;
  for (const point of outerPoints) {
    vertices.push(position, point.y, point.z);
    normals.push(...NORMAL_VECTORS.X_POSITIVE);
  }

  // Create simple quad triangulation between inner and outer
  const innerCount = innerPoints.length;
  const outerCount = outerPoints.length;
  const maxCount = Math.max(innerCount, outerCount);

  for (let i = 0; i < maxCount; i++) {
    const innerIdx1 = innerStartIdx + (i % innerCount);
    const innerIdx2 = innerStartIdx + ((i + 1) % innerCount);
    const outerIdx1 = outerStartIdx + (i % outerCount);
    const outerIdx2 = outerStartIdx + ((i + 1) % outerCount);

    indices.push(innerIdx1, outerIdx1, innerIdx2);
    indices.push(innerIdx2, outerIdx1, outerIdx2);
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

/**
 * Merge multiple mesh data into a single mesh
 */
export function mergeMeshData(meshes: MeshData[]): MeshData {
  let totalVertices = 0;
  let totalIndices = 0;
  let totalNormals = 0;

  // Calculate total sizes
  for (const mesh of meshes) {
    totalVertices += mesh.vertices.length;
    totalIndices += mesh.indices.length;
    totalNormals += mesh.normals ? mesh.normals.length : 0;
  }

  // Create merged arrays
  const mergedVertices = new Float32Array(totalVertices);
  const mergedIndices = new Uint32Array(totalIndices);
  const mergedNormals = new Float32Array(totalNormals);

  let vertexOffset = 0;
  let indexOffset = 0;
  let normalOffset = 0;
  let vertexCount = 0;

  // Merge all meshes
  for (const mesh of meshes) {
    // Copy vertices
    mergedVertices.set(mesh.vertices, vertexOffset);
    vertexOffset += mesh.vertices.length;

    // Copy indices with offset
    for (let i = 0; i < mesh.indices.length; i++) {
      mergedIndices[indexOffset + i] = mesh.indices[i] + vertexCount;
    }
    indexOffset += mesh.indices.length;

    // Copy normals if they exist
    if (mesh.normals) {
      mergedNormals.set(mesh.normals, normalOffset);
      normalOffset += mesh.normals.length;
    }

    // Update vertex count for next mesh
    vertexCount += mesh.vertices.length / 3;
  }

  return {
    vertices: mergedVertices,
    indices: mergedIndices,
    normals: mergedNormals,
  };
}

/**
 * Find a matching vertex within tolerance
 */
export function findMatchingVertex(
  vertices: Float32Array,
  x: number,
  y: number,
  z: number,
  tolerance = 0.001,
): number {
  for (let i = 0; i < vertices.length; i += 3) {
    const dx = Math.abs(vertices[i] - x);
    const dy = Math.abs(vertices[i + 1] - y);
    const dz = Math.abs(vertices[i + 2] - z);

    if (dx < tolerance && dy < tolerance && dz < tolerance) {
      return i / 3; // Return vertex index
    }
  }
  return -1; // No match found
}

/**
 * Weld vertices at a specific interface plane
 */
export function weldVerticesAtInterface(
  bodyVertices: Float32Array,
  mountVertices: Float32Array,
  interfaceX: number,
  tolerance = 0.001,
): { vertices: Float32Array; indexMap: Map<number, number> } {
  const mergedVertices: number[] = [];
  const indexMap = new Map<number, number>();

  // Add all body vertices
  for (let i = 0; i < bodyVertices.length; i += 3) {
    mergedVertices.push(bodyVertices[i], bodyVertices[i + 1], bodyVertices[i + 2]);
  }

  // Add mount vertices, welding those at interface
  for (let i = 0; i < mountVertices.length; i += 3) {
    const x = mountVertices[i];
    const y = mountVertices[i + 1];
    const z = mountVertices[i + 2];

    if (Math.abs(x - interfaceX) < tolerance) {
      // Find matching body vertex at interface
      const matchIndex = findMatchingVertex(bodyVertices, x, y, z, tolerance);
      if (matchIndex !== -1) {
        indexMap.set(i / 3, matchIndex);
        continue; // Skip adding duplicate vertex
      }
    }

    // Add new vertex
    indexMap.set(i / 3, mergedVertices.length / 3);
    mergedVertices.push(x, y, z);
  }

  return {
    vertices: new Float32Array(mergedVertices),
    indexMap,
  };
}

/**
 * Create watertight mesh by welding vertices between multiple meshes
 */
export function createWatertightMesh(
  meshes: MeshData[],
  _interfaces: number[] = [],
  tolerance = 0.001,
): MeshData {
  if (meshes.length === 0) {
    return {
      vertices: new Float32Array(0),
      indices: new Uint32Array(0),
      normals: new Float32Array(0),
    };
  }

  if (meshes.length === 1) {
    return meshes[0];
  }

  // Merge all meshes first
  const mergedMesh = mergeMeshData(meshes);

  // Weld duplicate vertices to create watertight mesh
  const vertexMap = new Map<string, number>();
  const weldedVertices: number[] = [];
  const weldedNormals: number[] = [];
  const indexRemap = new Map<number, number>();

  // Build welded vertex list
  for (let i = 0; i < mergedMesh.vertices.length; i += 3) {
    const x = mergedMesh.vertices[i];
    const y = mergedMesh.vertices[i + 1];
    const z = mergedMesh.vertices[i + 2];

    // Round to tolerance to create key
    const key = `${Math.round(x / tolerance)},${Math.round(y / tolerance)},${Math.round(z / tolerance)}`;

    let newIndex = vertexMap.get(key);
    if (newIndex === undefined) {
      // New unique vertex
      newIndex = weldedVertices.length / 3;
      vertexMap.set(key, newIndex);
      weldedVertices.push(x, y, z);

      // Average normals if available
      if (mergedMesh.normals && mergedMesh.normals.length > i) {
        weldedNormals.push(
          mergedMesh.normals[i],
          mergedMesh.normals[i + 1],
          mergedMesh.normals[i + 2],
        );
      }
    }

    indexRemap.set(i / 3, newIndex);
  }

  // Remap indices
  const weldedIndices = new Uint32Array(mergedMesh.indices.length);
  for (let i = 0; i < mergedMesh.indices.length; i++) {
    const oldIndex = mergedMesh.indices[i];
    const newIndex = indexRemap.get(oldIndex);
    weldedIndices[i] = newIndex !== undefined ? newIndex : oldIndex;
  }

  return {
    vertices: new Float32Array(weldedVertices),
    indices: weldedIndices,
    normals: weldedNormals.length > 0 ? new Float32Array(weldedNormals) : undefined,
  };
}

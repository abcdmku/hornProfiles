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

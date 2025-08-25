import * as poly2tri from "poly2tri";
import type { MeshData } from "@horn-sim/types";
import { NORMAL_VECTORS } from "./constants";

export interface TriangulationResult {
  success: boolean;
  triangles?: poly2tri.Triangle[];
  error?: Error;
}

/**
 * Attempt to triangulate a polygon with holes
 */
export function triangulate(sweepContext: poly2tri.SweepContext): TriangulationResult {
  try {
    sweepContext.triangulate();
    return {
      success: true,
      triangles: sweepContext.getTriangles(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error("Triangulation failed"),
    };
  }
}

/**
 * Convert poly2tri triangles to MeshData format
 */
export function trianglesToMeshData(triangles: poly2tri.Triangle[], xPosition: number): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const pointMap = new Map<string, number>();
  let vertexIndex = 0;

  for (const triangle of triangles) {
    const points = triangle.getPoints();
    const triangleIndices: number[] = [];

    // First pass: ensure all vertices are added to the vertex buffer
    for (const point of points) {
      const key = `${point.x},${point.y}`;

      if (!pointMap.has(key)) {
        vertices.push(xPosition, point.x, point.y);
        normals.push(...NORMAL_VECTORS.X_POSITIVE);
        pointMap.set(key, vertexIndex);
        vertexIndex++;
      }

      const index = pointMap.get(key);
      if (index !== undefined) {
        triangleIndices.push(index);
      }
    }

    // Second pass: ensure correct winding order for consistent face normals
    if (triangleIndices.length === 3) {
      // Calculate triangle normal to determine correct winding
      const i0 = triangleIndices[0] * 3;
      const i1 = triangleIndices[1] * 3;
      const i2 = triangleIndices[2] * 3;

      // Get vertex positions
      const v0 = [vertices[i0 + 1], vertices[i0 + 2]]; // Y, Z coordinates
      const v1 = [vertices[i1 + 1], vertices[i1 + 2]];
      const v2 = [vertices[i2 + 1], vertices[i2 + 2]];

      // Calculate cross product in 2D to determine winding
      const edge1 = [v1[0] - v0[0], v1[1] - v0[1]];
      const edge2 = [v2[0] - v0[0], v2[1] - v0[1]];
      const crossProduct = edge1[0] * edge2[1] - edge1[1] * edge2[0];

      // For mount faces pointing in +X direction, we want counter-clockwise winding
      // when viewed from the positive X axis (looking toward negative X)
      if (crossProduct > 0) {
        // Counter-clockwise winding - correct orientation
        indices.push(triangleIndices[0], triangleIndices[1], triangleIndices[2]);
      } else {
        // Clockwise winding - reverse to make counter-clockwise
        indices.push(triangleIndices[0], triangleIndices[2], triangleIndices[1]);
      }
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

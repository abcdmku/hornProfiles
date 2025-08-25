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
        indices.push(index);
      }
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

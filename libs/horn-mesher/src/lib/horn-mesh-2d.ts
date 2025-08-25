import type { ProfileXY, MeshData } from "@horn-sim/types";
import type { MeshGenerationOptions } from "./types";
import { TWO_PI } from "./constants";

/**
 * Generate a 2D horn mesh (circular cross-section only)
 * Optimized for simple circular horns
 */
export function generateHornMesh2D(profile: ProfileXY, options: MeshGenerationOptions): MeshData {
  const { resolution = 50 } = options;
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  const thetaSteps = resolution;
  const profileSteps = profile.length;

  // Generate vertices and normals
  for (let i = 0; i < profileSteps; i++) {
    const point = profile[i];
    const radius = point.y;

    for (let j = 0; j <= thetaSteps; j++) {
      const theta = (j / thetaSteps) * TWO_PI;
      const x = point.x;
      const y = radius * Math.cos(theta);
      const z = radius * Math.sin(theta);

      vertices.push(x, y, z);

      // Calculate normal vector
      const nx = 0;
      const ny = Math.cos(theta);
      const nz = Math.sin(theta);
      normals.push(nx, ny, nz);
    }
  }

  // Generate indices for triangles
  for (let i = 0; i < profileSteps - 1; i++) {
    for (let j = 0; j < thetaSteps; j++) {
      const a = i * (thetaSteps + 1) + j;
      const b = a + 1;
      const c = a + thetaSteps + 1;
      const d = c + 1;

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

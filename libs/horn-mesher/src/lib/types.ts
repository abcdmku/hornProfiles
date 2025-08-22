import type { MeshData } from "@horn-sim/types";

export interface MeshGenerationOptions {
  resolution: number;
  elementSize: number;
  curvatureRefine?: boolean;
}

export interface CrossSectionPoint {
  y: number;
  z: number;
}

export interface ThreeMeshData {
  positions: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
}

export type MeshConverter<T> = (mesh: MeshData) => T;

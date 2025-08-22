// Main mount generation functions
export { generateDriverMount, generateHornMount, mergeMeshData } from "./mounts";

// Cross-section generation
export { generateCrossSectionPoints } from "./cross-section";

// Point utilities
export type { Point2D } from "./point-utils";
export { removeDuplicatePoints, toPolyPoints, calculatePerimeter } from "./point-utils";

// Mesh utilities
export { createFallbackMesh, createFallbackMeshForHorn } from "./mesh-utils";

// Triangulation utilities
export type { TriangulationResult } from "./triangulation";
export { triangulate, trianglesToMeshData } from "./triangulation";

// Bolt generation utilities
export type { BoltHoleConfig } from "./bolt-generation";
export {
  generateBoltHole,
  generateDriverBoltHoles,
  generateHornBoltHoles,
  addBoltHolesToContext,
} from "./bolt-generation";

// Constants
export { EPSILON, TWO_PI, MESH_DEFAULTS, NORMAL_VECTORS } from "./constants";

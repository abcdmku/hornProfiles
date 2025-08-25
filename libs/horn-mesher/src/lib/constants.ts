/**
 * Constants for mesh generation
 */

export const EPSILON = 1e-10;
export const TWO_PI = 2 * Math.PI;

export const MESH_DEFAULTS = {
  HOLE_RESOLUTION: 16,
  OUTER_EDGE_MULTIPLIER: 2,
  MIN_BOLT_COUNT: 4,
  MIN_POLYGON_POINTS: 3,
} as const;

export const NORMAL_VECTORS = {
  X_POSITIVE: [1, 0, 0] as const,
} as const;

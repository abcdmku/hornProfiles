import type { CrossSectionMode } from "@horn-sim/types";
import type { Point2D } from "./point-utils";
import type { CrossSectionPoint } from "./types";
import { TWO_PI } from "./constants";

/**
 * Generate cross-section points based on mode
 */
export function generateCrossSectionPoints(
  mode: CrossSectionMode,
  halfWidth: number,
  halfHeight: number,
  resolution: number,
): Point2D[] {
  switch (mode) {
    case "ellipse":
      return generateEllipsePoints(halfWidth, halfHeight, resolution);
    case "rectangular":
      return generateRectanglePoints(halfWidth, halfHeight, resolution);
    case "superellipse":
      return generateSuperellipsePoints(halfWidth, halfHeight, resolution);
    default:
      throw new Error(`Unsupported cross-section mode: ${mode}`);
  }
}

/**
 * Generate points for an elliptical cross-section
 * Starts from the top (positive Z-axis) for consistent morphing
 */
function generateEllipsePoints(
  halfWidth: number,
  halfHeight: number,
  resolution: number,
): Point2D[] {
  const points: Point2D[] = [];

  for (let i = 0; i < resolution; i++) {
    const angle = (i / resolution) * TWO_PI + Math.PI / 2; // Start from top (π/2)
    points.push({
      y: halfWidth * Math.cos(angle),
      z: halfHeight * Math.sin(angle),
    });
  }

  return points;
}

/**
 * Generate points for a rectangular cross-section
 * CRITICAL: Ensures sharp 90-degree corners by explicitly placing corner vertices
 */
function generateRectanglePoints(
  halfWidth: number,
  halfHeight: number,
  resolution: number,
): Point2D[] {
  const points: Point2D[] = [];

  // For very low resolutions, return simplified shapes
  if (resolution < 4) {
    if (resolution === 1) {
      points.push({ y: 0, z: halfHeight });
    } else if (resolution === 2) {
      points.push({ y: halfWidth, z: 0 });
      points.push({ y: -halfWidth, z: 0 });
    } else if (resolution === 3) {
      points.push({ y: 0, z: halfHeight });
      points.push({ y: halfWidth, z: 0 });
      points.push({ y: -halfWidth, z: 0 });
    }
    return points;
  }

  // NEW APPROACH: Explicitly place corners and distribute remaining points
  // We need to ensure corners are ALWAYS present regardless of resolution

  // Define the 4 corners with EXACT positions for sharp edges
  // CRITICAL: These must be at the exact corner positions
  // Fixed: Swap width and height for correct orientation
  const corners = [
    { y: halfHeight, z: halfWidth }, // Top-right
    { y: halfHeight, z: -halfWidth }, // Bottom-right
    { y: -halfHeight, z: -halfWidth }, // Bottom-left
    { y: -halfHeight, z: halfWidth }, // Top-left
  ];

  // For debugging: Ensure corners are at expected positions
  // console.log('Rectangle corners:', corners, 'halfWidth:', halfWidth, 'halfHeight:', halfHeight);

  // Calculate perimeter of each edge (with swapped dimensions)
  const edgeLengths = [
    halfWidth * 2, // Right edge (top to bottom) - now uses width
    halfHeight * 2, // Bottom edge (right to left) - now uses height
    halfWidth * 2, // Left edge (bottom to top) - now uses width
    halfHeight * 2, // Top edge (left to right) - now uses height
  ];

  const totalPerimeter = edgeLengths.reduce((sum, len) => sum + len, 0);

  // We have 4 corners already, distribute remaining points
  const interiorPoints = resolution - 4;

  if (interiorPoints <= 0) {
    // Just return the 4 corners
    return corners;
  }

  // Distribute interior points proportionally to edge length
  // Use floor instead of round to avoid over-allocation
  const pointsPerEdge = edgeLengths.map((len) =>
    Math.floor((interiorPoints * len) / totalPerimeter),
  );

  // Adjust for rounding errors by distributing remaining points
  const totalAllocated = pointsPerEdge.reduce((sum, n) => sum + n, 0);
  let remaining = interiorPoints - totalAllocated;

  // Distribute remaining points one at a time to edges, cycling through them
  let edgeIndex = 0;
  while (remaining > 0) {
    pointsPerEdge[edgeIndex]++;
    remaining--;
    edgeIndex = (edgeIndex + 1) % 4;
  }

  // For rectangles, we should start from a corner, not the middle of an edge
  // This ensures proper mesh generation and avoids chamfered corners
  const result: Point2D[] = [];

  // Start from top-right corner and go clockwise
  // This ensures the first point is always a corner

  // Top-right corner FIRST
  result.push(corners[0]);

  // Right edge interior points (y is fixed at halfHeight, z varies)
  for (let i = 0; i < pointsPerEdge[0]; i++) {
    const t = (i + 1) / (pointsPerEdge[0] + 1);
    result.push({
      y: halfHeight,
      z: halfWidth - t * 2 * halfWidth,
    });
  }

  // Bottom-right corner
  result.push(corners[1]);

  // Bottom edge interior points (z is fixed at -halfWidth, y varies)
  for (let i = 0; i < pointsPerEdge[1]; i++) {
    const t = (i + 1) / (pointsPerEdge[1] + 1);
    result.push({
      y: halfHeight - t * 2 * halfHeight,
      z: -halfWidth,
    });
  }

  // Bottom-left corner
  result.push(corners[2]);

  // Left edge interior points (y is fixed at -halfHeight, z varies)
  for (let i = 0; i < pointsPerEdge[2]; i++) {
    const t = (i + 1) / (pointsPerEdge[2] + 1);
    result.push({
      y: -halfHeight,
      z: -halfWidth + t * 2 * halfWidth,
    });
  }

  // Top-left corner
  result.push(corners[3]);

  // Top edge interior points (z is fixed at halfWidth, y varies)
  for (let i = 0; i < pointsPerEdge[3]; i++) {
    const t = (i + 1) / (pointsPerEdge[3] + 1);
    result.push({
      y: -halfHeight + t * 2 * halfHeight,
      z: halfWidth,
    });
  }

  // Ensure we have exactly the right number of points
  while (result.length > resolution) {
    // Remove a non-corner point
    for (let i = 1; i < result.length - 1; i++) {
      const p = result[i];
      // Check if it's not a corner
      const isCorner = corners.some(
        (c) => Math.abs(c.y - p.y) < 0.001 && Math.abs(c.z - p.z) < 0.001,
      );
      if (!isCorner) {
        result.splice(i, 1);
        break;
      }
    }
  }

  while (result.length < resolution) {
    // Add a point on the first edge
    result.splice(1, 0, {
      y: (result[0].y + result[1].y) / 2,
      z: (result[0].z + result[1].z) / 2,
    });
  }

  return result;
}

/**
 * Generate points for a superellipse cross-section
 * Starts from the top (positive Z-axis) for consistent morphing
 */
function generateSuperellipsePoints(
  halfWidth: number,
  halfHeight: number,
  resolution: number,
): Point2D[] {
  const points: Point2D[] = [];
  const n = 2.5; // Superellipse parameter

  for (let i = 0; i < resolution; i++) {
    const theta = (i / resolution) * TWO_PI + Math.PI / 2; // Start from top (π/2)
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    const x = halfWidth * Math.sign(cosTheta) * Math.pow(Math.abs(cosTheta), 2 / n);
    const y = halfHeight * Math.sign(sinTheta) * Math.pow(Math.abs(sinTheta), 2 / n);

    points.push({ y: x, z: y });
  }

  return points;
}

/**
 * Generate cross-section for mesh vertices
 * This version is optimized for 3D mesh generation
 */
export function generateCrossSection(
  mode: CrossSectionMode,
  radius: number,
  width?: number,
  height?: number,
  steps = 50,
): CrossSectionPoint[] {
  const halfWidth = width ? width / 2 : radius;
  const halfHeight = height ? height / 2 : radius;
  const points = generateCrossSectionPoints(mode, halfWidth, halfHeight, steps);
  return points as CrossSectionPoint[];
}

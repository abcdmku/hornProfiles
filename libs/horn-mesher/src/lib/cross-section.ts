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
 * Uses edge-based distribution to ensure sharp 90-degree corners
 */
function generateRectanglePoints(
  halfWidth: number,
  halfHeight: number,
  resolution: number,
): Point2D[] {
  const points: Point2D[] = [];

  // For rectangles, we MUST ensure corners are exactly at the corner positions
  // We'll distribute points per edge but always include exact corners

  // Calculate base points per edge (excluding corners)
  const edgePointsBase = Math.max(0, Math.floor((resolution - 4) / 4));
  const extraPoints = Math.max(0, resolution - 4 - edgePointsBase * 4);

  // Distribute extra points to edges
  const topEdgePoints = edgePointsBase + (extraPoints > 0 ? 1 : 0);
  const rightEdgePoints = edgePointsBase + (extraPoints > 1 ? 1 : 0);
  const bottomEdgePoints = edgePointsBase + (extraPoints > 2 ? 1 : 0);
  const leftEdgePoints = edgePointsBase;

  // CRITICAL: Start with exact top-left corner
  points.push({ y: -halfWidth, z: halfHeight });

  // Top edge interior points (between top-left and top-right corners)
  for (let i = 0; i < topEdgePoints; i++) {
    const t = (i + 1) / (topEdgePoints + 1);
    points.push({
      y: -halfWidth + t * (2 * halfWidth),
      z: halfHeight,
    });
  }

  // CRITICAL: Exact top-right corner
  points.push({ y: halfWidth, z: halfHeight });

  // Right edge interior points (between top-right and bottom-right corners)
  for (let i = 0; i < rightEdgePoints; i++) {
    const t = (i + 1) / (rightEdgePoints + 1);
    points.push({
      y: halfWidth,
      z: halfHeight - t * (2 * halfHeight),
    });
  }

  // CRITICAL: Exact bottom-right corner
  points.push({ y: halfWidth, z: -halfHeight });

  // Bottom edge interior points (between bottom-right and bottom-left corners)
  for (let i = 0; i < bottomEdgePoints; i++) {
    const t = (i + 1) / (bottomEdgePoints + 1);
    points.push({
      y: halfWidth - t * (2 * halfWidth),
      z: -halfHeight,
    });
  }

  // CRITICAL: Exact bottom-left corner
  points.push({ y: -halfWidth, z: -halfHeight });

  // Left edge interior points (between bottom-left and top-left corners)
  for (let i = 0; i < leftEdgePoints; i++) {
    const t = (i + 1) / (leftEdgePoints + 1);
    points.push({
      y: -halfWidth,
      z: -halfHeight + t * (2 * halfHeight),
    });
  }

  // Ensure we have exactly the requested number of points
  while (points.length < resolution) {
    // Add extra points on the longest edge
    const edge = Math.floor(points.length / 4) % 4;
    const edgeT = (points.length % 4) / 4;

    switch (edge) {
      case 0: // Top edge
        points.push({ y: -halfWidth + edgeT * (2 * halfWidth), z: halfHeight });
        break;
      case 1: // Right edge
        points.push({ y: halfWidth, z: halfHeight - edgeT * (2 * halfHeight) });
        break;
      case 2: // Bottom edge
        points.push({ y: halfWidth - edgeT * (2 * halfWidth), z: -halfHeight });
        break;
      case 3: // Left edge
        points.push({ y: -halfWidth, z: -halfHeight + edgeT * (2 * halfHeight) });
        break;
    }
  }

  // Trim to exact resolution if we went over
  return points.slice(0, resolution);
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

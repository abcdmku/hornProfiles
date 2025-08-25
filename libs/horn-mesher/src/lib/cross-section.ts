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

  // Calculate points per edge, ensuring each edge gets at least 1 point
  const minPointsPerEdge = Math.max(1, Math.floor(resolution / 4));
  const remainingPoints = resolution - minPointsPerEdge * 4;

  // Distribute remaining points proportionally to edge length
  const perimeter = 2 * (halfWidth + halfHeight);
  const topBottomLength = 2 * halfWidth;
  const leftRightLength = 2 * halfHeight;

  const topBottomExtra = Math.round((remainingPoints * topBottomLength) / perimeter / 2);
  const leftRightExtra = Math.round((remainingPoints * leftRightLength) / perimeter / 2);

  const topPoints = minPointsPerEdge + topBottomExtra;
  const rightPoints = minPointsPerEdge + leftRightExtra;
  const bottomPoints = minPointsPerEdge + topBottomExtra;
  const leftPoints = resolution - topPoints - rightPoints - bottomPoints;

  // Generate points starting from top edge (positive Z), going clockwise
  // Top edge: from left to right
  for (let i = 0; i < topPoints; i++) {
    const t = i / Math.max(1, topPoints - 1); // 0 to 1, but handle single point case
    points.push({
      y: -halfWidth + t * (2 * halfWidth), // -halfWidth to +halfWidth
      z: halfHeight,
    });
  }

  // Right edge: from top to bottom (excluding top corner to avoid duplicate)
  for (let i = 1; i < rightPoints; i++) {
    const t = i / Math.max(1, rightPoints - 1);
    points.push({
      y: halfWidth,
      z: halfHeight - t * (2 * halfHeight), // +halfHeight to -halfHeight
    });
  }

  // Bottom edge: from right to left (excluding right corner)
  for (let i = 1; i < bottomPoints; i++) {
    const t = i / Math.max(1, bottomPoints - 1);
    points.push({
      y: halfWidth - t * (2 * halfWidth), // +halfWidth to -halfWidth
      z: -halfHeight,
    });
  }

  // Left edge: from bottom to top (excluding bottom corner)
  for (let i = 1; i < leftPoints; i++) {
    const t = i / Math.max(1, leftPoints - 1);
    points.push({
      y: -halfWidth,
      z: -halfHeight + t * (2 * halfHeight), // -halfHeight to +halfHeight
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

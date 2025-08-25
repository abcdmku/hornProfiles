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
 * Ensures sharp 90-degree corners by placing corner vertices at exact positions
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

  // For resolution >= 4, we can make a proper rectangle
  // Key insight: We distribute points around the perimeter starting from top center
  // and ensure corners are at exact positions

  // Calculate perimeter and segments
  const perimeter = 2 * (halfWidth + halfHeight);

  // For each point, determine its position along the perimeter
  for (let i = 0; i < resolution; i++) {
    // Calculate position along perimeter (0 to 1)
    // Start from top center and go clockwise
    const t = i / resolution;
    const perimeterPos = t * perimeter;

    let y: number, z: number;

    // Determine which edge we're on and calculate position
    // Start from top center (halfWidth/2 along top edge)
    const startOffset = halfWidth / 2;
    const adjustedPos = (perimeterPos + startOffset) % perimeter;

    if (adjustedPos < halfWidth) {
      // Top edge (moving right from center)
      y = -halfWidth + adjustedPos;
      z = halfHeight;
    } else if (adjustedPos < halfWidth + halfHeight) {
      // Right edge (moving down)
      y = halfWidth;
      z = halfHeight - (adjustedPos - halfWidth);
    } else if (adjustedPos < 2 * halfWidth + halfHeight) {
      // Bottom edge (moving left)
      y = halfWidth - (adjustedPos - halfWidth - halfHeight);
      z = -halfHeight;
    } else {
      // Left edge (moving up)
      y = -halfWidth;
      z = -halfHeight + (adjustedPos - 2 * halfWidth - halfHeight);
    }

    // Snap to exact corner positions if we're very close
    const cornerTolerance = 0.001;
    if (Math.abs(y - halfWidth) < cornerTolerance && Math.abs(z - halfHeight) < cornerTolerance) {
      y = halfWidth;
      z = halfHeight;
    } else if (
      Math.abs(y - halfWidth) < cornerTolerance &&
      Math.abs(z + halfHeight) < cornerTolerance
    ) {
      y = halfWidth;
      z = -halfHeight;
    } else if (
      Math.abs(y + halfWidth) < cornerTolerance &&
      Math.abs(z + halfHeight) < cornerTolerance
    ) {
      y = -halfWidth;
      z = -halfHeight;
    } else if (
      Math.abs(y + halfWidth) < cornerTolerance &&
      Math.abs(z - halfHeight) < cornerTolerance
    ) {
      y = -halfWidth;
      z = halfHeight;
    }

    points.push({ y, z });
  }

  return points;
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

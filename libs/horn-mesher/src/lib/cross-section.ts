import type { CrossSectionMode } from "@horn-sim/types";
import type { Point2D } from "./point-utils";
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
    case "circle":
      return generateCirclePoints(halfWidth, resolution);
    case "ellipse":
      return generateEllipsePoints(halfWidth, halfHeight, resolution);
    case "rectangular":
      return generateRectanglePoints(halfWidth, halfHeight, resolution);
    default:
      throw new Error(`Unsupported cross-section mode: ${mode}`);
  }
}

/**
 * Generate points for a circular cross-section
 */
function generateCirclePoints(radius: number, resolution: number): Point2D[] {
  const points: Point2D[] = [];

  for (let i = 0; i < resolution; i++) {
    const angle = (i / resolution) * TWO_PI;
    points.push({
      y: radius * Math.cos(angle),
      z: radius * Math.sin(angle),
    });
  }

  return points;
}

/**
 * Generate points for an elliptical cross-section
 */
function generateEllipsePoints(
  halfWidth: number,
  halfHeight: number,
  resolution: number,
): Point2D[] {
  const points: Point2D[] = [];

  for (let i = 0; i < resolution; i++) {
    const angle = (i / resolution) * TWO_PI;
    points.push({
      y: halfWidth * Math.cos(angle),
      z: halfHeight * Math.sin(angle),
    });
  }

  return points;
}

/**
 * Generate points for a rectangular cross-section
 */
function generateRectanglePoints(
  halfWidth: number,
  halfHeight: number,
  resolution: number,
): Point2D[] {
  const points: Point2D[] = [];
  const pointsPerSide = Math.floor(resolution / 4);
  const remainingPoints = resolution - pointsPerSide * 4;

  // Bottom edge
  for (let i = 0; i < pointsPerSide; i++) {
    const t = i / pointsPerSide;
    points.push({
      y: -halfWidth + t * 2 * halfWidth,
      z: -halfHeight,
    });
  }

  // Right edge
  for (let i = 0; i < pointsPerSide; i++) {
    const t = i / pointsPerSide;
    points.push({
      y: halfWidth,
      z: -halfHeight + t * 2 * halfHeight,
    });
  }

  // Top edge
  for (let i = 0; i < pointsPerSide; i++) {
    const t = i / pointsPerSide;
    points.push({
      y: halfWidth - t * 2 * halfWidth,
      z: halfHeight,
    });
  }

  // Left edge (with remaining points)
  for (let i = 0; i < pointsPerSide + remainingPoints; i++) {
    const t = i / (pointsPerSide + remainingPoints);
    points.push({
      y: -halfWidth,
      z: halfHeight - t * 2 * halfHeight,
    });
  }

  return points;
}

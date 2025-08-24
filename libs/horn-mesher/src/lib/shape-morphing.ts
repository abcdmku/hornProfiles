import type { CrossSectionMode } from "@horn-sim/types";
import { Point2D } from "./point-utils";
import { generateCrossSectionPoints } from "./cross-section";

export interface ShapeMorphParams {
  sourceShape: CrossSectionMode;
  targetShape: CrossSectionMode;
  morphFactor: number; // 0-1, 0=source, 1=target
  width: number;
  height: number;
  resolution: number;
}

// MORPHING_FUNCTIONS moved to horn-profiles to avoid circular dependency

/**
 * Morph between two cross-section shapes
 * Implements shape-based interpolation using normalized point sets
 */
export function morphCrossSectionShapes(params: ShapeMorphParams): Point2D[] {
  const { sourceShape, targetShape, morphFactor, width, height, resolution } = params;

  // Handle same shapes (optimization)
  if (sourceShape === targetShape) {
    return generateCrossSectionPoints(sourceShape, width / 2, height / 2, resolution);
  }

  // Generate source and target point sets
  const sourcePoints = generateCrossSectionPoints(sourceShape, width / 2, height / 2, resolution);
  const targetPoints = generateCrossSectionPoints(targetShape, width / 2, height / 2, resolution);

  // Normalize point sets to same resolution
  const normalizedSource = normalizePointSet(sourcePoints, resolution);
  const normalizedTarget = normalizePointSet(targetPoints, resolution);

  // Interpolate between normalized point sets
  return interpolatePointSets(normalizedSource, normalizedTarget, morphFactor);
}

/**
 * Normalize point set to specific resolution with even angular distribution
 */
function normalizePointSet(points: Point2D[], targetResolution: number): Point2D[] {
  if (points.length === targetResolution) {
    return points; // Already correct resolution
  }

  // Convert to polar coordinates
  const polarPoints = points.map((p) => ({
    angle: Math.atan2(p.z, p.y),
    radius: Math.sqrt(p.y * p.y + p.z * p.z),
  }));

  // Sort by angle to ensure proper ordering
  polarPoints.sort((a, b) => a.angle - b.angle);

  // Generate normalized points with even angular distribution
  const normalized: Point2D[] = [];
  for (let i = 0; i < targetResolution; i++) {
    const targetAngle = (2 * Math.PI * i) / targetResolution;
    const radius = interpolateRadiusAtAngle(polarPoints, targetAngle);
    normalized.push({
      y: radius * Math.cos(targetAngle),
      z: radius * Math.sin(targetAngle),
    });
  }

  return normalized;
}

/**
 * Interpolate radius at a specific angle from polar coordinate data
 */
function interpolateRadiusAtAngle(
  polarPoints: Array<{ angle: number; radius: number }>,
  targetAngle: number,
): number {
  // Normalize target angle to [0, 2π]
  targetAngle = ((targetAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  // Find the two points that bracket the target angle
  for (let i = 0; i < polarPoints.length; i++) {
    const current = polarPoints[i];
    const next = polarPoints[(i + 1) % polarPoints.length];

    const currentAngle = current.angle;
    let nextAngle = next.angle;

    // Handle angle wrapping around 2π
    if (nextAngle < currentAngle) {
      nextAngle += 2 * Math.PI;
    }

    if (targetAngle >= currentAngle && targetAngle <= nextAngle) {
      // Linear interpolation between the two radii
      const t = (targetAngle - currentAngle) / (nextAngle - currentAngle);
      return current.radius + t * (next.radius - current.radius);
    }

    // Handle case where target angle is beyond the last point
    if (i === polarPoints.length - 1) {
      const firstAngle = polarPoints[0].angle + 2 * Math.PI;
      if (targetAngle >= currentAngle && targetAngle <= firstAngle) {
        const t = (targetAngle - currentAngle) / (firstAngle - currentAngle);
        return current.radius + t * (polarPoints[0].radius - current.radius);
      }
    }
  }

  // Fallback: return radius of closest point
  let closestIndex = 0;
  let minAngleDiff = Math.abs(targetAngle - polarPoints[0].angle);

  for (let i = 1; i < polarPoints.length; i++) {
    const angleDiff = Math.abs(targetAngle - polarPoints[i].angle);
    if (angleDiff < minAngleDiff) {
      minAngleDiff = angleDiff;
      closestIndex = i;
    }
  }

  return polarPoints[closestIndex].radius;
}

/**
 * Linear interpolation between two point sets
 */
function interpolatePointSets(source: Point2D[], target: Point2D[], factor: number): Point2D[] {
  if (source.length !== target.length) {
    throw new Error(`Point set lengths must match: ${source.length} vs ${target.length}`);
  }

  return source.map((sourcePoint, i) => {
    const targetPoint = target[i];
    return {
      y: sourcePoint.y + factor * (targetPoint.y - sourcePoint.y),
      z: sourcePoint.z + factor * (targetPoint.z - sourcePoint.z),
    };
  });
}

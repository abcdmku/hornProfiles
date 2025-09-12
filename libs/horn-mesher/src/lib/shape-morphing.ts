import type { CrossSectionMode } from "@horn-sim/types";
import { Point2D } from "./point-utils";
import { generateCrossSectionPoints } from "./cross-section";

export interface ShapeMorphParams {
  sourceShape: CrossSectionMode;
  targetShape: CrossSectionMode;
  morphFactor: number; // 0-1, 0=source, 1=target
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  resolution: number;
}

// MORPHING_FUNCTIONS moved to horn-profiles to avoid circular dependency

/**
 * Morph between two cross-section shapes
 * Implements shape-based interpolation using normalized point sets
 */
export function morphCrossSectionShapes(params: ShapeMorphParams): Point2D[] {
  const {
    sourceShape,
    targetShape,
    morphFactor,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    resolution,
  } = params;

  // Always keep the cross-section dimensions equal to the target width/height
  // at this axial station. Morphing affects only the contour shape, not size.

  // Generate unit-sized point sets for both shapes (halfWidth=1, halfHeight=1)
  const unitSource = generateCrossSectionPoints(sourceShape, 1, 1, resolution);
  const unitTarget = generateCrossSectionPoints(targetShape, 1, 1, resolution);

  // Normalize to consistent resolution and ordering
  const normalizedSource = normalizePointSet(unitSource, resolution);
  const normalizedTarget = normalizePointSet(unitTarget, resolution);

  // Interpolate shape in unit space
  const unitMorphed = interpolatePointSets(normalizedSource, normalizedTarget, morphFactor);

  // Scale to the desired dimensions for this section
  const halfW = targetWidth / 2;
  const halfH = targetHeight / 2;
  return unitMorphed.map((p) => ({ y: p.y * halfW, z: p.z * halfH }));
}

/**
 * Normalize point set to specific resolution with even angular distribution
 * Preserves sharp corners for rectangular shapes
 */
function normalizePointSet(points: Point2D[], targetResolution: number): Point2D[] {
  if (points.length === targetResolution) {
    return points; // Already correct resolution
  }

  // Check if this is a rectangular shape by detecting sharp corners
  const isRectangular = isRectangularShape(points);

  if (isRectangular) {
    // For rectangular shapes, preserve the exact corner positions
    return normalizeRectangularPointSetTopAligned(points, targetResolution);
  }

  // Convert to polar coordinates for smooth shapes
  const polarPoints = points.map((p) => ({
    angle: Math.atan2(p.z, p.y),
    radius: Math.sqrt(p.y * p.y + p.z * p.z),
  }));

  // Sort by angle to ensure proper ordering
  polarPoints.sort((a, b) => a.angle - b.angle);

  // Generate normalized points with even angular distribution
  const normalized: Point2D[] = [];
  for (let i = 0; i < targetResolution; i++) {
    const targetAngle = (2 * Math.PI * i) / targetResolution + Math.PI / 2; // Start from top (ÃƒÆ’Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬/2)
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
  // Normalize target angle to [0, 2ÃƒÆ’Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬]
  targetAngle = ((targetAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  // Find the two points that bracket the target angle
  for (let i = 0; i < polarPoints.length; i++) {
    const current = polarPoints[i];
    const next = polarPoints[(i + 1) % polarPoints.length];

    const currentAngle = current.angle;
    let nextAngle = next.angle;

    // Handle angle wrapping around 2ÃƒÆ’Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
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
 * Detect if a point set represents a rectangular shape by checking for sharp corners
 * and edge-aligned points
 */
function isRectangularShape(points: Point2D[]): boolean {
  if (points.length < 4) return false;

  // Check if points form approximate rectangle by looking for 4 dominant directions
  const corners: Point2D[] = [];
  const tolerance = 1e-6;
  const angleTolerance = 0.05; // ~3 degrees tolerance for perpendicularity

  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];

    // Calculate direction vectors
    const dir1 = { y: curr.y - prev.y, z: curr.z - prev.z };
    const dir2 = { y: next.y - curr.y, z: next.z - curr.z };

    // Normalize vectors
    const len1 = Math.sqrt(dir1.y * dir1.y + dir1.z * dir1.z);
    const len2 = Math.sqrt(dir2.y * dir2.y + dir2.z * dir2.z);

    if (len1 > tolerance && len2 > tolerance) {
      dir1.y /= len1;
      dir1.z /= len1;
      dir2.y /= len2;
      dir2.z /= len2;

      // Check if vectors are perpendicular (dot product near 0)
      const dot = dir1.y * dir2.y + dir1.z * dir2.z;
      if (Math.abs(dot) < angleTolerance) {
        corners.push(curr);
      }
    }
  }

  // A rectangle should have exactly 4 corners
  if (corners.length !== 4) return false;

  // Additional check: verify points are aligned with rectangle edges
  // Find the bounding box and check if most points lie on the edges
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const minZ = Math.min(...points.map((p) => p.z));
  const maxZ = Math.max(...points.map((p) => p.z));

  const edgeTolerance = Math.min(maxY - minY, maxZ - minZ) * 0.01; // 1% of smaller dimension

  let edgePoints = 0;
  for (const point of points) {
    const onLeftEdge = Math.abs(point.y - minY) < edgeTolerance;
    const onRightEdge = Math.abs(point.y - maxY) < edgeTolerance;
    const onTopEdge = Math.abs(point.z - maxZ) < edgeTolerance;
    const onBottomEdge = Math.abs(point.z - minZ) < edgeTolerance;

    if (onLeftEdge || onRightEdge || onTopEdge || onBottomEdge) {
      edgePoints++;
    }
  }

  // At least 80% of points should be on edges for a true rectangle
  return edgePoints >= Math.floor(points.length * 0.8);
}

/**
 * Normalize rectangular point set while preserving sharp corners
 */
function normalizeRectangularPointSet(points: Point2D[], targetResolution: number): Point2D[] {
  // Find the 4 corner points by detecting sharp angle changes
  const corners: { point: Point2D; index: number }[] = [];
  const tolerance = 0.01; // Tight tolerance for sharp 90-degree corners

  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];

    // Calculate direction vectors
    const dir1 = { y: curr.y - prev.y, z: curr.z - prev.z };
    const dir2 = { y: next.y - curr.y, z: next.z - curr.z };

    // Normalize vectors
    const len1 = Math.sqrt(dir1.y * dir1.y + dir1.z * dir1.z);
    const len2 = Math.sqrt(dir2.y * dir2.y + dir2.z * dir2.z);

    if (len1 > 1e-6 && len2 > 1e-6) {
      dir1.y /= len1;
      dir1.z /= len1;
      dir2.y /= len2;
      dir2.z /= len2;

      // Check if vectors are approximately perpendicular
      const dot = dir1.y * dir2.y + dir1.z * dir2.z;
      if (Math.abs(dot) < tolerance) {
        corners.push({ point: curr, index: i });
      }
    }
  }

  // If we don't have exactly 4 corners, fall back to regular normalization
  if (corners.length !== 4) {
    const polarPoints = points.map((p) => ({
      angle: Math.atan2(p.z, p.y),
      radius: Math.sqrt(p.y * p.y + p.z * p.z),
    }));
    polarPoints.sort((a, b) => a.angle - b.angle);

    const normalized: Point2D[] = [];
    for (let i = 0; i < targetResolution; i++) {
      const targetAngle = (2 * Math.PI * i) / targetResolution + Math.PI / 2;
      const radius = interpolateRadiusAtAngle(polarPoints, targetAngle);
      normalized.push({
        y: radius * Math.cos(targetAngle),
        z: radius * Math.sin(targetAngle),
      });
    }
    return normalized;
  }

  // CRITICAL FIX: Use consistent ordering with ellipse (top ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ left ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ bottom ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ right)
  // Don't sort by angle as it can disrupt proper point correspondence

  // Find corners in the proper order to match ellipse traversal
  const orderedCorners: Point2D[] = [];

  // Find each corner by position (using tolerance for floating point comparison)
  const cornerTolerance = 1e-6;
  const halfWidth = Math.max(...corners.map((c) => Math.abs(c.point.y)));
  const halfHeight = Math.max(...corners.map((c) => Math.abs(c.point.z)));

  // Start from top-left and find corners in counter-clockwise order (like ellipse)
  const cornerPositions = [
    { y: -halfWidth, z: halfHeight }, // Top-left (start point like ellipse at ÃƒÆ’Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬/2)
    { y: -halfWidth, z: -halfHeight }, // Bottom-left
    { y: halfWidth, z: -halfHeight }, // Bottom-right
    { y: halfWidth, z: halfHeight }, // Top-right
  ];

  // Match detected corners to expected positions
  for (const expectedPos of cornerPositions) {
    const matchingCorner = corners.find(
      (c) =>
        Math.abs(c.point.y - expectedPos.y) < cornerTolerance &&
        Math.abs(c.point.z - expectedPos.z) < cornerTolerance,
    );
    if (matchingCorner) {
      orderedCorners.push(matchingCorner.point);
    } else {
      // If we can't find the exact corner, use the expected position
      orderedCorners.push(expectedPos);
    }
  }

  // Distribute points along the rectangle edges in counter-clockwise order
  const normalized: Point2D[] = [];
  const pointsPerEdge = Math.floor(targetResolution / 4);
  const remainder = targetResolution % 4;

  // Start from top-left and go counter-clockwise: top-left ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ bottom-left ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ bottom-right ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ top-right
  const edgeSequence = [
    [0, 1], // Top-left to bottom-left
    [1, 2], // Bottom-left to bottom-right
    [2, 3], // Bottom-right to top-right
    [3, 0], // Top-right to top-left (closes the loop)
  ];

  for (let edge = 0; edge < 4; edge++) {
    const [startIdx, endIdx] = edgeSequence[edge];
    const startCorner = orderedCorners[startIdx];
    const endCorner = orderedCorners[endIdx];
    const edgePoints = pointsPerEdge + (edge < remainder ? 1 : 0);

    // Add points along this edge (excluding the end corner to avoid duplicates)
    for (let i = 0; i < edgePoints; i++) {
      const t = i / edgePoints;
      const point = {
        y: startCorner.y + t * (endCorner.y - startCorner.y),
        z: startCorner.z + t * (endCorner.z - startCorner.z),
      };
      normalized.push(point);
    }
  }

  return normalized;
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

// Top-center aligned rectangle normalization to keep seam fixed across sections
function normalizeRectangularPointSetTopAligned(points: Point2D[], targetResolution: number): Point2D[] {
  if (points.length < 4) return points;
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));
  const minZ = Math.min(...points.map(p => p.z));
  const maxZ = Math.max(...points.map(p => p.z));
  const cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  const halfWidth = (maxY - minY) / 2;
  const halfHeight = (maxZ - minZ) / 2;

  const TL = { y: cy - halfWidth, z: cz + halfHeight };
  const TR = { y: cy + halfWidth, z: cz + halfHeight };
  const BR = { y: cy + halfWidth, z: cz - halfHeight };
  const BL = { y: cy - halfWidth, z: cz - halfHeight };

  // CCW edge order, start from TOP going right-to-left (TR -> TL)
  const edges = [
    { a: TR, b: TL, length: 2 * halfWidth },
    { a: TL, b: BL, length: 2 * halfHeight },
    { a: BL, b: BR, length: 2 * halfWidth },
    { a: BR, b: TR, length: 2 * halfHeight },
  ];
  const per = 4 * (halfWidth + halfHeight);
  const res = Math.max(4, Math.floor(targetResolution));
  const step = per / res;
  const start = edges[0].length / 2; // TR -> top-center along the top edge

  const out: Point2D[] = [];
  for (let i = 0; i < res; i++) {
    let s = (start + i * step) % per;
    let acc = 0, ei = 0;
    for (; ei < 4; ei++) { const next = acc + edges[ei].length; if (s <= next + 1e-9) { s -= acc; break; } acc = next; }
    const ed = edges[ei], t = ed.length > 0 ? s / ed.length : 0;
    out.push({ y: ed.a.y + t * (ed.b.y - ed.a.y), z: ed.a.z + t * (ed.b.z - ed.a.z) });
  }
  return out;
}

import * as poly2tri from "poly2tri";
import { EPSILON } from "./constants";

export type Point2D = { y: number; z: number };

/**
 * Check if two points are approximately equal
 */
export function arePointsEqual(p1: poly2tri.Point, p2: poly2tri.Point): boolean {
  return Math.abs(p1.x - p2.x) <= EPSILON && Math.abs(p1.y - p2.y) <= EPSILON;
}

/**
 * Remove duplicate consecutive points from a polygon
 */
export function removeDuplicatePoints(points: poly2tri.Point[]): poly2tri.Point[] {
  if (points.length === 0) return points;

  const filtered: poly2tri.Point[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    if (!arePointsEqual(prev, curr)) {
      filtered.push(curr);
    }
  }

  // Check if the last point equals the first (closing duplicate)
  if (filtered.length > 1) {
    const first = filtered[0];
    const last = filtered[filtered.length - 1];
    if (arePointsEqual(first, last)) {
      filtered.pop();
    }
  }

  return filtered;
}

/**
 * Convert 2D points to poly2tri points
 */
export function toPolyPoints(points: Point2D[]): poly2tri.Point[] {
  return points.map((p) => new poly2tri.Point(p.y, p.z));
}

/**
 * Calculate perimeter of a closed curve
 */
export function calculatePerimeter(points: Point2D[]): number {
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    perimeter += Math.sqrt((p2.y - p1.y) ** 2 + (p2.z - p1.z) ** 2);
  }
  return perimeter;
}

import { HornProfileParameters, Point2D, ProfileGeneratorResult } from "../types";
import { BaseHornProfile } from "./base";

export class TractrixProfile extends BaseHornProfile {
  generate(params: HornProfileParameters): ProfileGeneratorResult {
    this.validateParameters(params);
    const normalizedParams = this.normalizeParameters(params);

    const { throatRadius, mouthRadius, length, resolution, cutoffFrequency, speedOfSound } =
      normalizedParams;

    // Calculate tractrix mouth radius based on cutoff frequency
    // r0 = c / (2π*fc) where c is in m/s, result is in meters
    // Convert to mm by multiplying by 1000
    const r0_mm = (speedOfSound * 1000) / (2 * Math.PI * cutoffFrequency);

    // For tractrix, the profile naturally terminates when y approaches r0
    // We'll use 99.5% of r0 as the practical maximum to avoid numerical issues
    const maxPossibleRadius = r0_mm * 0.995;

    // The actual mouth radius is the minimum of:
    // 1. The requested mouth radius
    // 2. The maximum possible radius for this cutoff frequency
    const actualMouthRadius = Math.min(mouthRadius, maxPossibleRadius);

    const points: Point2D[] = [];

    // Calculate the natural horn length (where curve becomes vertical)
    const yMin = throatRadius;
    const yMax = actualMouthRadius;

    // Calculate x values at throat and mouth using tractrix equation
    // x = r0 * ln((r0 + sqrt(r0^2 - y^2))/y) - sqrt(r0^2 - y^2)
    const xThroat =
      r0_mm * Math.log((r0_mm + Math.sqrt(r0_mm * r0_mm - yMin * yMin)) / yMin) -
      Math.sqrt(r0_mm * r0_mm - yMin * yMin);
    const xMouth =
      r0_mm * Math.log((r0_mm + Math.sqrt(r0_mm * r0_mm - yMax * yMax)) / yMax) -
      Math.sqrt(r0_mm * r0_mm - yMax * yMax);

    // Natural horn length is the difference between throat and mouth x-positions
    const naturalLength = xThroat - xMouth;

    // Use the shorter of the natural length or the specified length
    // This makes the length parameter optional - it only cuts the horn if shorter
    const effectiveLength = Math.min(length, naturalLength);

    // If we're using a shorter length, we need to find where to terminate
    let effectiveYMax = yMax;
    if (effectiveLength < naturalLength) {
      // Find the y-value at the specified length
      // This requires solving the tractrix equation for y given x
      // We'll use a binary search approach
      let yLow = yMin;
      let yHigh = yMax;
      const targetX = xThroat - effectiveLength;

      for (let iter = 0; iter < 50; iter++) {
        const yMid = (yLow + yHigh) / 2;
        if (yMid >= r0_mm || yMid <= 0) break;

        const sqrtTerm = Math.sqrt(r0_mm * r0_mm - yMid * yMid);
        const xMid = r0_mm * Math.log((r0_mm + sqrtTerm) / yMid) - sqrtTerm;

        if (xMid > targetX) {
          yLow = yMid;
        } else {
          yHigh = yMid;
        }

        if (Math.abs(xMid - targetX) < 0.01) {
          effectiveYMax = yMid;
          break;
        }
      }
    }

    // Generate points along the profile
    for (let i = 0; i <= resolution; i++) {
      const t = i / resolution;
      // Use exponential parameter mapping for better curve representation
      // This concentrates more points near the mouth where curvature is highest
      const expT = (Math.exp(t * 3) - 1) / (Math.exp(3) - 1);
      const y = yMin + (effectiveYMax - yMin) * expT;

      if (y > 0 && y < r0_mm) {
        const sqrtTerm = Math.sqrt(r0_mm * r0_mm - y * y);
        const rawX = r0_mm * Math.log((r0_mm + sqrtTerm) / y) - sqrtTerm;

        // Calculate actual x position from throat
        const x = xThroat - rawX;

        points.push({
          x: x,
          y: y,
        });
      }
    }

    // Ensure we have proper start and end points
    if (points.length < 2) {
      // Fallback to linear if calculation fails
      for (let i = 0; i <= resolution; i++) {
        const t = i / resolution;
        points.push({
          x: length * t,
          y: throatRadius + (actualMouthRadius - throatRadius) * t,
        });
      }
    }

    return {
      points,
      metadata: {
        profileType: "tractrix",
        parameters: normalizedParams,
        calculatedValues: {
          tractrixMouthRadius_mm: r0_mm,
          actualCutoffFrequency: (speedOfSound * 1000) / (2 * Math.PI * r0_mm),
          actualMouthRadius: effectiveYMax,
          throatRadius: throatRadius,
          naturalHornLength: naturalLength,
          effectiveHornLength: effectiveLength,
          lengthLimited: effectiveLength < naturalLength,
          pointCount: points.length,
        },
      },
    };
  }
}

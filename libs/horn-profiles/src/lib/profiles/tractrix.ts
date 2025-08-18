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

    // Determine the actual mouth radius (cannot exceed r0)
    // Tractrix profile asymptotically approaches r0, so we limit to 99.9% of r0
    const actualMouthRadius = Math.min(mouthRadius, r0_mm * 0.999);

    const points: Point2D[] = [];

    // For tractrix, we need to generate points along x-axis and calculate y
    // This gives the characteristic curved shape

    // First, calculate the x-range for the tractrix curve
    const yMin = throatRadius;
    const yMax = actualMouthRadius;

    // Calculate x values at throat and mouth using tractrix equation
    const xThroat =
      r0_mm * Math.log((r0_mm + Math.sqrt(r0_mm * r0_mm - yMin * yMin)) / yMin) -
      Math.sqrt(r0_mm * r0_mm - yMin * yMin);
    const xMouth =
      r0_mm * Math.log((r0_mm + Math.sqrt(r0_mm * r0_mm - yMax * yMax)) / yMax) -
      Math.sqrt(r0_mm * r0_mm - yMax * yMax);
    const xRange = xThroat - xMouth;

    // Generate points along the x-axis (uniformly spaced in x)
    for (let i = 0; i <= resolution; i++) {
      // We need to find y for this x position
      // This requires inverting the tractrix equation numerically
      // For simplicity, we'll use a different approach:
      // Generate more points with finer y-spacing and interpolate

      // Alternative: use parametric form with non-linear parameter
      const t = i / resolution;
      // Use exponential parameter mapping for better curve representation
      const expT = (Math.exp(t * 2) - 1) / (Math.exp(2) - 1);
      const y = yMin + (yMax - yMin) * expT;

      if (y > 0 && y < r0_mm) {
        const sqrtTerm = Math.sqrt(r0_mm * r0_mm - y * y);
        const rawX = r0_mm * Math.log((r0_mm + sqrtTerm) / y) - sqrtTerm;

        // Normalize x to horn length
        const x = ((xThroat - rawX) / xRange) * length;

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
          actualMouthRadius: actualMouthRadius,
          throatRadius: throatRadius,
          hornLength: length,
          pointCount: points.length,
        },
      },
    };
  }
}

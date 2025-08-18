import { HornProfileParameters, Point2D, ProfileGeneratorResult } from "../types";
import { BaseHornProfile } from "./base";
import { safeSqrt, safeLog } from "../utils/math";

export class TractrixProfile extends BaseHornProfile {
  generate(params: HornProfileParameters): ProfileGeneratorResult {
    this.validateParameters(params);
    const normalizedParams = this.normalizeParameters(params);

    const { throatRadius, mouthRadius, length, resolution, cutoffFrequency, speedOfSound } =
      normalizedParams;

    // Calculate tractrix radius based on cutoff frequency
    // r0 = c / (2π*fc)
    const r0 = speedOfSound / (2 * Math.PI * cutoffFrequency);

    // For a true tractrix, we need r0 > mouthRadius
    // The tractrix parameter should be larger than the mouth radius
    const tractrixParameter = Math.max(r0, mouthRadius * 1.01);

    const points: Point2D[] = [];

    // Generate points from throat to mouth
    // We'll generate the tractrix curve and then scale it to fit the desired length
    const tempPoints: Point2D[] = [];

    // Start from throat radius and expand to mouth radius
    for (let i = 0; i <= resolution; i++) {
      const t = i / resolution;
      const radius = throatRadius + (mouthRadius - throatRadius) * t;

      // Ensure radius doesn't exceed tractrix parameter
      if (radius >= tractrixParameter) {
        // If we've reached the limit, continue with a straight line
        const lastX = tempPoints.length > 0 ? tempPoints[tempPoints.length - 1].x : 0;
        tempPoints.push({
          x: lastX + length * 0.01, // Small increment
          y: radius,
        });
      } else {
        // Calculate x position using tractrix equation
        // x = r0 * [ln((r0 + sqrt(r0^2 - r^2))/r) - sqrt(1 - (r/r0)^2)]
        const ratio = radius / tractrixParameter;
        const sqrtTerm = safeSqrt(1 - ratio * ratio);

        // The tractrix equation for x as a function of radius
        const x = tractrixParameter * (safeLog((1 + sqrtTerm) / ratio) - sqrtTerm);

        tempPoints.push({ x, y: radius });
      }
    }

    // Find the range of x values
    let minX = Number.MAX_VALUE;
    let maxX = Number.MIN_VALUE;
    for (const point of tempPoints) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
    }

    // Normalize and scale to desired length
    const xRange = maxX - minX;
    const scaleFactor = xRange > 0 ? length / xRange : 1;

    // Reverse the x-coordinates so the horn expands from throat to mouth
    // and scale to fit the desired length
    for (const point of tempPoints) {
      points.push({
        x: (maxX - point.x) * scaleFactor,
        y: point.y,
      });
    }

    // Sort points by x coordinate to ensure proper ordering
    points.sort((a, b) => a.x - b.x);

    return {
      points,
      metadata: {
        profileType: "tractrix",
        parameters: normalizedParams,
        calculatedValues: {
          tractrixRadius: r0,
          tractrixParameter,
          actualCutoffFrequency: speedOfSound / (2 * Math.PI * r0),
          theoreticalMaxRadius: tractrixParameter,
          scaleFactor,
        },
      },
    };
  }
}

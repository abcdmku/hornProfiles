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
    const actualMouthRadius = Math.min(mouthRadius, r0_mm * 0.999);

    // The tractrix equation gives x as a function of radius y:
    // x = r0 * ln((r0 + sqrt(r0^2 - y^2)) / y) - sqrt(r0^2 - y^2)
    // This naturally gives larger x for smaller y (throat) and smaller x for larger y (mouth)

    const points: Point2D[] = [];
    const tempPoints: { x: number; y: number }[] = [];

    // Generate points from throat to mouth
    for (let i = 0; i <= resolution; i++) {
      const y = throatRadius + (actualMouthRadius - throatRadius) * (i / resolution);

      if (y > 0 && y < r0_mm) {
        // Tractrix equation
        const sqrtTerm = Math.sqrt(r0_mm * r0_mm - y * y);
        const x = r0_mm * Math.log((r0_mm + sqrtTerm) / y) - sqrtTerm;
        tempPoints.push({ x, y });
      }
    }

    // The tractrix naturally generates x values that decrease as radius increases
    // We need to normalize so x=0 at throat and x=length at mouth
    if (tempPoints.length > 1) {
      // Find the x range
      const xThroat = tempPoints[0].x; // Largest x (at throat)
      const xMouth = tempPoints[tempPoints.length - 1].x; // Smallest x (at mouth)
      const xRange = xThroat - xMouth;

      // Scale and flip to get proper horn profile
      const scaleFactor = xRange > 0 ? length / xRange : 1;

      for (let i = 0; i < tempPoints.length; i++) {
        points.push({
          x: (xThroat - tempPoints[i].x) * scaleFactor,
          y: tempPoints[i].y,
        });
      }
    } else {
      // Fallback to linear if tractrix calculation fails
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

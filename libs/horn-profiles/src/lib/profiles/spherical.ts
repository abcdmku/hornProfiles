import { HornProfileParameters, Point2D, ProfileGeneratorResult } from "../types";
import { BaseHornProfile } from "./base";
import { clamp, sinh, cosh, radiusToCircularArea, circularAreaToRadius } from "../utils/math";

export class SphericalProfile extends BaseHornProfile {
  generate(params: HornProfileParameters): ProfileGeneratorResult {
    this.validateParameters(params);
    const normalizedParams = this.normalizeParameters(params);

    const { throatRadius, mouthRadius, length, resolution, cutoffFrequency, speedOfSound } =
      normalizedParams;

    // Calculate flare constant: m = 4π*fc/c
    // IMPORTANT: Convert to mm since our dimensions are in mm
    // speedOfSound is in m/s, we need it in mm/s
    const speedOfSoundMm = speedOfSound * 1000;
    const m = (4 * Math.PI * cutoffFrequency) / speedOfSoundMm;

    // Calculate wave radius in mm
    const waveRadius = speedOfSoundMm / (2 * Math.PI * cutoffFrequency);

    // T-factor for spherical wave horn (hyperbolic horn)
    // T = 1 for hyperbolic horn
    // T = 0 for catenoidal horn
    const T = 1.0;

    const points: Point2D[] = [];

    // Calculate initial surface area at throat
    const S0 = radiusToCircularArea(throatRadius);

    // Generate points along the horn profile using hyperbolic expansion
    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;

      // Calculate surface area at position x using hyperbolic functions
      // S(x) = S0 * (cosh(m*x/2) + T * sinh(m*x/2))^2
      const mxHalf = (m * x) / 2;
      const expansionFactor = cosh(mxHalf) + T * sinh(mxHalf);
      const Sx = S0 * expansionFactor * expansionFactor;

      // Convert area to radius
      let y = circularAreaToRadius(Sx);

      // Clamp to mouth radius to ensure physical constraints
      y = clamp(y, throatRadius, mouthRadius);

      points.push({ x, y });
    }

    // Ensure smooth transition to mouth radius if needed
    if (points.length > 0) {
      const lastPoint = points[points.length - 1];
      if (Math.abs(lastPoint.y - mouthRadius) > 0.01 && lastPoint.y < mouthRadius) {
        // Apply smoothing for last 10% of profile if we haven't reached mouth radius
        const smoothingPoints = Math.floor(resolution * 0.1);
        const startIndex = Math.max(0, points.length - smoothingPoints - 1);
        const startY = points[startIndex].y;

        for (let i = startIndex + 1; i < points.length; i++) {
          const t = (i - startIndex) / (points.length - startIndex - 1);
          // Smooth interpolation from current position to mouth radius
          points[i].y = startY + (mouthRadius - startY) * t;
        }
      }
    }

    return {
      points,
      metadata: {
        profileType: "spherical",
        parameters: normalizedParams,
        calculatedValues: {
          flareConstant: m,
          waveRadius,
          tFactor: T,
          theoreticalCutoffFrequency: cutoffFrequency,
          volumeExpansion: (mouthRadius / throatRadius) ** 2,
          areaExpansion: (mouthRadius / throatRadius) ** 2,
        },
      },
    };
  }
}

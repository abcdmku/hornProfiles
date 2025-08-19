import { HornProfileParameters, Point2D, ProfileGeneratorResult } from "../types";
import { BaseHornProfile } from "./base";

export class TractrixProfile extends BaseHornProfile {
  generate(params: HornProfileParameters): ProfileGeneratorResult {
    this.validateParameters(params);
    const normalizedParams = this.normalizeParameters(params);

    const { throatWidth, throatHeight, mouthWidth, mouthHeight, length, resolution } =
      normalizedParams;

    // Generate width profile
    const widthProfile = this.generateTractrixCurve(
      throatWidth / 2,
      mouthWidth / 2,
      length,
      resolution,
    );

    // Generate height profile
    const heightProfile = this.generateTractrixCurve(
      throatHeight / 2,
      mouthHeight / 2,
      length,
      resolution,
    );

    // Use the average for the primary profile (for compatibility)
    const points: Point2D[] = [];
    for (let i = 0; i <= resolution; i++) {
      const x = widthProfile[i].x;
      const avgRadius = (widthProfile[i].y + heightProfile[i].y) / 2;
      points.push({ x, y: avgRadius });
    }

    return {
      points,
      widthProfile,
      heightProfile,
      metadata: {
        profileType: "tractrix",
        parameters: normalizedParams,
        calculatedValues: {
          throatArea: (throatWidth * throatHeight) / 4,
          mouthArea: (mouthWidth * mouthHeight) / 4,
          areaExpansion: (mouthWidth * mouthHeight) / (throatWidth * throatHeight),
        },
      },
    };
  }

  private generateTractrixCurve(
    throatRadius: number,
    mouthRadius: number,
    length: number,
    resolution: number,
  ): Point2D[] {
    const points: Point2D[] = [];

    // If mouth <= throat, produce straight/near-straight profile
    if (mouthRadius <= throatRadius || resolution <= 1) {
      for (let i = 0; i <= resolution; i++) {
        const x = (length * i) / resolution;
        const y = throatRadius + (mouthRadius - throatRadius) * (i / resolution);
        points.push({ x, y });
      }
      return points;
    }

    //
    // Tractrix generation using x(y) = a * ln((a + sqrt(a^2 - y^2)) / y) - sqrt(a^2 - y^2)
    // We'll set a = mouthRadius so the tractrix tangent is horizontal at the mouth.
    //
    const a = mouthRadius;

    // helper: compute x(y) raw (measured from mouth inward; x=0 at y=a)
    function xOfY(aVal: number, yVal: number): number {
      // numerical safety
      const inside = aVal * aVal - yVal * yVal;
      if (inside <= 0) {
        // y >= a -> at/above mouth -> x = 0
        return 0;
      }
      const sqrtTerm = Math.sqrt(inside);
      // this is the standard form that returns x >= 0 for y < a, x=0 at y=a
      const ratio = (aVal + sqrtTerm) / yVal;
      // guard ratio numeric issues
      const lnTerm = ratio > 0 ? Math.log(ratio) : 0;
      return aVal * lnTerm - sqrtTerm;
    }

    // compute raw distance from mouth to throat for this 'a'
    const xThroatRaw = xOfY(a, throatRadius);

    // if for some reason the raw x is <= 0 (invalid), fallback to linear cone-like profile
    if (!(isFinite(xThroatRaw) && xThroatRaw > 1e-9)) {
      // fallback linear profile (defensive)
      for (let i = 0; i <= resolution; i++) {
        const x = (length * i) / resolution;
        const y = throatRadius + (mouthRadius - throatRadius) * (i / resolution);
        points.push({ x, y });
      }
    } else {
      // create y samples from throat -> mouth (monotonic increase)
      for (let i = 0; i <= resolution; i++) {
        // linear spacing in y is stable for this inversion approach
        const t = i / resolution;
        const y = throatRadius + (mouthRadius - throatRadius) * t;

        // raw x: 0 at mouth (y=a), xThroatRaw at throat (y=throatRadius)
        const xRaw = xOfY(a, y);

        // position along horn measured from throat: xPos = xThroatRaw - xRaw
        const xPos = xThroatRaw - xRaw;

        // scale into desired physical length
        const xScaled = (xPos / xThroatRaw) * length;

        points.push({
          x: xScaled,
          y: y,
        });
      }
    }

    // ensure monotonic non-decreasing radius (safety)
    for (let i = 1; i < points.length; i++) {
      if (points[i].y < points[i - 1].y) {
        points[i].y = points[i - 1].y;
      }
    }

    return points;
  }
}

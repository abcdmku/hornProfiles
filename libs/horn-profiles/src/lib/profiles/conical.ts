import { HornProfileParameters, Point2D, ProfileGeneratorResult } from "../types";
import { BaseHornProfile } from "./base";
import { radiansToDegrees } from "../utils/math";

export class ConicalProfile extends BaseHornProfile {
  generate(params: HornProfileParameters): ProfileGeneratorResult {
    this.validateParameters(params);
    const normalizedParams = this.normalizeParameters(params);

    const {
      throatRadius,
      mouthRadius,
      throatWidth,
      throatHeight,
      mouthWidth,
      mouthHeight,
      length,
      resolution,
    } = normalizedParams;

    // Calculate flare angle: θ = atan((rm - r0) / L)
    const flareAngle = Math.atan((mouthRadius - throatRadius) / length);
    const expansionRate = Math.tan(flareAngle);

    const points: Point2D[] = [];

    // Generate primary profile (for circular horns or as reference)
    // Formula: r(x) = r0 + x * tan(θ)
    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;
      const y = throatRadius + x * expansionRate;
      points.push({ x, y });
    }

    // Generate width profile if different from circular
    let widthProfile: Point2D[] | undefined;
    if (throatWidth !== throatRadius * 2 || mouthWidth !== mouthRadius * 2) {
      widthProfile = [];
      const widthFlareAngle = Math.atan((mouthWidth / 2 - throatWidth / 2) / length);
      const widthExpansionRate = Math.tan(widthFlareAngle);

      for (let i = 0; i <= resolution; i++) {
        const x = (length * i) / resolution;
        const y = throatWidth / 2 + x * widthExpansionRate;
        widthProfile.push({ x, y });
      }
    }

    // Generate height profile if different from circular
    let heightProfile: Point2D[] | undefined;
    if (throatHeight !== throatRadius * 2 || mouthHeight !== mouthRadius * 2) {
      heightProfile = [];
      const heightFlareAngle = Math.atan((mouthHeight / 2 - throatHeight / 2) / length);
      const heightExpansionRate = Math.tan(heightFlareAngle);

      for (let i = 0; i <= resolution; i++) {
        const x = (length * i) / resolution;
        const y = throatHeight / 2 + x * heightExpansionRate;
        heightProfile.push({ x, y });
      }
    }

    return {
      points,
      widthProfile,
      heightProfile,
      metadata: {
        profileType: "conical",
        parameters: normalizedParams,
        calculatedValues: {
          flareAngle: radiansToDegrees(flareAngle),
          expansionRate,
          volumeExpansion: (mouthRadius / throatRadius) ** 2,
          ...(widthProfile && {
            widthFlareAngle: radiansToDegrees(
              Math.atan((mouthWidth / 2 - throatWidth / 2) / length),
            ),
          }),
          ...(heightProfile && {
            heightFlareAngle: radiansToDegrees(
              Math.atan((mouthHeight / 2 - throatHeight / 2) / length),
            ),
          }),
        },
      },
    };
  }
}

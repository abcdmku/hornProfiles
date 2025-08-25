import { HornProfileParameters, Point2D, ProfileGeneratorResult } from "../types";
import { BaseHornProfile } from "./base";
import { radiansToDegrees } from "../utils/math";

export class ConicalProfile extends BaseHornProfile {
  protected calculateDimensionsAt(
    x: number,
    params: Required<HornProfileParameters>,
  ): { width: number; height: number } {
    const { throatWidth, throatHeight, mouthWidth, mouthHeight, length } = params;

    // Linear interpolation for conical profile
    const widthExpansionRate = (mouthWidth - throatWidth) / length;
    const heightExpansionRate = (mouthHeight - throatHeight) / length;

    const width = throatWidth + x * widthExpansionRate;
    const height = throatHeight + x * heightExpansionRate;

    return { width, height };
  }

  generate(params: HornProfileParameters): ProfileGeneratorResult {
    this.validateParameters(params);
    const normalizedParams = this.normalizeParameters(params);

    const { throatWidth, throatHeight, mouthWidth, mouthHeight, length, resolution } =
      normalizedParams;

    // Generate width profile
    const widthProfile: Point2D[] = [];
    const widthFlareAngle = Math.atan((mouthWidth / 2 - throatWidth / 2) / length);
    const widthExpansionRate = Math.tan(widthFlareAngle);

    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;
      const y = throatWidth / 2 + x * widthExpansionRate;
      widthProfile.push({ x, y });
    }

    // Generate height profile
    const heightProfile: Point2D[] = [];
    const heightFlareAngle = Math.atan((mouthHeight / 2 - throatHeight / 2) / length);
    const heightExpansionRate = Math.tan(heightFlareAngle);

    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;
      const y = throatHeight / 2 + x * heightExpansionRate;
      heightProfile.push({ x, y });
    }

    // Use the average of width and height for the primary profile (for compatibility)
    const points: Point2D[] = [];
    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;
      const avgRadius = (widthProfile[i].y + heightProfile[i].y) / 2;
      points.push({ x, y: avgRadius });
    }

    // Generate shape profile for transitions
    const shapeProfile = this.generateShapeProfile(normalizedParams);
    const transitionMetadata = this.generateTransitionMetadata(normalizedParams);

    return {
      points,
      widthProfile,
      heightProfile,
      shapeProfile,
      metadata: {
        profileType: "conical",
        parameters: normalizedParams,
        calculatedValues: {
          flareAngle: radiansToDegrees(widthFlareAngle), // For backward compatibility
          widthFlareAngle: radiansToDegrees(widthFlareAngle),
          heightFlareAngle: radiansToDegrees(heightFlareAngle),
          widthExpansionRate: widthExpansionRate,
          heightExpansionRate: heightExpansionRate,
          throatArea: (throatWidth * throatHeight) / 4,
          mouthArea: (mouthWidth * mouthHeight) / 4,
          areaExpansion: (mouthWidth * mouthHeight) / (throatWidth * throatHeight),
        },
        transitionMetadata,
      },
    };
  }
}

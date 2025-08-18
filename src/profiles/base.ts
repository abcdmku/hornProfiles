import { HornProfile, HornProfileParameters, ProfileGeneratorResult } from "../types";

export abstract class BaseHornProfile extends HornProfile {
  protected static readonly DEFAULT_RESOLUTION = 100;
  protected static readonly DEFAULT_SPEED_OF_SOUND = 343.2; // m/s at 20°C
  protected static readonly DEFAULT_CUTOFF_FREQUENCY = 100; // Hz

  abstract generate(params: HornProfileParameters): ProfileGeneratorResult;

  getDefaults(): HornProfileParameters {
    return {
      throatRadius: 25, // 25mm (1 inch)
      mouthRadius: 300, // 300mm (~12 inches)
      length: 500, // 500mm (~20 inches)
      resolution: BaseHornProfile.DEFAULT_RESOLUTION,
      cutoffFrequency: BaseHornProfile.DEFAULT_CUTOFF_FREQUENCY,
      speedOfSound: BaseHornProfile.DEFAULT_SPEED_OF_SOUND,
    };
  }

  validateParameters(params: HornProfileParameters): void {
    const errors: string[] = [];

    if (params.throatRadius <= 0) {
      errors.push("Throat radius must be positive");
    }

    if (params.mouthRadius <= 0) {
      errors.push("Mouth radius must be positive");
    }

    if (params.throatRadius >= params.mouthRadius) {
      errors.push("Throat radius must be smaller than mouth radius");
    }

    if (params.length <= 0) {
      errors.push("Length must be positive");
    }

    if (params.resolution !== undefined && params.resolution <= 0) {
      errors.push("Resolution must be positive");
    }

    if (params.resolution !== undefined && !Number.isInteger(params.resolution)) {
      errors.push("Resolution must be an integer");
    }

    if (params.cutoffFrequency !== undefined && params.cutoffFrequency <= 0) {
      errors.push("Cutoff frequency must be positive");
    }

    if (params.speedOfSound !== undefined && params.speedOfSound <= 0) {
      errors.push("Speed of sound must be positive");
    }

    if (errors.length > 0) {
      throw new Error(`Parameter validation failed:\n${errors.join("\n")}`);
    }
  }

  protected normalizeParameters(params: HornProfileParameters): Required<HornProfileParameters> {
    return {
      throatRadius: params.throatRadius,
      mouthRadius: params.mouthRadius,
      length: params.length,
      resolution: params.resolution ?? BaseHornProfile.DEFAULT_RESOLUTION,
      cutoffFrequency: params.cutoffFrequency ?? BaseHornProfile.DEFAULT_CUTOFF_FREQUENCY,
      speedOfSound: params.speedOfSound ?? BaseHornProfile.DEFAULT_SPEED_OF_SOUND,
    };
  }
}

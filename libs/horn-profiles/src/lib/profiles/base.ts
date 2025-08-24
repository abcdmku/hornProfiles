import {
  HornProfile,
  HornProfileParameters,
  CrossSectionMode,
  ShapePoint,
  TransitionMetadata,
} from "../types";

/**
 * Morphing functions for transition control
 */
export const MORPHING_FUNCTIONS = {
  linear: (t: number): number => t,
  cubic: (t: number): number => t * t * (3 - 2 * t), // Smoothstep
  sigmoid: (t: number): number => 1 / (1 + Math.exp(-6 * (t - 0.5))), // S-curve
};

export abstract class BaseHornProfile extends HornProfile {
  protected static readonly DEFAULT_RESOLUTION = 100;
  protected static readonly DEFAULT_SPEED_OF_SOUND = 343.2; // m/s at 20°C
  protected static readonly DEFAULT_CUTOFF_FREQUENCY = 100; // Hz

  getDefaults(): HornProfileParameters {
    return {
      // Provide both radius and width/height for backward compatibility
      throatRadius: 25, // 25mm radius (~1 inch)
      mouthRadius: 300, // 300mm radius (~12 inches)
      throatWidth: 50, // 50mm (~2 inches)
      throatHeight: 50, // 50mm (~2 inches)
      mouthWidth: 600, // 600mm (~24 inches)
      mouthHeight: 600, // 600mm (~24 inches)
      length: 500, // 500mm (~20 inches)
      resolution: BaseHornProfile.DEFAULT_RESOLUTION,
      cutoffFrequency: BaseHornProfile.DEFAULT_CUTOFF_FREQUENCY,
      speedOfSound: BaseHornProfile.DEFAULT_SPEED_OF_SOUND,
      throatShape: "circle",
      mouthShape: "circle",
      morphingFunction: "linear",
    };
  }

  validateParameters(params: HornProfileParameters): void {
    const errors: string[] = [];

    // Check that either radius or width/height parameters are provided
    const hasThroatRadius = params.throatRadius !== undefined;
    const hasThroatDimensions =
      params.throatWidth !== undefined && params.throatHeight !== undefined;
    const hasMouthRadius = params.mouthRadius !== undefined;
    const hasMouthDimensions = params.mouthWidth !== undefined && params.mouthHeight !== undefined;

    if (!hasThroatRadius && !hasThroatDimensions) {
      errors.push("Either throatRadius or both throatWidth and throatHeight must be specified");
    }

    if (!hasMouthRadius && !hasMouthDimensions) {
      errors.push("Either mouthRadius or both mouthWidth and mouthHeight must be specified");
    }

    // Validate radius parameters if provided
    if (hasThroatRadius && params.throatRadius !== undefined && params.throatRadius <= 0) {
      errors.push("Throat radius must be positive");
    }
    if (hasMouthRadius && params.mouthRadius !== undefined && params.mouthRadius <= 0) {
      errors.push("Mouth radius must be positive");
    }
    if (
      hasThroatRadius &&
      hasMouthRadius &&
      params.throatRadius !== undefined &&
      params.mouthRadius !== undefined &&
      params.throatRadius >= params.mouthRadius
    ) {
      errors.push("Throat radius must be smaller than mouth radius");
    }

    // Validate width/height parameters if provided
    if (params.throatWidth !== undefined && params.throatWidth <= 0) {
      errors.push("Throat width must be positive");
    }
    if (params.throatHeight !== undefined && params.throatHeight <= 0) {
      errors.push("Throat height must be positive");
    }
    if (params.mouthWidth !== undefined && params.mouthWidth <= 0) {
      errors.push("Mouth width must be positive");
    }
    if (params.mouthHeight !== undefined && params.mouthHeight <= 0) {
      errors.push("Mouth height must be positive");
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

    // Shape transition validation
    if (params.transitionLength !== undefined) {
      if (params.transitionLength <= 0) {
        errors.push("Transition length must be positive");
      }
      if (params.transitionLength > params.length) {
        errors.push("Transition length cannot exceed total horn length");
      }
    }

    // Validate shape compatibility
    const throatShape = params.throatShape ?? "circle";
    const mouthShape = params.mouthShape ?? "circle";
    this.validateShapeTransition(throatShape, mouthShape);

    if (errors.length > 0) {
      throw new Error(`Parameter validation failed:\n${errors.join("\n")}`);
    }
  }

  protected validateShapeTransition(throat: CrossSectionMode, mouth: CrossSectionMode): void {
    const supportedShapes = ["circle", "ellipse", "rectangular", "superellipse"];
    if (!supportedShapes.includes(throat) || !supportedShapes.includes(mouth)) {
      throw new Error(`Unsupported shape transition: ${throat} to ${mouth}`);
    }
  }

  protected normalizeParameters(params: HornProfileParameters): Required<HornProfileParameters> {
    // Handle backward compatibility: convert radius to width/height
    let throatWidth = params.throatWidth;
    let throatHeight = params.throatHeight;
    let mouthWidth = params.mouthWidth;
    let mouthHeight = params.mouthHeight;
    const throatRadius = params.throatRadius;
    const mouthRadius = params.mouthRadius;

    // If radius parameters are provided but width/height aren't, convert them
    if (throatRadius !== undefined && (throatWidth === undefined || throatHeight === undefined)) {
      throatWidth = throatWidth ?? throatRadius * 2;
      throatHeight = throatHeight ?? throatRadius * 2;
    }
    if (mouthRadius !== undefined && (mouthWidth === undefined || mouthHeight === undefined)) {
      mouthWidth = mouthWidth ?? mouthRadius * 2;
      mouthHeight = mouthHeight ?? mouthRadius * 2;
    }

    // Ensure we have valid dimensions
    if (throatWidth === undefined || throatHeight === undefined) {
      throw new Error("Either throatRadius or both throatWidth and throatHeight must be specified");
    }
    if (mouthWidth === undefined || mouthHeight === undefined) {
      throw new Error("Either mouthRadius or both mouthWidth and mouthHeight must be specified");
    }

    return {
      throatRadius: throatRadius ?? Math.min(throatWidth, throatHeight) / 2,
      mouthRadius: mouthRadius ?? Math.min(mouthWidth, mouthHeight) / 2,
      throatWidth,
      throatHeight,
      mouthWidth,
      mouthHeight,
      length: params.length,
      resolution: params.resolution ?? BaseHornProfile.DEFAULT_RESOLUTION,
      cutoffFrequency: params.cutoffFrequency ?? BaseHornProfile.DEFAULT_CUTOFF_FREQUENCY,
      speedOfSound: params.speedOfSound ?? BaseHornProfile.DEFAULT_SPEED_OF_SOUND,
      throatShape: params.throatShape ?? "circle",
      mouthShape: params.mouthShape ?? "circle",
      transitionLength: params.transitionLength ?? params.length,
      morphingFunction: params.morphingFunction ?? "linear",
    };
  }

  protected generateShapeProfile(params: Required<HornProfileParameters>): ShapePoint[] {
    const { length, resolution, throatShape, mouthShape, transitionLength, morphingFunction } =
      params;
    const morphFunc = MORPHING_FUNCTIONS[morphingFunction];

    const shapeProfile: ShapePoint[] = [];
    const transitionStart = 0;
    const transitionEnd = transitionLength ?? length;

    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;
      let morphingFactor: number;

      if (throatShape === mouthShape) {
        morphingFactor = 0; // No morphing needed
      } else if (x <= transitionStart) {
        morphingFactor = 0; // Pure throat shape
      } else if (x >= transitionEnd) {
        morphingFactor = 1; // Pure mouth shape
      } else {
        // Morph within transition region
        const t = (x - transitionStart) / (transitionEnd - transitionStart);
        morphingFactor = morphFunc(t);
      }

      // Calculate dimensions at this position
      const { width, height } = this.calculateDimensionsAt(x, params);

      shapeProfile.push({
        x,
        shape: morphingFactor === 0 ? throatShape : morphingFactor === 1 ? mouthShape : "morphed",
        morphingFactor,
        width,
        height,
      });
    }

    return shapeProfile;
  }

  protected generateTransitionMetadata(
    params: Required<HornProfileParameters>,
  ): TransitionMetadata {
    const { length, throatShape, mouthShape, transitionLength, morphingFunction } = params;
    const hasTransition = throatShape !== mouthShape;

    return {
      hasTransition,
      transitionStart: 0,
      transitionEnd: transitionLength ?? length,
      morphingFunction,
    };
  }

  protected abstract calculateDimensionsAt(
    x: number,
    params: Required<HornProfileParameters>,
  ): { width: number; height: number };
}

export interface Point2D {
  x: number;
  y: number;
}

export type CrossSectionMode = "ellipse" | "superellipse" | "rectangular" | "stereographic";

export interface HornProfileParameters {
  // Backward compatible radius-based parameters (for circular profiles)
  throatRadius?: number; // Throat radius (mm) - deprecated, use throatWidth/Height
  mouthRadius?: number; // Mouth radius (mm) - deprecated, use mouthWidth/Height

  // New dimension-based parameters (for non-circular profiles)
  throatWidth?: number; // Initial width at throat (mm)
  throatHeight?: number; // Initial height at throat (mm)
  mouthWidth?: number; // Final width at mouth (mm)
  mouthHeight?: number; // Final height at mouth (mm)

  length: number; // L - Total horn length (mm)
  resolution?: number; // Number of points to generate (default: 100)
  cutoffFrequency?: number; // fc - Cutoff frequency in Hz
  speedOfSound?: number; // c - Speed of sound (default: 343.2 m/s)

  // Shape transition parameters
  throatShape?: CrossSectionMode; // Default: "ellipse"
  mouthShape?: CrossSectionMode; // Default: "ellipse"
  transitionLength?: number; // Length over which to morph (default: full length)
  morphingFunction?: "linear" | "cubic" | "sigmoid"; // Default: 'linear'
}

export interface ShapePoint {
  x: number; // Axial position
  shape: CrossSectionMode | "morphed";
  morphingFactor: number; // 0 = throat shape, 1 = mouth shape
  width: number;
  height: number;
}

export interface TransitionMetadata {
  hasTransition: boolean;
  transitionStart: number;
  transitionEnd: number;
  morphingFunction: string;
}

export interface ProfileGeneratorResult {
  points: Point2D[]; // Primary profile (radius or width)
  widthProfile?: Point2D[]; // Separate width profile for non-circular horns
  heightProfile?: Point2D[]; // Separate height profile for non-circular horns
  shapeProfile?: ShapePoint[]; // Shape at each axial position
  metadata: {
    profileType: string;
    parameters: HornProfileParameters;
    calculatedValues: Record<string, number>;
    transitionMetadata?: TransitionMetadata;
  };
}

export abstract class HornProfile {
  abstract generate(params: HornProfileParameters): ProfileGeneratorResult;
  abstract getDefaults(): HornProfileParameters;
  abstract validateParameters(params: HornProfileParameters): void;
}

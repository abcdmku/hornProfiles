export const PARAMETER_CONSTRAINTS = {
  throatWidth: { min: 1, max: 1000, default: 50 },
  throatHeight: { min: 1, max: 1000, default: 50 },
  mouthWidth: { min: 10, max: 5000, default: 600 },
  mouthHeight: { min: 10, max: 5000, default: 600 },
  length: { min: 10, max: 10000, default: 500 },
  resolution: { min: 10, max: 500, default: 100 },
  cutoffFrequency: { min: 20, max: 20000, default: 100 },
  speedOfSound: { min: 100, max: 500, default: 343.2 },
} as const;

export type ParameterKey = keyof typeof PARAMETER_CONSTRAINTS;

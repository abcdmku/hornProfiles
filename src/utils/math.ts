export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function calculateFlareConstant(cutoffFrequency: number, speedOfSound: number): number {
  return (4 * Math.PI * cutoffFrequency) / speedOfSound;
}

export function calculateCutoffFrequency(mouthRadius: number, speedOfSound: number): number {
  return speedOfSound / (2 * Math.PI * mouthRadius);
}

export function calculateWaveLength(frequency: number, speedOfSound: number): number {
  return speedOfSound / frequency;
}

export function circularAreaToRadius(area: number): number {
  return Math.sqrt(area / Math.PI);
}

export function radiusToCircularArea(radius: number): number {
  return Math.PI * radius * radius;
}

export function safeSqrt(value: number): number {
  if (value < 0) {
    return 0;
  }
  return Math.sqrt(value);
}

export function safeLog(value: number): number {
  if (value <= 0) {
    throw new Error(`Cannot take logarithm of non-positive value: ${value}`);
  }
  return Math.log(value);
}

export function safeDivide(numerator: number, denominator: number): number {
  if (Math.abs(denominator) < Number.EPSILON) {
    throw new Error("Division by zero");
  }
  return numerator / denominator;
}

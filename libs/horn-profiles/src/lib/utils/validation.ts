export function isPositive(value: number, name: string): void {
  if (value <= 0) {
    throw new Error(`${name} must be positive, got ${value}`);
  }
}

export function isNonNegative(value: number, name: string): void {
  if (value < 0) {
    throw new Error(`${name} must be non-negative, got ${value}`);
  }
}

export function isInRange(value: number, min: number, max: number, name: string): void {
  if (value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}, got ${value}`);
  }
}

export function isInteger(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer, got ${value}`);
  }
}

export function isFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number, got ${value}`);
  }
}

export function validateArrayLength(array: unknown[], minLength: number, name: string): void {
  if (array.length < minLength) {
    throw new Error(`${name} must have at least ${minLength} elements, got ${array.length}`);
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

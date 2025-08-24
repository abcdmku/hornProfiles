import React from "react";

export interface NumericInputConfig {
  min?: number;
  max?: number;
  defaultValue: number;
  allowEmpty?: boolean;
  precision?: number;
}

export function createSafeNumericHandler(
  config: NumericInputConfig,
  onChange: (value: number | "") => void,
): (e: React.ChangeEvent<HTMLInputElement>) => void {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;

    // Allow empty string for better UX
    if (rawValue === "" && config.allowEmpty) {
      onChange("");
      return;
    }

    const numValue = parseFloat(rawValue);

    // Validate numeric value
    if (isNaN(numValue)) {
      return; // Ignore invalid input
    }

    // Apply constraints
    let constrainedValue = numValue;
    if (config.min !== undefined) {
      constrainedValue = Math.max(config.min, constrainedValue);
    }
    if (config.max !== undefined) {
      constrainedValue = Math.min(config.max, constrainedValue);
    }

    onChange(constrainedValue);
  };
}

export function safeAspectRatioCalculation(
  baseValue: number,
  referenceValue: number,
  fallbackRatio = 1,
): number {
  if (referenceValue === 0 || !isFinite(referenceValue)) {
    return baseValue * fallbackRatio;
  }
  const ratio = baseValue / referenceValue;
  if (!isFinite(ratio)) {
    return baseValue * fallbackRatio;
  }
  return ratio;
}

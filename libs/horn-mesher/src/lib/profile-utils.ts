import type { ProfileXY, DriverMountConfig, HornMountConfig, MountOffsets } from "@horn-sim/types";

/**
 * Calculate effective profile with mount offsets applied
 */
export function calculateEffectiveProfile(
  profile: ProfileXY,
  driverMount?: DriverMountConfig,
  hornMount?: HornMountConfig,
): { profile: ProfileXY; offsets: MountOffsets } {
  let effectiveProfile = [...profile];
  const offsets: MountOffsets = {};

  // Trim profile at driver mount offset
  if (driverMount?.enabled && driverMount.thickness > 0) {
    offsets.driverMountOffset = driverMount.thickness;
    effectiveProfile = trimProfileAtStart(effectiveProfile, driverMount.thickness);
  }

  // Trim profile at horn mount offset
  if (hornMount?.enabled && hornMount.thickness > 0) {
    offsets.hornMountOffset = hornMount.thickness;
    effectiveProfile = trimProfileAtEnd(effectiveProfile, hornMount.thickness);
  }

  return { profile: effectiveProfile, offsets };
}

/**
 * Interpolate profile radius at a specific x position
 */
export function interpolateProfileAt(profile: ProfileXY, xPosition: number): number {
  // Handle edge cases
  if (profile.length === 0) {
    throw new Error("Cannot interpolate empty profile");
  }
  if (profile.length === 1) {
    return profile[0].y;
  }

  // Check if position is outside profile bounds
  if (xPosition <= profile[0].x) {
    return profile[0].y;
  }
  if (xPosition >= profile[profile.length - 1].x) {
    return profile[profile.length - 1].y;
  }

  // Find surrounding points
  let lower = profile[0];
  let upper = profile[profile.length - 1];

  for (let i = 0; i < profile.length - 1; i++) {
    if (profile[i].x <= xPosition && profile[i + 1].x >= xPosition) {
      lower = profile[i];
      upper = profile[i + 1];
      break;
    }
  }

  // Linear interpolation
  const t = (xPosition - lower.x) / (upper.x - lower.x);
  return lower.y + t * (upper.y - lower.y);
}

/**
 * Trim profile at the start (driver mount end)
 */
export function trimProfileAtStart(profile: ProfileXY, offsetDistance: number): ProfileXY {
  if (profile.length === 0 || offsetDistance <= 0) {
    return profile;
  }

  const startX = profile[0].x;
  const newStartX = startX + offsetDistance;
  const trimmedProfile: ProfileXY = [];

  // Add interpolated point at the new start position if it's within profile bounds
  if (newStartX < profile[profile.length - 1].x) {
    const interpolatedY = interpolateProfileAt(profile, newStartX);
    trimmedProfile.push({ x: newStartX, y: interpolatedY });
  }

  // Add all points after the new start position
  for (const point of profile) {
    if (point.x > newStartX) {
      trimmedProfile.push(point);
    }
  }

  return trimmedProfile;
}

/**
 * Trim profile at the end (horn mount end)
 */
export function trimProfileAtEnd(profile: ProfileXY, offsetDistance: number): ProfileXY {
  if (profile.length === 0 || offsetDistance <= 0) {
    return profile;
  }

  const endX = profile[profile.length - 1].x;
  const newEndX = endX - offsetDistance;
  const trimmedProfile: ProfileXY = [];

  // Add all points before the new end position
  for (const point of profile) {
    if (point.x < newEndX) {
      trimmedProfile.push(point);
    }
  }

  // Add interpolated point at the new end position if it's within profile bounds
  if (newEndX > profile[0].x) {
    const interpolatedY = interpolateProfileAt(profile, newEndX);
    trimmedProfile.push({ x: newEndX, y: interpolatedY });
  }

  return trimmedProfile;
}

/**
 * Calculate dimensions at a specific profile position
 */
export function calculateDimensionsAt(
  profile: ProfileXY,
  widthProfile: ProfileXY | undefined,
  heightProfile: ProfileXY | undefined,
  xPosition: number,
  defaultWidth?: number,
  defaultHeight?: number,
): { width: number; height: number } {
  // Get base radius from main profile
  const baseRadius = interpolateProfileAt(profile, xPosition);

  // Calculate width
  const width = widthProfile
    ? interpolateProfileAt(widthProfile, xPosition) * 2
    : (defaultWidth ?? baseRadius * 2);

  // Calculate height
  const height = heightProfile
    ? interpolateProfileAt(heightProfile, xPosition) * 2
    : (defaultHeight ?? baseRadius * 2);

  return { width, height };
}

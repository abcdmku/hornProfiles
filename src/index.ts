// Export types
export * from "./types";

// Export profiles
export { BaseHornProfile } from "./profiles/base";
export { ConicalProfile } from "./profiles/conical";
export { ExponentialProfile } from "./profiles/exponential";
export { TractrixProfile } from "./profiles/tractrix";
export { SphericalProfile } from "./profiles/spherical";

// Export registry
export { ProfileRegistry } from "./registry";

// Export utilities
export * as MathUtils from "./utils/math";
export * as ValidationUtils from "./utils/validation";

// Import for registration
import { ProfileRegistry } from "./registry";
import { ConicalProfile } from "./profiles/conical";
import { ExponentialProfile } from "./profiles/exponential";
import { TractrixProfile } from "./profiles/tractrix";
import { SphericalProfile } from "./profiles/spherical";
import { HornProfileParameters, ProfileGeneratorResult } from "./types";

// Auto-register built-in profiles
ProfileRegistry.register("conical", ConicalProfile);
ProfileRegistry.register("exponential", ExponentialProfile);
ProfileRegistry.register("tractrix", TractrixProfile);
ProfileRegistry.register("spherical", SphericalProfile);

// Convenience function for generating profiles
export function generateProfile(
  type: string,
  params: HornProfileParameters,
): ProfileGeneratorResult {
  const profile = ProfileRegistry.createInstance(type);
  profile.validateParameters(params);
  return profile.generate(params);
}

// Export available profile types
export function getAvailableProfiles(): string[] {
  return ProfileRegistry.list();
}

import { ProfileRegistry } from "./registry";
import { ConicalProfile } from "./profiles/conical";
import { ExponentialProfile } from "./profiles/exponential";
import { TractrixProfile } from "./profiles/tractrix";
import { HornProfileParameters, ProfileGeneratorResult } from "./types";

// Auto-register built-in profiles
ProfileRegistry.register("conical", ConicalProfile);
ProfileRegistry.register("exponential", ExponentialProfile);
ProfileRegistry.register("tractrix", TractrixProfile);

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

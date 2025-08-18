// Export types
export * from "./lib/types";

// Export profiles
export { BaseHornProfile } from "./lib/profiles/base";
export { ConicalProfile } from "./lib/profiles/conical";
export { ExponentialProfile } from "./lib/profiles/exponential";
export { TractrixProfile } from "./lib/profiles/tractrix";

// Export registry
export { ProfileRegistry } from "./lib/registry";

// Export utilities
export * as MathUtils from "./lib/utils/math";
export * as ValidationUtils from "./lib/utils/validation";

// Export main API functions
export { generateProfile, getAvailableProfiles } from "./lib/main";

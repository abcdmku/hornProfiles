import { HornProfile } from "../types";

interface ProfileConstructor {
  new (): HornProfile;
}

export class ProfileRegistry {
  private static profiles = new Map<string, ProfileConstructor>();

  static register(name: string, profileClass: ProfileConstructor): void {
    const normalizedName = name.toLowerCase().trim();
    if (normalizedName.length === 0) {
      throw new Error("Profile name cannot be empty");
    }
    this.profiles.set(normalizedName, profileClass);
  }

  static get(name: string): ProfileConstructor | undefined {
    return this.profiles.get(name.toLowerCase().trim());
  }

  static has(name: string): boolean {
    return this.profiles.has(name.toLowerCase().trim());
  }

  static list(): string[] {
    return Array.from(this.profiles.keys());
  }

  static clear(): void {
    this.profiles.clear();
  }

  static createInstance(name: string): HornProfile {
    const ProfileClass = this.get(name);
    if (!ProfileClass) {
      throw new Error(
        `Unknown profile type: ${name}. Available profiles: ${this.list().join(", ")}`,
      );
    }
    return new ProfileClass();
  }
}

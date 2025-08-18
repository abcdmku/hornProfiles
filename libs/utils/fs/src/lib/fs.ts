import * as fs from "fs/promises";
import * as path from "path";
import type { StorageProvider } from "@horn-sim/types";

export class LocalStorageProvider implements StorageProvider {
  constructor(private basePath: string) {}

  private getFullPath(key: string): string {
    return path.join(this.basePath, key);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.getFullPath(key));
      return true;
    } catch {
      return false;
    }
  }

  async read(key: string): Promise<Buffer> {
    return await fs.readFile(this.getFullPath(key));
  }

  async write(key: string, data: Buffer): Promise<void> {
    const fullPath = this.getFullPath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(this.getFullPath(key));
  }

  async list(prefix: string): Promise<string[]> {
    const dir = this.getFullPath(prefix);
    try {
      const files = await fs.readdir(dir, { recursive: true });
      return files.map((file) => path.join(prefix, file.toString()));
    } catch {
      return [];
    }
  }
}

export class MemoryStorageProvider implements StorageProvider {
  private storage = new Map<string, Buffer>();

  async exists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  async read(key: string): Promise<Buffer> {
    const data = this.storage.get(key);
    if (!data) {
      throw new Error(`Key not found: ${key}`);
    }
    return data;
  }

  async write(key: string, data: Buffer): Promise<void> {
    this.storage.set(key, data);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async list(prefix: string): Promise<string[]> {
    return Array.from(this.storage.keys()).filter((key) => key.startsWith(prefix));
  }
}

export function createStorageProvider(
  type: "local" | "memory" = "local",
  options: { basePath?: string } = {},
): StorageProvider {
  if (type === "memory") {
    return new MemoryStorageProvider();
  }
  return new LocalStorageProvider(options.basePath || "./storage");
}

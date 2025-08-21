import { describe, it, expect } from "vitest";
import { generateHornMesh2D } from "./horn-mesher";

describe("hornMesher", () => {
  it("should generate 2D mesh from profile", () => {
    const profile = [
      { x: 0, y: 20 },
      { x: 50, y: 30 },
      { x: 100, y: 50 },
      { x: 150, y: 80 },
    ];

    const mesh = generateHornMesh2D(profile, {
      resolution: 16,
      closedPath: false,
    });

    // Verify mesh has vertices and indices
    expect(mesh.vertices).toBeDefined();
    expect(mesh.indices).toBeDefined();
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);

    // Verify mesh data is valid
    expect(mesh.indices.length % 3).toBe(0); // Triangles have 3 indices each
  });
});

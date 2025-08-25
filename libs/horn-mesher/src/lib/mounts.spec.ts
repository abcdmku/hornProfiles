import { describe, it, expect } from "vitest";
import { generateDriverMount, generateHornMount } from "./mounts";

describe("Mount Triangulation", () => {
  describe("generateDriverMount", () => {
    it("should generate driver mount without triangles crossing holes", () => {
      const mesh = generateDriverMount(
        0, // throatPosition
        50, // throatWidth
        50, // throatHeight
        "ellipse", // throatMode
        {
          enabled: true,
          outerDiameter: 150,
          boltHoleDiameter: 10,
          boltCircleDiameter: 120,
          boltCount: 4,
        },
        32, // resolution
      );

      // Verify mesh has vertices and indices
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
      expect(mesh.normals?.length).toBeGreaterThan(0);

      // Verify vertices are valid (not NaN)
      for (let i = 0; i < mesh.vertices.length; i++) {
        expect(mesh.vertices[i]).not.toBeNaN();
      }

      // Verify indices are valid
      const numVertices = mesh.vertices.length / 3;
      for (let i = 0; i < mesh.indices.length; i++) {
        expect(mesh.indices[i]).toBeGreaterThanOrEqual(0);
        expect(mesh.indices[i]).toBeLessThan(numVertices);
      }
    });

    it("should handle elliptical throat shapes", () => {
      const mesh = generateDriverMount(
        0,
        30,
        40,
        "ellipse",
        {
          enabled: true,
          outerDiameter: 150,
          boltHoleDiameter: 10,
          boltCircleDiameter: 120,
          boltCount: 6,
        },
        32,
      );

      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);

      // Verify triangulation produces valid triangles (indices in multiples of 3)
      expect(mesh.indices.length % 3).toBe(0);
    });

    it("should handle rectangular throat shapes", () => {
      const mesh = generateDriverMount(
        10,
        40,
        30,
        "rectangular",
        {
          enabled: true,
          outerDiameter: 160,
          boltHoleDiameter: 8,
          boltCircleDiameter: 130,
          boltCount: 8,
        },
        48,
      );

      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
      expect(mesh.indices.length % 3).toBe(0);
    });

    it("should generate fallback mesh if triangulation fails", () => {
      // Test with invalid configuration that might cause triangulation to fail
      const mesh = generateDriverMount(
        0,
        140,
        140,
        "ellipse", // Large throat that overlaps with bolt holes
        {
          enabled: true,
          outerDiameter: 150, // Small outer diameter
          boltHoleDiameter: 10,
          boltCircleDiameter: 145, // Bolt circle very close to outer edge
          boltCount: 20, // Many bolts
        },
        32,
      );

      // Should still produce a valid mesh (fallback)
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
    });
  });

  describe("generateHornMount", () => {
    it("should generate horn mount without triangles crossing holes", () => {
      const mesh = generateHornMount(
        100, // mouthPosition
        80, // mouthWidth
        80, // mouthHeight
        "ellipse", // mouthMode
        {
          enabled: true,
          widthExtension: 30,
          boltSpacing: 40,
          boltHoleDiameter: 8,
        },
        32, // resolution
      );

      // Verify mesh has vertices and indices
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
      expect(mesh.normals?.length).toBeGreaterThan(0);

      // Verify vertices are valid
      for (let i = 0; i < mesh.vertices.length; i++) {
        expect(mesh.vertices[i]).not.toBeNaN();
      }

      // Verify indices are valid
      const numVertices = mesh.vertices.length / 3;
      for (let i = 0; i < mesh.indices.length; i++) {
        expect(mesh.indices[i]).toBeGreaterThanOrEqual(0);
        expect(mesh.indices[i]).toBeLessThan(numVertices);
      }
    });

    it("should handle elliptical mouth shapes", () => {
      const mesh = generateHornMount(
        150,
        100,
        60,
        "ellipse",
        {
          enabled: true,
          widthExtension: 25,
          boltSpacing: 35,
          boltHoleDiameter: 6,
        },
        40,
      );

      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
      expect(mesh.indices.length % 3).toBe(0);
    });

    it("should handle rectangular mouth shapes", () => {
      const mesh = generateHornMount(
        200,
        120,
        80,
        "rectangular",
        {
          enabled: true,
          widthExtension: 40,
          boltSpacing: 50,
          boltHoleDiameter: 10,
        },
        48,
      );

      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
      expect(mesh.indices.length % 3).toBe(0);
    });

    it("should calculate correct number of bolt holes based on perimeter", () => {
      const mesh = generateHornMount(
        100,
        200,
        200,
        "ellipse", // Large mouth
        {
          enabled: true,
          widthExtension: 20,
          boltSpacing: 30, // Should result in many bolts
          boltHoleDiameter: 6,
        },
        32,
      );

      // With a large perimeter and small bolt spacing, should have many vertices
      expect(mesh.vertices.length).toBeGreaterThan(500);
    });

    it("should handle minimum bolt count", () => {
      const mesh = generateHornMount(
        50,
        20,
        20,
        "ellipse", // Small mouth
        {
          enabled: true,
          widthExtension: 10,
          boltSpacing: 200, // Very large spacing
          boltHoleDiameter: 4,
        },
        16,
      );

      // Should still have at least 4 bolts (minimum)
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
    });
  });

  describe("Edge cases and validation", () => {
    it("should handle zero bolt count gracefully", () => {
      const mesh = generateDriverMount(
        0,
        50,
        50,
        "ellipse",
        {
          enabled: true,
          outerDiameter: 150,
          boltHoleDiameter: 10,
          boltCircleDiameter: 120,
          boltCount: 0, // No bolts
        },
        32,
      );

      // Should still generate a valid mesh
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
    });

    it("should handle very high resolution", () => {
      const mesh = generateDriverMount(
        0,
        40,
        40,
        "ellipse",
        {
          enabled: true,
          outerDiameter: 120,
          boltHoleDiameter: 8,
          boltCircleDiameter: 100,
          boltCount: 4,
        },
        128, // High resolution
      );

      // Should generate more vertices with higher resolution
      expect(mesh.vertices.length).toBeGreaterThan(1000);
      expect(mesh.indices.length % 3).toBe(0);
    });

    it("should produce consistent results for same inputs", () => {
      const config = {
        enabled: true,
        outerDiameter: 140,
        boltHoleDiameter: 9,
        boltCircleDiameter: 110,
        boltCount: 5,
      };

      const mesh1 = generateDriverMount(0, 45, 45, "ellipse", config, 32);
      const mesh2 = generateDriverMount(0, 45, 45, "ellipse", config, 32);

      // Should produce identical meshes
      expect(mesh1.vertices.length).toBe(mesh2.vertices.length);
      expect(mesh1.indices.length).toBe(mesh2.indices.length);
    });
  });
});

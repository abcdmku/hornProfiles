import { describe, it, expect } from "vitest";
import { generateHornMesh3D } from "./horn-mesh-3d";
import type { HornGeometry } from "@horn-sim/types";

describe("Horn Mesh 3D - Mount Integration", () => {
  const baseGeometry: HornGeometry = {
    mode: "circle",
    profile: [
      { x: 0, y: 25 },
      { x: 50, y: 35 },
      { x: 100, y: 50 },
      { x: 150, y: 70 },
      { x: 200, y: 100 },
    ],
    throatRadius: 25,
  };

  describe("Offset-based profile redefinition", () => {
    it("should shift horn start when driver mount is present", () => {
      const geometry: HornGeometry = {
        ...baseGeometry,
        driverMount: {
          enabled: true,
          thickness: 10,
          outerDiameter: 150,
          boltHoleDiameter: 8,
          boltCircleDiameter: 120,
          boltCount: 4,
        },
      };

      const mesh = generateHornMesh3D(geometry, { resolution: 16 });

      // Find minimum x coordinate in vertices
      let minX = Infinity;
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        minX = Math.min(minX, mesh.vertices[i]);
      }

      // Horn should start at offset position (10mm)
      expect(minX).toBeCloseTo(10, 1);
    });

    it("should shift horn end when horn mount is present", () => {
      const geometry: HornGeometry = {
        ...baseGeometry,
        hornMount: {
          enabled: true,
          thickness: 15,
          widthExtension: 20,
          boltSpacing: 30,
          boltHoleDiameter: 6,
        },
      };

      const mesh = generateHornMesh3D(geometry, { resolution: 16 });

      // Find maximum x coordinate in vertices
      let maxX = -Infinity;
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        maxX = Math.max(maxX, mesh.vertices[i]);
      }

      // Horn should end at offset position (200 - 15 = 185mm)
      expect(maxX).toBeCloseTo(185, 1);
    });

    it("should handle both driver and horn mounts", () => {
      const geometry: HornGeometry = {
        ...baseGeometry,
        driverMount: {
          enabled: true,
          thickness: 10,
          outerDiameter: 150,
          boltHoleDiameter: 8,
          boltCircleDiameter: 120,
          boltCount: 4,
        },
        hornMount: {
          enabled: true,
          thickness: 15,
          widthExtension: 20,
          boltSpacing: 30,
          boltHoleDiameter: 6,
        },
      };

      const mesh = generateHornMesh3D(geometry, { resolution: 16 });

      let minX = Infinity;
      let maxX = -Infinity;
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        minX = Math.min(minX, mesh.vertices[i]);
        maxX = Math.max(maxX, mesh.vertices[i]);
      }

      expect(minX).toBeCloseTo(10, 1);
      expect(maxX).toBeCloseTo(185, 1);
    });
  });

  describe("Watertight mesh generation", () => {
    it("should produce valid mesh with correct triangle count", () => {
      const geometry: HornGeometry = {
        ...baseGeometry,
        driverMount: {
          enabled: true,
          thickness: 10,
          outerDiameter: 150,
          boltHoleDiameter: 8,
          boltCircleDiameter: 120,
          boltCount: 4,
        },
      };

      const mesh = generateHornMesh3D(geometry, { resolution: 16 });

      // Check that indices are valid triangles
      expect(mesh.indices.length % 3).toBe(0);

      // Check that all indices reference valid vertices
      const numVertices = mesh.vertices.length / 3;
      for (let i = 0; i < mesh.indices.length; i++) {
        expect(mesh.indices[i]).toBeGreaterThanOrEqual(0);
        expect(mesh.indices[i]).toBeLessThan(numVertices);
      }
    });

    it("should produce mesh with normals", () => {
      const geometry: HornGeometry = {
        ...baseGeometry,
        hornMount: {
          enabled: true,
          thickness: 15,
          widthExtension: 20,
          boltSpacing: 30,
          boltHoleDiameter: 6,
        },
      };

      const mesh = generateHornMesh3D(geometry, { resolution: 16 });

      expect(mesh.normals).toBeDefined();
      expect(mesh.normals?.length).toBe(mesh.vertices.length);
    });

    it("should handle no mounts gracefully", () => {
      const mesh = generateHornMesh3D(baseGeometry, { resolution: 16 });

      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
      expect(mesh.normals?.length).toBe(mesh.vertices.length);
    });
  });

  describe("Cross-section mode support", () => {
    it("should handle elliptical cross-section with mounts", () => {
      const geometry: HornGeometry = {
        ...baseGeometry,
        mode: "ellipse",
        width: 60,
        height: 40,
        driverMount: {
          enabled: true,
          thickness: 10,
          outerDiameter: 150,
          boltHoleDiameter: 8,
          boltCircleDiameter: 120,
          boltCount: 4,
        },
      };

      const mesh = generateHornMesh3D(geometry, { resolution: 20 });

      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
    });

    it("should handle rectangular cross-section with mounts", () => {
      const geometry: HornGeometry = {
        ...baseGeometry,
        mode: "rectangular",
        width: 80,
        height: 60,
        hornMount: {
          enabled: true,
          thickness: 15,
          widthExtension: 20,
          boltSpacing: 30,
          boltHoleDiameter: 6,
        },
      };

      const mesh = generateHornMesh3D(geometry, { resolution: 24 });

      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
    });
  });

  describe("Resolution handling", () => {
    it("should generate more vertices with higher resolution", () => {
      const geometry: HornGeometry = {
        ...baseGeometry,
        driverMount: {
          enabled: true,
          thickness: 10,
          outerDiameter: 150,
          boltHoleDiameter: 8,
          boltCircleDiameter: 120,
          boltCount: 4,
        },
      };

      const lowResMesh = generateHornMesh3D(geometry, { resolution: 8 });
      const highResMesh = generateHornMesh3D(geometry, { resolution: 32 });

      expect(highResMesh.vertices.length).toBeGreaterThan(lowResMesh.vertices.length);
      expect(highResMesh.indices.length).toBeGreaterThan(lowResMesh.indices.length);
    });
  });

  describe("Edge cases", () => {
    it("should handle very small mount thickness", () => {
      const geometry: HornGeometry = {
        ...baseGeometry,
        driverMount: {
          enabled: true,
          thickness: 0.1,
          outerDiameter: 150,
          boltHoleDiameter: 8,
          boltCircleDiameter: 120,
          boltCount: 4,
        },
      };

      const mesh = generateHornMesh3D(geometry, { resolution: 16 });

      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
    });

    it("should handle zero mount thickness", () => {
      const geometry: HornGeometry = {
        ...baseGeometry,
        driverMount: {
          enabled: true,
          thickness: 0,
          outerDiameter: 150,
          boltHoleDiameter: 8,
          boltCircleDiameter: 120,
          boltCount: 4,
        },
      };

      const mesh = generateHornMesh3D(geometry, { resolution: 16 });

      // Should still generate valid mesh
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
    });

    it("should handle disabled mounts with thickness set", () => {
      const geometry: HornGeometry = {
        ...baseGeometry,
        driverMount: {
          enabled: false,
          thickness: 10,
          outerDiameter: 150,
          boltHoleDiameter: 8,
          boltCircleDiameter: 120,
          boltCount: 4,
        },
      };

      const mesh = generateHornMesh3D(geometry, { resolution: 16 });

      // Should ignore disabled mount
      let minX = Infinity;
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        minX = Math.min(minX, mesh.vertices[i]);
      }

      // Horn should start at original position (0mm)
      expect(minX).toBeCloseTo(0, 1);
    });
  });

  describe("Mesh integrity", () => {
    it("should produce consistent vertex count for same parameters", () => {
      const geometry: HornGeometry = {
        ...baseGeometry,
        driverMount: {
          enabled: true,
          thickness: 10,
          outerDiameter: 150,
          boltHoleDiameter: 8,
          boltCircleDiameter: 120,
          boltCount: 4,
        },
        hornMount: {
          enabled: true,
          thickness: 15,
          widthExtension: 20,
          boltSpacing: 30,
          boltHoleDiameter: 6,
        },
      };

      const mesh1 = generateHornMesh3D(geometry, { resolution: 16 });
      const mesh2 = generateHornMesh3D(geometry, { resolution: 16 });

      expect(mesh1.vertices.length).toBe(mesh2.vertices.length);
      expect(mesh1.indices.length).toBe(mesh2.indices.length);
    });

    it("should not have NaN or Infinity values in vertices", () => {
      const geometry: HornGeometry = {
        ...baseGeometry,
        driverMount: {
          enabled: true,
          thickness: 10,
          outerDiameter: 150,
          boltHoleDiameter: 8,
          boltCircleDiameter: 120,
          boltCount: 4,
        },
      };

      const mesh = generateHornMesh3D(geometry, { resolution: 16 });

      for (let i = 0; i < mesh.vertices.length; i++) {
        expect(mesh.vertices[i]).not.toBeNaN();
        expect(mesh.vertices[i]).not.toBe(Infinity);
        expect(mesh.vertices[i]).not.toBe(-Infinity);
      }
    });
  });
});

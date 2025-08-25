import type { HornGeometry, MeshData } from "@horn-sim/types";
import type { MeshGenerationOptions } from "./types";
import { generateHornMesh2D } from "./horn-mesh-2d";
import { generateHornMesh3D } from "./horn-mesh-3d";

// Re-export types for backward compatibility
export type { MeshGenerationOptions } from "./types";

/**
 * Main entry point for horn mesh generation
 * Automatically selects between 2D and 3D generation based on geometry
 */
export function generateHornMesh(geometry: HornGeometry, options: MeshGenerationOptions): MeshData {
  // Check if we can use optimized 2D generation for simple elliptical horns
  if (isSimpleEllipticalHorn(geometry)) {
    return generateHornMesh2D(geometry.profile, options);
  }

  // Use full 3D generation for complex geometries
  return generateHornMesh3D(geometry, options);
}

/**
 * Check if geometry is a simple elliptical horn that can use 2D generation
 */
function isSimpleEllipticalHorn(geometry: HornGeometry): boolean {
  return (
    geometry.mode === "ellipse" &&
    !geometry.widthProfile &&
    !geometry.heightProfile &&
    !geometry.driverMount?.enabled &&
    !geometry.hornMount?.enabled
  );
}

/**
 * Generate a 2D horn mesh (backward compatibility)
 * @deprecated Use generateHornMesh instead
 */
export { generateHornMesh2D };

/**
 * Generate a 3D horn mesh (backward compatibility)
 * @deprecated Use generateHornMesh instead
 */
export { generateHornMesh3D };

// Re-export mesh converters for backward compatibility
export { meshToThree, meshToGmsh, meshToElmer } from "./mesh-converters";

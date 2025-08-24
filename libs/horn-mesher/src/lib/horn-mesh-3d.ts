import type {
  HornGeometry,
  MeshData,
  MountOffsets,
  ProfileXY,
  CrossSectionMode,
  DriverMountConfig,
  HornMountConfig,
} from "@horn-sim/types";
import type { MeshGenerationOptions } from "./types";
import { generateCrossSection, generateCrossSectionPoints } from "./cross-section";
import { generateDriverMount, generateHornMount } from "./mounts";
import { mergeMeshData } from "./mesh-utils";
import { calculateDimensionsAt, trimProfileAtStart, trimProfileAtEnd } from "./profile-utils";
import { calculatePerimeter } from "./point-utils";
import { MESH_DEFAULTS } from "./constants";

/**
 * Generate a 3D horn mesh with support for various cross-sections and integrated mounts
 */
export function generateHornMesh3D(
  geometry: HornGeometry,
  options: MeshGenerationOptions,
): MeshData {
  const { resolution = 50 } = options;

  // Calculate mount offsets (but don't trim the profile)
  const offsets: MountOffsets = {};
  if (geometry.driverMount?.enabled && geometry.driverMount.thickness > 0) {
    offsets.driverMountOffset = geometry.driverMount.thickness;
  }
  if (geometry.hornMount?.enabled && geometry.hornMount.thickness > 0) {
    offsets.hornMountOffset = geometry.hornMount.thickness;
  }

  // Generate integrated horn body with mounts using ORIGINAL profile
  return generateIntegratedHornBody(geometry, geometry.profile, offsets, resolution);
}

/**
 * Generate integrated horn body with mounts as a single watertight mesh
 */
function generateIntegratedHornBody(
  geometry: HornGeometry,
  originalProfile: ProfileXY,
  offsets: MountOffsets,
  resolution: number,
): MeshData {
  const meshes: MeshData[] = [];
  const hasWallThickness = (geometry.wallThickness ?? 0) > 0;

  // Generate driver mount at original position if enabled
  if (geometry.driverMount?.enabled) {
    const mountPosition = geometry.profile[0].x; // Original throat position
    const { width: throatWidth, height: throatHeight } = calculateDimensionsAt(
      geometry.profile,
      geometry.widthProfile,
      geometry.heightProfile,
      mountPosition,
      geometry.width,
      geometry.height,
    );

    const driverMountMesh = generateDriverMount(
      mountPosition,
      throatWidth,
      throatHeight,
      geometry.mode,
      geometry.driverMount,
      resolution,
    );

    meshes.push(driverMountMesh);

    // If we have wall thickness and mount thickness, add outer mount face
    // This connects to the outer (expanded) horn surface
    if (hasWallThickness && geometry.driverMount.thickness > 0 && geometry.wallThickness) {
      const offsetPosition = mountPosition + geometry.driverMount.thickness;

      // Find the radius at the offset position and add wall thickness
      let offsetRadius = 0;
      for (let i = 0; i < geometry.profile.length - 1; i++) {
        if (
          geometry.profile[i].x <= offsetPosition &&
          geometry.profile[i + 1].x >= offsetPosition
        ) {
          // Linear interpolation between profile points
          const t =
            (offsetPosition - geometry.profile[i].x) /
            (geometry.profile[i + 1].x - geometry.profile[i].x);
          offsetRadius =
            geometry.profile[i].y + t * (geometry.profile[i + 1].y - geometry.profile[i].y);
          break;
        }
      }
      if (offsetRadius === 0 && geometry.profile.length > 0) {
        offsetRadius = geometry.profile[0].y; // Fallback to first point
      }

      // Add wall thickness radially
      const offsetProfileRadius = offsetRadius + geometry.wallThickness;

      // Get base dimensions at the original position
      const { width: baseWidth, height: baseHeight } = calculateDimensionsAt(
        geometry.profile,
        geometry.widthProfile,
        geometry.heightProfile,
        offsetPosition,
        geometry.width,
        geometry.height,
      );

      // Calculate outer dimensions based on the perpendicular offset
      let outerWidth: number;
      let outerHeight: number;

      if (geometry.mode === "circle") {
        outerWidth = offsetProfileRadius * 2;
        outerHeight = offsetProfileRadius * 2;
      } else if (geometry.mode === "ellipse" || geometry.mode === "rectangular") {
        // Scale dimensions proportionally based on radius increase
        if (offsetRadius > 0) {
          const scaleFactor = offsetProfileRadius / offsetRadius;
          outerWidth = baseWidth * scaleFactor;
          outerHeight = baseHeight * scaleFactor;
        } else {
          outerWidth = baseWidth + 2 * geometry.wallThickness;
          outerHeight = baseHeight + 2 * geometry.wallThickness;
        }
      } else {
        outerWidth = baseWidth + 2 * geometry.wallThickness;
        outerHeight = baseHeight + 2 * geometry.wallThickness;
      }

      // Generate outer mount face with same outer diameter and bolt holes as inner mount
      // But with inner hole sized to match the offset horn surface
      const outerMountConfig = {
        ...geometry.driverMount,
        thickness: 0, // Generate face only
      };

      // Create a modified generateDriverMount call that uses offset dimensions for inner hole
      // but keeps original mount outer dimensions
      const outerMountMesh = generateDriverMountWithCustomInner(
        offsetPosition,
        outerWidth, // Inner hole width (offset horn surface)
        outerHeight, // Inner hole height (offset horn surface)
        geometry.mode,
        outerMountConfig,
        resolution,
      );

      meshes.push(outerMountMesh);

      // Add connection between inner and outer mount faces at their outer edges
      const edgeConnection = generateMountEdgeConnection(
        mountPosition, // Inner mount position
        offsetPosition, // Outer mount position
        geometry.driverMount.outerDiameter, // Width
        geometry.driverMount.outerDiameter, // Height (circular)
        "circle", // Driver mount is always circular
        0, // No additional extension for driver mount edge
        resolution,
      );
      meshes.push(edgeConnection);

      // Add bolt hole connections
      const boltConnections = generateBoltHoleConnections(
        mountPosition,
        offsetPosition,
        geometry.driverMount.boltCircleDiameter,
        geometry.driverMount.boltHoleDiameter,
        geometry.driverMount.boltCount,
        resolution,
      );
      meshes.push(boltConnections);
    } else if (!hasWallThickness && geometry.driverMount.thickness > 0) {
      // Single-walled horn: add mount face at offset position
      const offsetPosition = mountPosition + geometry.driverMount.thickness;
      const { width: offsetWidth, height: offsetHeight } = calculateDimensionsAt(
        geometry.profile,
        geometry.widthProfile,
        geometry.heightProfile,
        offsetPosition,
        geometry.width,
        geometry.height,
      );

      const innerMountMesh = generateDriverMount(
        offsetPosition,
        offsetWidth,
        offsetHeight,
        geometry.mode,
        { ...geometry.driverMount, thickness: 0 }, // Generate face only
        resolution,
      );

      meshes.push(innerMountMesh);
    }
  }

  // Generate main horn body (with wall thickness if specified)
  if (hasWallThickness && geometry.wallThickness) {
    const doubleWalledMesh = generateDoubleWalledHornBody(
      geometry,
      originalProfile,
      geometry.wallThickness,
      resolution,
    );
    meshes.push(doubleWalledMesh);
  } else {
    const hornBodyMesh = generateHornBodyMesh(geometry, originalProfile, resolution);
    meshes.push(hornBodyMesh);
  }

  // Generate horn mount at original position if enabled
  if (geometry.hornMount?.enabled) {
    const mountPosition = geometry.profile[geometry.profile.length - 1].x; // Original mouth position
    const { width: mouthWidth, height: mouthHeight } = calculateDimensionsAt(
      geometry.profile,
      geometry.widthProfile,
      geometry.heightProfile,
      mountPosition,
      geometry.width,
      geometry.height,
    );

    const hornMountMesh = generateHornMount(
      mountPosition,
      mouthWidth,
      mouthHeight,
      geometry.mode,
      geometry.hornMount,
      resolution,
    );

    meshes.push(hornMountMesh);

    // If we have wall thickness and mount thickness, add outer mount face
    // This connects to the outer (expanded) horn surface
    if (hasWallThickness && geometry.hornMount.thickness > 0 && geometry.wallThickness) {
      const offsetPosition = mountPosition - geometry.hornMount.thickness;

      // Find the radius at the offset position and add wall thickness
      let offsetRadius = geometry.profile[geometry.profile.length - 1].y; // Default to last point
      for (let i = geometry.profile.length - 1; i > 0; i--) {
        if (
          geometry.profile[i].x >= offsetPosition &&
          geometry.profile[i - 1].x <= offsetPosition
        ) {
          // Linear interpolation between profile points
          const t =
            (offsetPosition - geometry.profile[i - 1].x) /
            (geometry.profile[i].x - geometry.profile[i - 1].x);
          offsetRadius =
            geometry.profile[i - 1].y + t * (geometry.profile[i].y - geometry.profile[i - 1].y);
          break;
        }
      }

      // Add wall thickness radially
      const offsetProfileRadius = offsetRadius + geometry.wallThickness;

      // Get base dimensions at the original position
      const { width: baseWidth, height: baseHeight } = calculateDimensionsAt(
        geometry.profile,
        geometry.widthProfile,
        geometry.heightProfile,
        offsetPosition,
        geometry.width,
        geometry.height,
      );

      // Calculate outer dimensions based on the perpendicular offset
      let outerWidth: number;
      let outerHeight: number;

      if (geometry.mode === "circle") {
        outerWidth = offsetProfileRadius * 2;
        outerHeight = offsetProfileRadius * 2;
      } else if (geometry.mode === "ellipse" || geometry.mode === "rectangular") {
        // Scale dimensions proportionally based on radius increase
        if (offsetRadius > 0) {
          const scaleFactor = offsetProfileRadius / offsetRadius;
          outerWidth = baseWidth * scaleFactor;
          outerHeight = baseHeight * scaleFactor;
        } else {
          outerWidth = baseWidth + 2 * geometry.wallThickness;
          outerHeight = baseHeight + 2 * geometry.wallThickness;
        }
      } else {
        outerWidth = baseWidth + 2 * geometry.wallThickness;
        outerHeight = baseHeight + 2 * geometry.wallThickness;
      }

      // Generate outer mount face with same outer diameter and bolt holes as inner mount
      // But with inner hole sized to match the offset horn surface
      // Get original mouth dimensions for outer boundary
      const originalMouthWidth = geometry.width ?? mouthWidth;
      const originalMouthHeight = geometry.height ?? mouthHeight;

      const outerMountMesh = generateHornMountWithCustomInner(
        offsetPosition,
        outerWidth, // Inner hole width (offset horn surface)
        outerHeight, // Inner hole height (offset horn surface)
        originalMouthWidth, // Original mouth width for outer boundary
        originalMouthHeight, // Original mouth height for outer boundary
        geometry.mode,
        { ...geometry.hornMount, thickness: 0 }, // Generate face only
        resolution,
      );

      meshes.push(outerMountMesh);

      // Add connection between inner and outer mount faces at their outer edges
      const edgeConnection = generateMountEdgeConnection(
        mountPosition, // Inner mount position (at mouth)
        offsetPosition, // Outer mount position (offset inward)
        originalMouthWidth, // Original mouth width
        originalMouthHeight, // Original mouth height
        geometry.mode, // Use the horn's cross-section mode
        geometry.hornMount.widthExtension, // Extension amount
        resolution,
      );
      meshes.push(edgeConnection);

      // Add bolt hole connections for horn mount
      const boltConnections = generateHornMountBoltConnections(
        mountPosition,
        offsetPosition,
        originalMouthWidth,
        originalMouthHeight,
        geometry.mode,
        geometry.hornMount.boltHoleDiameter,
        geometry.hornMount.boltSpacing,
        geometry.hornMount.widthExtension,
        resolution,
      );
      meshes.push(boltConnections);
    } else if (!hasWallThickness && geometry.hornMount.thickness > 0) {
      // Single-walled horn: add mount face at offset position
      const offsetPosition = mountPosition - geometry.hornMount.thickness;
      const { width: offsetWidth, height: offsetHeight } = calculateDimensionsAt(
        geometry.profile,
        geometry.widthProfile,
        geometry.heightProfile,
        offsetPosition,
        geometry.width,
        geometry.height,
      );

      const innerMountMesh = generateHornMount(
        offsetPosition,
        offsetWidth,
        offsetHeight,
        geometry.mode,
        { ...geometry.hornMount, thickness: 0 }, // Generate face only
        resolution,
      );

      meshes.push(innerMountMesh);
    }
  }

  // Merge all meshes into a single watertight mesh
  return meshes.length > 1 ? mergeMeshData(meshes) : meshes[0];
}

/**
 * Generate double-walled horn body with specified wall thickness
 * Creates two separate horn surfaces (inner and outer) that are open at throat/mouth
 * The inner surface follows the full design profile, outer surface is expanded and trimmed
 */
function generateDoubleWalledHornBody(
  geometry: HornGeometry,
  originalProfile: ProfileXY,
  wallThickness: number,
  resolution: number,
): MeshData {
  const { mode, widthProfile, heightProfile } = geometry;
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  // Calculate trimmed profile for outer surface based on mount offsets
  let outerProfile = [...originalProfile];
  if (geometry.driverMount?.enabled && geometry.driverMount.thickness > 0) {
    outerProfile = trimProfileAtStart(outerProfile, geometry.driverMount.thickness);
  }
  if (geometry.hornMount?.enabled && geometry.hornMount.thickness > 0) {
    outerProfile = trimProfileAtEnd(outerProfile, geometry.hornMount.thickness);
  }

  const circumferenceSteps = resolution;
  const innerProfileSteps = originalProfile.length;
  const outerProfileSteps = outerProfile.length;

  // Generate inner wall vertices (the actual horn profile - acoustic surface, FULL LENGTH)
  for (let i = 0; i < innerProfileSteps; i++) {
    const point = originalProfile[i];
    const x = point.x;

    // Calculate dimensions at this profile position
    const { width, height } = calculateDimensionsAt(
      originalProfile,
      widthProfile,
      heightProfile,
      x,
      geometry.width,
      geometry.height,
    );

    // Generate inner cross-section (the design profile)
    const innerRadius = point.y;
    const crossSection = generateCrossSection(mode, innerRadius, width, height, circumferenceSteps);

    // Add vertices and normals for inner wall
    for (const csPoint of crossSection) {
      vertices.push(x, csPoint.y, csPoint.z);

      // Calculate normal vector (pointing inward for inner surface)
      const len = Math.sqrt(csPoint.y * csPoint.y + csPoint.z * csPoint.z);
      if (len > 0) {
        normals.push(0, -csPoint.y / len, -csPoint.z / len);
      } else {
        normals.push(0, 0, -1);
      }
    }
  }

  // Calculate the offset profile for the outer wall
  // For a horn, we want to maintain equal wall thickness measured perpendicular to the surface
  // Since the horn is a surface of revolution, adding constant radial thickness gives equal wall thickness
  const offsetProfile: ProfileXY = [];
  for (let i = 0; i < outerProfile.length; i++) {
    const point = outerProfile[i];

    // Simply add wall thickness radially - this gives uniform wall thickness for a surface of revolution
    // Keep the same X position to maintain horn length
    offsetProfile.push({
      x: point.x, // Keep original X position - no length change
      y: point.y + wallThickness, // Add wall thickness radially
    });
  }

  // Generate outer wall vertices (using perpendicular offset for equal thickness)
  // This creates the external surface of the horn wall
  const outerStartIdx = innerProfileSteps * circumferenceSteps;
  for (let i = 0; i < outerProfileSteps; i++) {
    const point = offsetProfile[i];
    const x = point.x;

    // Calculate dimensions at this profile position
    // Use the offset radius but keep the aspect ratio scaling
    const { width, height } = calculateDimensionsAt(
      outerProfile,
      widthProfile,
      heightProfile,
      outerProfile[i].x, // Use original x position for dimension scaling
      geometry.width,
      geometry.height,
    );

    // For elliptical and rectangular modes, we need to scale the offset proportionally
    // to maintain the shape while adding thickness
    let outerWidth = width;
    let outerHeight = height;

    if (mode === "ellipse" || mode === "rectangular") {
      // Calculate the scaling factor based on the radius increase
      const innerRadius = outerProfile[i].y;
      const outerRadius = point.y;
      if (innerRadius > 0) {
        const scaleFactor = outerRadius / innerRadius;
        outerWidth = width * scaleFactor;
        outerHeight = height * scaleFactor;
      }
    } else {
      // For circular mode, the radius is already offset correctly
      outerWidth = point.y * 2;
      outerHeight = point.y * 2;
    }

    const crossSection = generateCrossSection(
      mode,
      point.y,
      outerWidth,
      outerHeight,
      circumferenceSteps,
    );

    // Add vertices and normals for outer wall
    for (const csPoint of crossSection) {
      vertices.push(x, csPoint.y, csPoint.z);

      // Calculate normal vector (pointing outward)
      const len = Math.sqrt(csPoint.y * csPoint.y + csPoint.z * csPoint.z);
      if (len > 0) {
        normals.push(0, csPoint.y / len, csPoint.z / len);
      } else {
        normals.push(0, 0, 1);
      }
    }
  }

  // Generate triangle indices for inner wall (the acoustic surface - reversed winding for inward normals)
  for (let i = 0; i < innerProfileSteps - 1; i++) {
    for (let j = 0; j < circumferenceSteps; j++) {
      const a = i * circumferenceSteps + j;
      const b = i * circumferenceSteps + ((j + 1) % circumferenceSteps);
      const c = (i + 1) * circumferenceSteps + j;
      const d = (i + 1) * circumferenceSteps + ((j + 1) % circumferenceSteps);

      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // Generate triangle indices for outer wall (expanded and trimmed surface)
  for (let i = 0; i < outerProfileSteps - 1; i++) {
    for (let j = 0; j < circumferenceSteps; j++) {
      const a = outerStartIdx + i * circumferenceSteps + j;
      const b = outerStartIdx + i * circumferenceSteps + ((j + 1) % circumferenceSteps);
      const c = outerStartIdx + (i + 1) * circumferenceSteps + j;
      const d = outerStartIdx + (i + 1) * circumferenceSteps + ((j + 1) % circumferenceSteps);

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Connect inner and outer walls at throat edge
  // Only connect if there's no driver mount or if mount has no thickness
  if (!geometry.driverMount?.enabled) {
    connectWalls(
      indices,
      0, // Inner wall throat (acoustic surface at original position)
      outerStartIdx, // Outer wall throat (starts at trimmed position)
      circumferenceSteps,
      false, // Throat end
    );
  }
  // When driver mount has thickness, the mount faces themselves connect the walls
  // No additional connection needed here

  // Connect inner and outer walls at mouth edge
  // Only connect if there's no horn mount or if mount has no thickness
  if (!geometry.hornMount?.enabled) {
    connectWalls(
      indices,
      (innerProfileSteps - 1) * circumferenceSteps, // Inner wall mouth at original position
      outerStartIdx + (outerProfileSteps - 1) * circumferenceSteps, // Outer wall mouth
      circumferenceSteps,
      true, // Mouth end
    );
  }
  // When horn mount has thickness, the mount faces themselves connect the walls
  // No additional connection needed here

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

/**
 * Connect inner and outer walls at an edge
 */
function connectWalls(
  indices: number[],
  innerStart: number,
  outerStart: number,
  steps: number,
  reverse: boolean,
): void {
  for (let i = 0; i < steps; i++) {
    const j = (i + 1) % steps;
    const inner1 = innerStart + i;
    const inner2 = innerStart + j;
    const outer1 = outerStart + i;
    const outer2 = outerStart + j;

    if (reverse) {
      // Mouth end - reversed winding
      indices.push(inner1, outer1, inner2);
      indices.push(inner2, outer1, outer2);
    } else {
      // Throat end - normal winding
      indices.push(inner1, inner2, outer1);
      indices.push(inner2, outer2, outer1);
    }
  }
}

/**
 * Generate a connection between two mount faces at their outer edges
 * Supports different cross-section shapes for horn mounts
 */
function generateMountEdgeConnection(
  innerMountPosition: number,
  outerMountPosition: number,
  width: number,
  height: number,
  mode: CrossSectionMode,
  mountExtension: number,
  resolution: number,
): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  const circumferenceSteps = resolution;

  // Calculate the actual outer dimensions including extension
  const extensionFactor = 1 + mountExtension / Math.max(width, height);
  const outerWidth = (width / 2) * extensionFactor;
  const outerHeight = (height / 2) * extensionFactor;

  // Generate outer edge points based on cross-section mode
  const generateOuterEdge = (
    mode: CrossSectionMode,
    width: number,
    height: number,
  ): { y: number; z: number }[] => {
    const points: { y: number; z: number }[] = [];

    if (mode === "circle") {
      const radius = Math.max(width, height);
      for (let i = 0; i < circumferenceSteps; i++) {
        const angle = (i / circumferenceSteps) * 2 * Math.PI;
        points.push({
          y: radius * Math.cos(angle),
          z: radius * Math.sin(angle),
        });
      }
    } else if (mode === "ellipse") {
      for (let i = 0; i < circumferenceSteps; i++) {
        const angle = (i / circumferenceSteps) * 2 * Math.PI;
        points.push({
          y: width * Math.cos(angle),
          z: height * Math.sin(angle),
        });
      }
    } else if (mode === "rectangular") {
      // Generate rectangular perimeter points
      // This is simplified - actual implementation would need rounded corners
      for (let i = 0; i < circumferenceSteps; i++) {
        const t = i / circumferenceSteps;
        const perimeter = 2 * (width + height);
        const pos = t * perimeter;

        let y, z;
        if (pos < width) {
          y = pos - width / 2;
          z = height / 2;
        } else if (pos < width + height) {
          y = width / 2;
          z = height / 2 - (pos - width);
        } else if (pos < 2 * width + height) {
          y = width / 2 - (pos - width - height);
          z = -height / 2;
        } else {
          y = -width / 2;
          z = -height / 2 + (pos - 2 * width - height);
        }
        points.push({ y, z });
      }
    }

    return points;
  };

  const edgePoints = generateOuterEdge(mode, outerWidth, outerHeight);

  // Generate vertices for inner mount edge (at innerMountPosition)
  for (const point of edgePoints) {
    vertices.push(innerMountPosition, point.y, point.z);

    // Normal pointing outward
    const len = Math.sqrt(point.y * point.y + point.z * point.z);
    if (len > 0) {
      normals.push(0, point.y / len, point.z / len);
    } else {
      normals.push(0, 0, 1);
    }
  }

  // Generate vertices for outer mount edge (at outerMountPosition)
  for (const point of edgePoints) {
    vertices.push(outerMountPosition, point.y, point.z);

    // Normal pointing outward
    const len = Math.sqrt(point.y * point.y + point.z * point.z);
    if (len > 0) {
      normals.push(0, point.y / len, point.z / len);
    } else {
      normals.push(0, 0, 1);
    }
  }

  // Generate triangles to connect the two rings
  for (let i = 0; i < circumferenceSteps; i++) {
    const j = (i + 1) % circumferenceSteps;

    const inner1 = i;
    const inner2 = j;
    const outer1 = circumferenceSteps + i;
    const outer2 = circumferenceSteps + j;

    // Create two triangles for each quad
    indices.push(inner1, inner2, outer1);
    indices.push(inner2, outer2, outer1);
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

/**
 * Generate cylindrical connections between bolt holes on inner and outer mount faces
 */
function generateBoltHoleConnections(
  innerPosition: number,
  outerPosition: number,
  boltCircleDiameter: number,
  boltHoleDiameter: number,
  boltCount: number,
  resolution: number,
): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  const boltRadius = boltHoleDiameter / 2;
  const boltCircleRadius = boltCircleDiameter / 2;
  const holeResolution = Math.max(8, Math.floor(resolution / 4)); // Fewer segments for bolt holes

  // Generate each bolt hole cylinder
  for (let boltIdx = 0; boltIdx < boltCount; boltIdx++) {
    const boltAngle = (boltIdx / boltCount) * 2 * Math.PI;
    const boltCenterY = boltCircleRadius * Math.cos(boltAngle);
    const boltCenterZ = boltCircleRadius * Math.sin(boltAngle);

    const baseVertexIdx = vertices.length / 3;

    // Generate vertices for inner ring of bolt hole
    for (let i = 0; i < holeResolution; i++) {
      const angle = (i / holeResolution) * 2 * Math.PI;
      const y = boltCenterY + boltRadius * Math.cos(angle);
      const z = boltCenterZ + boltRadius * Math.sin(angle);

      // Inner position vertex
      vertices.push(innerPosition, y, z);

      // Normal pointing inward (into the hole)
      const ny = -Math.cos(angle);
      const nz = -Math.sin(angle);
      normals.push(0, ny, nz);
    }

    // Generate vertices for outer ring of bolt hole
    for (let i = 0; i < holeResolution; i++) {
      const angle = (i / holeResolution) * 2 * Math.PI;
      const y = boltCenterY + boltRadius * Math.cos(angle);
      const z = boltCenterZ + boltRadius * Math.sin(angle);

      // Outer position vertex
      vertices.push(outerPosition, y, z);

      // Normal pointing inward (into the hole)
      const ny = -Math.cos(angle);
      const nz = -Math.sin(angle);
      normals.push(0, ny, nz);
    }

    // Generate triangles to connect inner and outer rings
    for (let i = 0; i < holeResolution; i++) {
      const j = (i + 1) % holeResolution;

      const inner1 = baseVertexIdx + i;
      const inner2 = baseVertexIdx + j;
      const outer1 = baseVertexIdx + holeResolution + i;
      const outer2 = baseVertexIdx + holeResolution + j;

      // Create triangles (reversed winding for inward-facing normals)
      indices.push(inner1, outer1, inner2);
      indices.push(inner2, outer1, outer2);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

/**
 * Generate bolt hole connections for horn mount (handles different patterns)
 * Uses the same bolt positioning logic as the mount generation for perfect alignment
 */
function generateHornMountBoltConnections(
  innerPosition: number,
  outerPosition: number,
  mouthWidth: number,
  mouthHeight: number,
  mode: CrossSectionMode,
  boltHoleDiameter: number,
  boltSpacing: number,
  widthExtension: number,
  resolution: number,
): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  const boltRadius = boltHoleDiameter / 2;
  const holeResolution = Math.max(8, Math.floor(resolution / 4));

  // Use the EXACT same point generation as the mount generation
  // This matches what generateHornMount does in mounts.ts
  const extensionFactor = 1 + widthExtension / Math.max(mouthWidth, mouthHeight);

  // Generate reference points exactly as done in mount generation
  const boltReferenceInner = generateCrossSectionPoints(
    mode,
    mouthWidth / 2,
    mouthHeight / 2,
    resolution,
  );

  const outerPoints = generateCrossSectionPoints(
    mode,
    (mouthWidth / 2) * extensionFactor,
    (mouthHeight / 2) * extensionFactor,
    resolution * MESH_DEFAULTS.OUTER_EDGE_MULTIPLIER,
  );

  // Calculate perimeter using the outer points
  const perimeter = calculatePerimeter(outerPoints);
  const boltCount = Math.max(MESH_DEFAULTS.MIN_BOLT_COUNT, Math.ceil(perimeter / boltSpacing));

  // Calculate bolt positions using the exact same logic as mount generation
  // This matches the calculateBoltPosition function in bolt-generation.ts
  const boltPositions: { y: number; z: number }[] = [];

  for (let b = 0; b < boltCount; b++) {
    if (mode === "circle" || mode === "ellipse") {
      // Radial placement - midway between inner and outer
      // Note: outer has more points due to OUTER_EDGE_MULTIPLIER
      const innerIdx = Math.floor((b / boltCount) * boltReferenceInner.length);
      const outerIdx = Math.floor((b / boltCount) * outerPoints.length);
      const innerPoint = boltReferenceInner[innerIdx];
      const outerPoint = outerPoints[outerIdx];

      boltPositions.push({
        y: (innerPoint.y + outerPoint.y) / 2,
        z: (innerPoint.z + outerPoint.z) / 2,
      });
    } else {
      // For rectangular, use separate indices for inner and outer
      const innerIdx = Math.floor((b / boltCount) * boltReferenceInner.length);
      const outerIdx = Math.floor((b / boltCount) * outerPoints.length);
      const innerPoint = boltReferenceInner[innerIdx];
      const outerPoint = outerPoints[outerIdx];

      boltPositions.push({
        y: (innerPoint.y + outerPoint.y) / 2,
        z: (innerPoint.z + outerPoint.z) / 2,
      });
    }
  }

  // Generate cylinder for each bolt hole
  for (const boltPos of boltPositions) {
    const baseVertexIdx = vertices.length / 3;

    // Inner ring vertices
    for (let i = 0; i < holeResolution; i++) {
      const angle = (i / holeResolution) * 2 * Math.PI;
      const y = boltPos.y + boltRadius * Math.cos(angle);
      const z = boltPos.z + boltRadius * Math.sin(angle);

      vertices.push(innerPosition, y, z);

      const ny = -Math.cos(angle);
      const nz = -Math.sin(angle);
      normals.push(0, ny, nz);
    }

    // Outer ring vertices
    for (let i = 0; i < holeResolution; i++) {
      const angle = (i / holeResolution) * 2 * Math.PI;
      const y = boltPos.y + boltRadius * Math.cos(angle);
      const z = boltPos.z + boltRadius * Math.sin(angle);

      vertices.push(outerPosition, y, z);

      const ny = -Math.cos(angle);
      const nz = -Math.sin(angle);
      normals.push(0, ny, nz);
    }

    // Connect rings with triangles
    for (let i = 0; i < holeResolution; i++) {
      const j = (i + 1) % holeResolution;

      const inner1 = baseVertexIdx + i;
      const inner2 = baseVertexIdx + j;
      const outer1 = baseVertexIdx + holeResolution + i;
      const outer2 = baseVertexIdx + holeResolution + j;

      indices.push(inner1, outer1, inner2);
      indices.push(inner2, outer1, outer2);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

/**
 * Generate the main horn body mesh with proper interface vertices
 */
function generateHornBodyMesh(
  geometry: HornGeometry,
  originalProfile: ProfileXY,
  resolution: number,
): MeshData {
  const { mode, widthProfile, heightProfile } = geometry;
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  const circumferenceSteps = resolution;
  const profileSteps = originalProfile.length;

  // Generate vertices for each profile point
  for (let i = 0; i < profileSteps; i++) {
    const point = originalProfile[i];
    const x = point.x;

    // Calculate dimensions at this profile position
    const { width, height } = calculateDimensionsAt(
      originalProfile,
      widthProfile,
      heightProfile,
      x,
      geometry.width,
      geometry.height,
    );

    // Generate cross-section at this position
    const crossSection = generateCrossSection(mode, point.y, width, height, circumferenceSteps);

    // Add vertices and normals for this cross-section
    for (const csPoint of crossSection) {
      vertices.push(x, csPoint.y, csPoint.z);

      // Calculate normal vector
      const len = Math.sqrt(csPoint.y * csPoint.y + csPoint.z * csPoint.z);
      if (len > 0) {
        normals.push(0, csPoint.y / len, csPoint.z / len);
      } else {
        normals.push(0, 0, 1); // Default normal for center point
      }
    }
  }

  // Generate triangle indices for the horn body surface
  for (let i = 0; i < profileSteps - 1; i++) {
    for (let j = 0; j < circumferenceSteps; j++) {
      const a = i * circumferenceSteps + j;
      const b = i * circumferenceSteps + ((j + 1) % circumferenceSteps);
      const c = (i + 1) * circumferenceSteps + j;
      const d = (i + 1) * circumferenceSteps + ((j + 1) % circumferenceSteps);

      // Create two triangles for each quad
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Only add end caps if the horn has wall thickness (double-walled horn)
  // For single-walled horns (no thickness), leave the ends open
  const hasWallThickness = (geometry.wallThickness ?? 0) > 0;
  const hasDriverMount = geometry.driverMount?.enabled;
  const hasHornMount = geometry.hornMount?.enabled;

  // Don't seal throat/mouth for horns without wall thickness
  // Only seal if we have wall thickness OR if there's a mount present
  if (!hasDriverMount && hasWallThickness) {
    // Add throat cap only for double-walled horns
    const throatCenterIdx = vertices.length / 3;
    vertices.push(originalProfile[0].x, 0, 0);
    normals.push(-1, 0, 0); // Normal pointing backward

    for (let j = 0; j < circumferenceSteps; j++) {
      const a = j;
      const b = (j + 1) % circumferenceSteps;
      indices.push(throatCenterIdx, b, a);
    }
  }

  if (!hasHornMount && hasWallThickness) {
    // Add mouth cap only for double-walled horns
    const mouthCenterIdx = vertices.length / 3;
    const lastProfileIdx = profileSteps - 1;
    vertices.push(originalProfile[lastProfileIdx].x, 0, 0);
    normals.push(1, 0, 0); // Normal pointing forward

    for (let j = 0; j < circumferenceSteps; j++) {
      const a = lastProfileIdx * circumferenceSteps + j;
      const b = lastProfileIdx * circumferenceSteps + ((j + 1) % circumferenceSteps);
      indices.push(mouthCenterIdx, a, b);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

// Helper function to generate driver mount with custom inner hole dimensions
function generateDriverMountWithCustomInner(
  position: number,
  innerWidth: number,
  innerHeight: number,
  mode: CrossSectionMode,
  config: DriverMountConfig,
  resolution: number,
): MeshData {
  // Use the standard mount generation but with custom inner dimensions
  return generateDriverMount(position, innerWidth, innerHeight, mode, config, resolution);
}

// Helper function to generate horn mount with custom inner hole dimensions
function generateHornMountWithCustomInner(
  position: number,
  innerWidth: number,
  innerHeight: number,
  originalMouthWidth: number,
  originalMouthHeight: number,
  mode: CrossSectionMode,
  config: HornMountConfig,
  resolution: number,
): MeshData {
  // Pass original mouth dimensions for outer boundary and bolt holes
  // Pass custom inner dimensions for the inner hole
  const configWithCustomInner: HornMountConfig & {
    customInnerWidth: number;
    customInnerHeight: number;
  } = {
    ...config,
    customInnerWidth: innerWidth,
    customInnerHeight: innerHeight,
  };
  return generateHornMount(
    position,
    originalMouthWidth,
    originalMouthHeight,
    mode,
    configWithCustomInner,
    resolution,
  );
}

// Re-export helper functions for compatibility
export { createDriverMount, createHornMount };

/**
 * Helper function to create driver mount (backward compatibility)
 */
function createDriverMount(geometry: HornGeometry, resolution: number): MeshData {
  const { profile, widthProfile, heightProfile, mode, driverMount } = geometry;

  if (!driverMount?.enabled) {
    throw new Error("Driver mount is not enabled");
  }

  const throatPosition = profile[0].x;
  const { width: throatWidth, height: throatHeight } = calculateDimensionsAt(
    profile,
    widthProfile,
    heightProfile,
    throatPosition,
    geometry.width,
    geometry.height,
  );

  return generateDriverMount(
    throatPosition,
    throatWidth,
    throatHeight,
    mode,
    driverMount,
    resolution,
  );
}

/**
 * Helper function to create horn mount (backward compatibility)
 */
function createHornMount(geometry: HornGeometry, resolution: number): MeshData {
  const { profile, widthProfile, heightProfile, mode, hornMount } = geometry;

  if (!hornMount?.enabled) {
    throw new Error("Horn mount is not enabled");
  }

  const mouthPosition = profile[profile.length - 1].x;
  const { width: mouthWidth, height: mouthHeight } = calculateDimensionsAt(
    profile,
    widthProfile,
    heightProfile,
    mouthPosition,
    geometry.width,
    geometry.height,
  );

  return generateHornMount(mouthPosition, mouthWidth, mouthHeight, mode, hornMount, resolution);
}

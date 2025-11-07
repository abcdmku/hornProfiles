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
import { createWatertightMesh } from "./mesh-utils";
import { calculateDimensionsAt, trimProfileAtStart, trimProfileAtEnd } from "./profile-utils";
import { calculatePerimeter } from "./point-utils";
import { MESH_DEFAULTS } from "./constants";
import { morphCrossSectionShapes } from "./shape-morphing";

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
  const singleWallProfile = hasWallThickness
    ? originalProfile
    : getSingleWallProfile(originalProfile, geometry);

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

    // Use throatShape if specified, otherwise use main mode
    const throatShape = geometry.throatShape || geometry.mode;
    // For rectangular throats when mixed with non-rectangular mouths, swap width/height
    const shouldSwapThroat =
      throatShape === "rectangular" && geometry.mouthShape && geometry.mouthShape !== "rectangular";

    const driverMountMesh = generateDriverMount(
      mountPosition,
      shouldSwapThroat ? throatHeight : throatWidth,
      shouldSwapThroat ? throatWidth : throatHeight,
      throatShape,
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

      if (geometry.mode === "ellipse" || geometry.mode === "rectangular") {
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
        "ellipse", // Driver mount is always elliptical (was circular)
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

      const innerMountMesh = generateDriverMountWithCustomInner(
        offsetPosition,
        offsetWidth,
        offsetHeight,
        geometry.mode,
        { ...geometry.driverMount, thickness: 0 }, // Generate face only
        resolution,
      );

      meshes.push(innerMountMesh);

      const throatInnerWidth = shouldSwapThroat ? throatHeight : throatWidth;
      const throatInnerHeight = shouldSwapThroat ? throatWidth : throatHeight;
      const { width: interfaceWidth, height: interfaceHeight } = calculateDimensionsAt(
        geometry.profile,
        geometry.widthProfile,
        geometry.heightProfile,
        offsetPosition,
        geometry.width,
        geometry.height,
      );

      const innerConnection = generateMountInnerConnection(
        mountPosition,
        offsetPosition,
        throatInnerWidth,
        throatInnerHeight,
        interfaceWidth,
        interfaceHeight,
        throatShape,
        resolution,
      );
      meshes.push(innerConnection);

      const edgeConnection = generateMountEdgeConnection(
        mountPosition,
        offsetPosition,
        geometry.driverMount.outerDiameter,
        geometry.driverMount.outerDiameter,
        "ellipse",
        0,
        resolution,
      );
      meshes.push(edgeConnection);

      const boltConnections = generateBoltHoleConnections(
        mountPosition,
        offsetPosition,
        geometry.driverMount.boltCircleDiameter,
        geometry.driverMount.boltHoleDiameter,
        geometry.driverMount.boltCount,
        resolution,
      );
      meshes.push(boltConnections);
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
    const hornBodyMesh = generateHornBodyMesh(geometry, singleWallProfile, resolution);
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
      geometry.mouthShape || geometry.mode,
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

      if (geometry.mode === "ellipse" || geometry.mode === "rectangular") {
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
        geometry.mouthShape || geometry.mode,
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
        geometry.mouthShape || geometry.mode, // Use the mouth shape
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
        geometry.mouthShape || geometry.mode,
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

      const innerMountMesh = generateHornMountWithCustomInner(
        offsetPosition,
        offsetWidth,
        offsetHeight,
        geometry.width ?? mouthWidth,
        geometry.height ?? mouthHeight,
        geometry.mouthShape || geometry.mode,
        { ...geometry.hornMount, thickness: 0 }, // Generate face only
        resolution,
      );

      meshes.push(innerMountMesh);

      const innerConnection = generateMountInnerConnection(
        mountPosition,
        offsetPosition,
        mouthWidth,
        mouthHeight,
        offsetWidth,
        offsetHeight,
        geometry.mouthShape || geometry.mode,
        resolution,
      );
      meshes.push(innerConnection);

      const edgeConnection = generateMountEdgeConnection(
        mountPosition,
        offsetPosition,
        geometry.width ?? mouthWidth,
        geometry.height ?? mouthHeight,
        geometry.mouthShape || geometry.mode,
        geometry.hornMount.widthExtension,
        resolution,
      );
      meshes.push(edgeConnection);

      const boltConnections = generateHornMountBoltConnections(
        mountPosition,
        offsetPosition,
        geometry.width ?? mouthWidth,
        geometry.height ?? mouthHeight,
        geometry.mouthShape || geometry.mode,
        geometry.hornMount.boltHoleDiameter,
        geometry.hornMount.boltSpacing,
        geometry.hornMount.widthExtension,
        resolution,
      );
      meshes.push(boltConnections);
    }
  }

  // Merge all meshes into a single watertight mesh
  return meshes.length > 1 ? createWatertightMesh(meshes) : meshes[0];
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
  const { mode, widthProfile, heightProfile, shapeProfile } = geometry;

  // Check if we have shape transitions
  const hasShapeTransition =
    shapeProfile && shapeProfile.some((sp) => sp.morphingFactor > 0 && sp.morphingFactor < 1);
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
    let crossSection;

    if (hasShapeTransition && shapeProfile) {
      // Generate morphed cross-section
      const shapeData = shapeProfile[i] || shapeProfile[shapeProfile.length - 1];

      if (shapeData.morphingFactor === 0) {
        // Pure throat shape
        const throatShape = geometry.throatShape || mode;
        // For rectangular throats when mixed with other shapes, swap width/height
        const shouldSwap =
          throatShape === "rectangular" &&
          geometry.mouthShape &&
          geometry.mouthShape !== "rectangular";
        crossSection = generateCrossSection(
          throatShape,
          innerRadius,
          shouldSwap ? height : width,
          shouldSwap ? width : height,
          circumferenceSteps,
        );
      } else if (shapeData.morphingFactor === 1) {
        // Pure mouth shape
        crossSection = generateCrossSection(
          geometry.mouthShape || mode,
          innerRadius,
          width,
          height,
          circumferenceSteps,
        );
      } else {
        // Morphed shape
        const throatShape = geometry.throatShape || mode;
        const mouthShape = geometry.mouthShape || mode;
        // For rectangular throats when mixed with non-rectangular mouths, swap width/height
        const shouldSwapThroat = throatShape === "rectangular" && mouthShape !== "rectangular";
        const throatW = geometry.throatWidth || geometry.throatRadius * 2;
        const throatH = geometry.throatHeight || geometry.throatRadius * 2;
        crossSection = morphCrossSectionShapes({
          sourceShape: throatShape,
          targetShape: mouthShape,
          morphFactor: shapeData.morphingFactor,
          sourceWidth: shouldSwapThroat ? throatH : throatW,
          sourceHeight: shouldSwapThroat ? throatW : throatH,
          targetWidth: width, // Use current position's interpolated width
          targetHeight: height, // Use current position's interpolated height
          resolution: circumferenceSteps,
        });
      }
    } else {
      // Existing behavior - uniform shape
      crossSection = generateCrossSection(mode, innerRadius, width, height, circumferenceSteps);
    }

    // Add vertices and normals for inner wall
    for (let j = 0; j < crossSection.length; j++) {
      const csPoint = crossSection[j];
      vertices.push(x, csPoint.y, csPoint.z);

      // Calculate normal vector
      if (mode === "rectangular") {
        // For rectangles, use face normals to preserve sharp corners
        // Determine which face this point belongs to
        const absY = Math.abs(csPoint.y);
        const absZ = Math.abs(csPoint.z);
        const maxDim = Math.max(absY, absZ);

        let ny = 0,
          nz = 0;
        if (maxDim === absY) {
          // Point is on left or right face
          ny = csPoint.y > 0 ? -1 : 1; // Inward normal
          nz = 0;
        } else {
          // Point is on top or bottom face
          ny = 0;
          nz = csPoint.z > 0 ? -1 : 1; // Inward normal
        }

        normals.push(0, ny, nz);
      } else {
        // Original smooth normal calculation for other shapes
        const len = Math.sqrt(csPoint.y * csPoint.y + csPoint.z * csPoint.z);
        if (len > 0) {
          normals.push(0, -csPoint.y / len, -csPoint.z / len);
        } else {
          normals.push(0, 0, -1);
        }
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

    // Get the corresponding shape data for this position
    let currentShape = mode;
    let needsMorphing = false;
    let outerWidth = width;
    let outerHeight = height;

    if (hasShapeTransition && shapeProfile) {
      const shapeData = shapeProfile[i] || shapeProfile[shapeProfile.length - 1];

      if (shapeData.morphingFactor === 0) {
        currentShape = geometry.throatShape || mode;
      } else if (shapeData.morphingFactor === 1) {
        currentShape = geometry.mouthShape || mode;
      } else {
        // For morphed shapes, we'll handle this differently below
        needsMorphing = true;
      }
    }

    // For non-morphed shapes, scale the offset proportionally to maintain shape while adding thickness
    if (!needsMorphing) {
      if (currentShape === "ellipse" || currentShape === "rectangular") {
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
    }

    let crossSection;

    if (needsMorphing && shapeProfile) {
      const shapeData = shapeProfile[i] || shapeProfile[shapeProfile.length - 1];

      // For morphed outer surfaces, we need to scale the dimensions appropriately
      const innerRadius = outerProfile[i].y;
      const outerRadius = point.y;
      const scaleFactor = innerRadius > 0 ? outerRadius / innerRadius : 1;

      const throatShape = geometry.throatShape || mode;
      const mouthShape = geometry.mouthShape || mode;
      // For rectangular throats when mixed with non-rectangular mouths, swap width/height
      const shouldSwapThroat = throatShape === "rectangular" && mouthShape !== "rectangular";
      const throatW = (geometry.throatWidth || geometry.throatRadius * 2) * scaleFactor;
      const throatH = (geometry.throatHeight || geometry.throatRadius * 2) * scaleFactor;
      crossSection = morphCrossSectionShapes({
        sourceShape: throatShape,
        targetShape: mouthShape,
        morphFactor: shapeData.morphingFactor,
        sourceWidth: shouldSwapThroat ? throatH : throatW,
        sourceHeight: shouldSwapThroat ? throatW : throatH,
        targetWidth: width * scaleFactor, // Use current position's scaled width
        targetHeight: height * scaleFactor, // Use current position's scaled height
        resolution: circumferenceSteps,
      });
    } else {
      // Use regular cross-section generation
      crossSection = generateCrossSection(
        currentShape,
        point.y,
        outerWidth,
        outerHeight,
        circumferenceSteps,
      );
    }

    // Add vertices and normals for outer wall
    for (let j = 0; j < crossSection.length; j++) {
      const csPoint = crossSection[j];
      vertices.push(x, csPoint.y, csPoint.z);

      // Calculate normal vector
      if (mode === "rectangular") {
        // For rectangles, use face normals to preserve sharp corners
        // Determine which face this point belongs to
        const absY = Math.abs(csPoint.y);
        const absZ = Math.abs(csPoint.z);
        const maxDim = Math.max(absY, absZ);

        let ny = 0,
          nz = 0;
        if (maxDim === absY) {
          // Point is on left or right face
          ny = csPoint.y > 0 ? 1 : -1; // Outward normal
          nz = 0;
        } else {
          // Point is on top or bottom face
          ny = 0;
          nz = csPoint.z > 0 ? 1 : -1; // Outward normal
        }

        normals.push(0, ny, nz);
      } else {
        // Original smooth normal calculation for other shapes
        const len = Math.sqrt(csPoint.y * csPoint.y + csPoint.z * csPoint.z);
        if (len > 0) {
          normals.push(0, csPoint.y / len, csPoint.z / len);
        } else {
          normals.push(0, 0, 1);
        }
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

  const circumferenceSteps = Math.max(
    MESH_DEFAULTS.MIN_POLYGON_POINTS,
    resolution * MESH_DEFAULTS.OUTER_EDGE_MULTIPLIER,
  );

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

    if (mode === "ellipse") {
      for (let i = 0; i < circumferenceSteps; i++) {
        const angle = (i / circumferenceSteps) * 2 * Math.PI;
        points.push({
          y: width * Math.cos(angle),
          z: height * Math.sin(angle),
        });
      }
    } else if (mode === "rectangular") {
      // Use the same exact logic as cross-section.ts to ensure consistency

      // Special case: if resolution < 4, we can't make a proper rectangle
      if (circumferenceSteps < 4) {
        if (circumferenceSteps === 1) {
          points.push({ y: 0, z: height });
        } else if (circumferenceSteps === 2) {
          points.push({ y: width, z: 0 });
          points.push({ y: -width, z: 0 });
        } else if (circumferenceSteps === 3) {
          points.push({ y: 0, z: height });
          points.push({ y: width, z: 0 });
          points.push({ y: -width, z: 0 });
        }
        return points;
      }

      // Define the 4 corners (in order starting from top-right, going clockwise)
      const corners = [
        { y: width, z: height }, // Top-right
        { y: width, z: -height }, // Bottom-right
        { y: -width, z: -height }, // Bottom-left
        { y: -width, z: height }, // Top-left
      ];

      // Calculate perimeter of each edge
      const edgeLengths = [
        height * 2, // Right edge (top to bottom)
        width * 2, // Bottom edge (right to left)
        height * 2, // Left edge (bottom to top)
        width * 2, // Top edge (left to right)
      ];

      const totalPerimeter = edgeLengths.reduce((sum, len) => sum + len, 0);

      // We have 4 corners already, distribute remaining points
      const interiorPoints = circumferenceSteps - 4;

      if (interiorPoints <= 0) {
        // Just return the 4 corners
        return corners;
      }

      // Distribute interior points proportionally to edge length
      const pointsPerEdge = edgeLengths.map((len) =>
        Math.round((interiorPoints * len) / totalPerimeter),
      );

      // Adjust for rounding errors
      const totalAllocated = pointsPerEdge.reduce((sum, n) => sum + n, 0);
      if (totalAllocated < interiorPoints) {
        const maxIdx = edgeLengths.indexOf(Math.max(...edgeLengths));
        pointsPerEdge[maxIdx] += interiorPoints - totalAllocated;
      } else if (totalAllocated > interiorPoints) {
        const maxIdx = edgeLengths.indexOf(Math.max(...edgeLengths));
        pointsPerEdge[maxIdx] -= totalAllocated - interiorPoints;
      }

      // Generate points starting from top center to match ellipse
      // Start from middle of top edge
      const topEdgePoints = pointsPerEdge[3];
      for (let i = Math.floor(topEdgePoints / 2); i < topEdgePoints; i++) {
        const t = (i + 1) / (topEdgePoints + 1);
        points.push({
          y: -width + t * 2 * width,
          z: height,
        });
      }

      // Top-right corner
      points.push(corners[0]);

      // Right edge interior points
      for (let i = 0; i < pointsPerEdge[0]; i++) {
        const t = (i + 1) / (pointsPerEdge[0] + 1);
        points.push({
          y: width,
          z: height - t * 2 * height,
        });
      }

      // Bottom-right corner
      points.push(corners[1]);

      // Bottom edge interior points
      for (let i = 0; i < pointsPerEdge[1]; i++) {
        const t = (i + 1) / (pointsPerEdge[1] + 1);
        points.push({
          y: width - t * 2 * width,
          z: -height,
        });
      }

      // Bottom-left corner
      points.push(corners[2]);

      // Left edge interior points
      for (let i = 0; i < pointsPerEdge[2]; i++) {
        const t = (i + 1) / (pointsPerEdge[2] + 1);
        points.push({
          y: -width,
          z: -height + t * 2 * height,
        });
      }

      // Top-left corner
      points.push(corners[3]);

      // Top edge interior points (from left to center)
      for (let i = 0; i < Math.floor(topEdgePoints / 2); i++) {
        const t = (i + 1) / (topEdgePoints + 1);
        points.push({
          y: -width + t * 2 * width,
          z: height,
        });
      }

      // Ensure we have exactly the right number of points
      while (points.length > circumferenceSteps) {
        // Remove a non-corner point
        for (let i = 1; i < points.length - 1; i++) {
          const p = points[i];
          const isCorner = corners.some(
            (c) => Math.abs(c.y - p.y) < 0.001 && Math.abs(c.z - p.z) < 0.001,
          );
          if (!isCorner) {
            points.splice(i, 1);
            break;
          }
        }
      }

      while (points.length < circumferenceSteps) {
        // Add a point on the first edge
        points.splice(1, 0, {
          y: (points[0].y + points[1].y) / 2,
          z: (points[0].z + points[1].z) / 2,
        });
      }

      return points;
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
 * Generate a connection between two mount faces at their inner edges.
 * This is used to bridge the horn body to offset mount planes for single-walled builds.
 */
function generateMountInnerConnection(
  startPosition: number,
  endPosition: number,
  startWidth: number,
  startHeight: number,
  endWidth: number,
  endHeight: number,
  mode: CrossSectionMode,
  resolution: number,
): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  const circumferenceSteps = Math.max(MESH_DEFAULTS.MIN_POLYGON_POINTS, resolution);
  const startPoints = generateCrossSectionPoints(
    mode,
    startWidth / 2,
    startHeight / 2,
    circumferenceSteps,
  );
  const endPoints = generateCrossSectionPoints(
    mode,
    endWidth / 2,
    endHeight / 2,
    circumferenceSteps,
  );

  for (const point of startPoints) {
    vertices.push(startPosition, point.y, point.z);
    const len = Math.sqrt(point.y * point.y + point.z * point.z);
    if (len > 0) {
      normals.push(0, point.y / len, point.z / len);
    } else {
      normals.push(0, 0, 1);
    }
  }

  for (const point of endPoints) {
    vertices.push(endPosition, point.y, point.z);
    const len = Math.sqrt(point.y * point.y + point.z * point.z);
    if (len > 0) {
      normals.push(0, point.y / len, point.z / len);
    } else {
      normals.push(0, 0, 1);
    }
  }

  for (let i = 0; i < circumferenceSteps; i++) {
    const j = (i + 1) % circumferenceSteps;
    const start1 = i;
    const start2 = j;
    const end1 = circumferenceSteps + i;
    const end2 = circumferenceSteps + j;

    indices.push(start1, start2, end1);
    indices.push(start2, end2, end1);
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
  const holeResolution = MESH_DEFAULTS.HOLE_RESOLUTION;

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
  mouthShape: CrossSectionMode,
  boltHoleDiameter: number,
  boltSpacing: number,
  widthExtension: number,
  resolution: number,
): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  const boltRadius = boltHoleDiameter / 2;
  const holeResolution = MESH_DEFAULTS.HOLE_RESOLUTION;

  // Use the EXACT same point generation as the mount generation
  // This matches what generateHornMount does in mounts.ts
  const extensionFactor = 1 + widthExtension / Math.max(mouthWidth, mouthHeight);

  // Generate reference points exactly as done in mount generation
  const boltReferenceInner = generateCrossSectionPoints(
    mouthShape,
    mouthWidth / 2,
    mouthHeight / 2,
    resolution,
  );

  const outerPoints = generateCrossSectionPoints(
    mouthShape,
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
    if (mouthShape === "ellipse") {
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
  const { mode, widthProfile, heightProfile, shapeProfile } = geometry;

  // Check if we have shape transitions
  const hasShapeTransition =
    shapeProfile && shapeProfile.some((sp) => sp.morphingFactor > 0 && sp.morphingFactor < 1);

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

    let crossSection;

    if (hasShapeTransition && shapeProfile) {
      // Generate morphed cross-section
      const shapeData = shapeProfile[i] || shapeProfile[shapeProfile.length - 1];

      if (shapeData.morphingFactor === 0) {
        // Pure throat shape
        crossSection = generateCrossSection(
          geometry.throatShape || mode,
          point.y,
          width,
          height,
          circumferenceSteps,
        );
      } else if (shapeData.morphingFactor === 1) {
        // Pure mouth shape
        crossSection = generateCrossSection(
          geometry.mouthShape || mode,
          point.y,
          width,
          height,
          circumferenceSteps,
        );
      } else {
        // Morphed shape
        const throatShape = geometry.throatShape || mode;
        const mouthShape = geometry.mouthShape || mode;
        // For rectangular throats when mixed with non-rectangular mouths, swap width/height
        const shouldSwapThroat = throatShape === "rectangular" && mouthShape !== "rectangular";
        const throatW = geometry.throatWidth || geometry.throatRadius * 2;
        const throatH = geometry.throatHeight || geometry.throatRadius * 2;
        crossSection = morphCrossSectionShapes({
          sourceShape: throatShape,
          targetShape: mouthShape,
          morphFactor: shapeData.morphingFactor,
          sourceWidth: shouldSwapThroat ? throatH : throatW,
          sourceHeight: shouldSwapThroat ? throatW : throatH,
          targetWidth: width, // Use current position's interpolated width
          targetHeight: height, // Use current position's interpolated height
          resolution: circumferenceSteps,
        });
      }
    } else {
      // Existing behavior - uniform shape
      crossSection = generateCrossSection(mode, point.y, width, height, circumferenceSteps);
    }

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
  mouthShape: CrossSectionMode,
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
    mouthShape,
    configWithCustomInner,
    resolution,
  );
}

// Re-export helper functions for compatibility
export { createDriverMount, createHornMount };

/**
 * Trim the horn profile for single-walled constructions so the body starts/ends
 * at the mount offsets. This prevents overlapping faces between the horn shell
 * and the mount connectors.
 */
function getSingleWallProfile(profile: ProfileXY, geometry: HornGeometry): ProfileXY {
  let trimmedProfile = [...profile];

  if (geometry.driverMount?.enabled && geometry.driverMount.thickness > 0) {
    trimmedProfile = trimProfileAtStart(trimmedProfile, geometry.driverMount.thickness);
  }

  if (geometry.hornMount?.enabled && geometry.hornMount.thickness > 0) {
    trimmedProfile = trimProfileAtEnd(trimmedProfile, geometry.hornMount.thickness);
  }

  // Ensure we never return an empty profile
  if (trimmedProfile.length === 0) {
    return profile;
  }

  return trimmedProfile;
}

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

  return generateHornMount(
    mouthPosition,
    mouthWidth,
    mouthHeight,
    geometry.mouthShape || mode,
    hornMount,
    resolution,
  );
}

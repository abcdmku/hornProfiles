import React, { useState, useMemo, useCallback } from "react";
import { generateProfile, HornProfileParameters, getAvailableProfiles } from "horn-profiles";
import { HornProfileViewer } from "viewer-2d";
import { HornViewer3D } from "@horn-sim/viewer-3d";
import { generateHornMesh3D, meshToThree, downloadSTL } from "@horn-sim/mesher";
import type { HornGeometry, DriverMountConfig, HornMountConfig } from "@horn-sim/types";
import { NumericInput } from "../components/NumericInput";
import { PARAMETER_CONSTRAINTS } from "../utils/constants";

export function App(): React.JSX.Element {
  const [profileType, setProfileType] = useState("conical");
  // Use string values for better UX - users can type freely
  const [inputValues, setInputValues] = useState({
    throatWidth: "50",
    throatHeight: "50",
    mouthWidth: "600",
    mouthHeight: "600",
    length: "500",
    resolution: "100",
    cutoffFrequency: "100",
    speedOfSound: "343.2",
    transitionLength: "500", // Default to full length
  });

  // Shape transition controls
  const [throatShape, setThroatShape] = useState<"ellipse" | "rectangular" | "superellipse">(
    "ellipse",
  );
  const [mouthShape, setMouthShape] = useState<"ellipse" | "rectangular" | "superellipse">(
    "ellipse",
  );
  const [morphingFunction, setMorphingFunction] = useState<"linear" | "cubic" | "sigmoid">(
    "linear",
  );

  // Convert to safe numeric parameters for profile generation with validation
  const parameters = useMemo((): HornProfileParameters => {
    const safeFloat = (value: string, defaultValue: number, min = 0.1, max = 50000): number => {
      const num = parseFloat(value);
      if (isNaN(num) || !isFinite(num)) return defaultValue;
      // Apply reasonable constraints to prevent invalid profiles
      return Math.max(min, Math.min(max, num));
    };

    try {
      const params = {
        throatWidth: safeFloat(inputValues.throatWidth, 50, 1, 1000),
        throatHeight: safeFloat(inputValues.throatHeight, 50, 1, 1000),
        mouthWidth: safeFloat(inputValues.mouthWidth, 600, 10, 5000),
        mouthHeight: safeFloat(inputValues.mouthHeight, 600, 10, 5000),
        length: safeFloat(inputValues.length, 500, 10, 10000),
        resolution: safeFloat(inputValues.resolution, 100, 10, 500),
        cutoffFrequency: safeFloat(inputValues.cutoffFrequency, 100, 20, 20000),
        speedOfSound: safeFloat(inputValues.speedOfSound, 343.2, 100, 500),
        transitionLength: safeFloat(inputValues.transitionLength, 500, 10, 10000),
        throatShape,
        mouthShape,
        morphingFunction,
      };

      // Additional validation: mouth must be larger than throat
      if (
        params.mouthWidth !== undefined &&
        params.throatWidth !== undefined &&
        params.mouthWidth < params.throatWidth
      ) {
        params.mouthWidth = Math.max(params.throatWidth * 1.1, params.mouthWidth);
      }
      if (
        params.mouthHeight !== undefined &&
        params.throatHeight !== undefined &&
        params.mouthHeight < params.throatHeight
      ) {
        params.mouthHeight = Math.max(params.throatHeight * 1.1, params.mouthHeight);
      }

      return params;
    } catch (error) {
      // Fallback to safe defaults
      // eslint-disable-next-line no-console
      console.warn("Parameter validation failed, using defaults:", error);
      return {
        throatWidth: 50,
        throatHeight: 50,
        mouthWidth: 600,
        mouthHeight: 600,
        length: 500,
        resolution: 100,
        cutoffFrequency: 100,
        speedOfSound: 343.2,
        transitionLength: 500,
        throatShape: "ellipse",
        mouthShape: "ellipse",
        morphingFunction: "linear",
      };
    }
  }, [inputValues, throatShape, mouthShape, morphingFunction]);
  const [throatLocked, setThroatLocked] = useState(true);
  const [mouthLocked, setMouthLocked] = useState(true);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [wireframe, setWireframe] = useState(false);
  const [meshResolution, setMeshResolution] = useState(50);
  const [wallThickness, setWallThickness] = useState(0);

  // Mount configurations
  const [driverMount, setDriverMount] = useState<DriverMountConfig>({
    enabled: false,
    outerDiameter: 150,
    boltHoleDiameter: 6,
    boltCircleDiameter: 120,
    boltCount: 4,
    thickness: 10,
  });

  const [hornMount, setHornMount] = useState<HornMountConfig>({
    enabled: false,
    widthExtension: 50,
    boltSpacing: 100,
    boltHoleDiameter: 8,
    thickness: 10,
  });

  // Safe profile generation - never throw errors to UI
  const profile = useMemo(() => {
    try {
      // Additional safety check before calling generateProfile
      if (
        !parameters ||
        parameters.throatWidth === undefined ||
        parameters.throatHeight === undefined ||
        parameters.mouthWidth === undefined ||
        parameters.mouthHeight === undefined ||
        !isFinite(parameters.throatWidth) ||
        !isFinite(parameters.throatHeight) ||
        !isFinite(parameters.mouthWidth) ||
        !isFinite(parameters.mouthHeight) ||
        !isFinite(parameters.length) ||
        parameters.throatWidth <= 0 ||
        parameters.throatHeight <= 0 ||
        parameters.mouthWidth <= 0 ||
        parameters.mouthHeight <= 0 ||
        parameters.length <= 0
      ) {
        return null;
      }

      return generateProfile(profileType, parameters);
    } catch (error) {
      // Silently fail - viewer will show "no profile" state
      // eslint-disable-next-line no-console
      console.warn("Profile generation failed:", error);
      return null;
    }
  }, [profileType, parameters]);

  const availableProfiles = getAvailableProfiles();

  // Store raw mesh data for STL export
  const rawMeshData = useMemo(() => {
    if (
      !profile ||
      !profile.points ||
      !profile.widthProfile ||
      !profile.heightProfile ||
      !profile.metadata?.parameters
    ) {
      return null;
    }

    try {
      const hornGeometry: HornGeometry = {
        mode: throatShape as "ellipse" | "rectangular",
        profile: profile.points,
        widthProfile: profile.widthProfile,
        heightProfile: profile.heightProfile,
        shapeProfile: profile.shapeProfile,
        throatRadius:
          Math.min(
            profile.metadata.parameters.throatWidth || 50,
            profile.metadata.parameters.throatHeight || 50,
          ) / 2,
        throatWidth: profile.metadata.parameters.throatWidth || 50,
        throatHeight: profile.metadata.parameters.throatHeight || 50,
        width: profile.metadata.parameters.mouthWidth || 600,
        height: profile.metadata.parameters.mouthHeight || 600,
        throatShape: throatShape as "ellipse" | "rectangular",
        mouthShape: mouthShape as "ellipse" | "rectangular",
        wallThickness: wallThickness > 0 ? wallThickness : undefined,
        driverMount: driverMount.enabled ? driverMount : undefined,
        hornMount: hornMount.enabled ? hornMount : undefined,
      };

      return generateHornMesh3D(hornGeometry, {
        resolution: meshResolution,
        elementSize: 5,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Mesh generation failed:", error);
      return null;
    }
  }, [profile, throatShape, mouthShape, meshResolution, wallThickness, driverMount, hornMount]);

  // Handler for downloading STL
  const handleDownloadSTL = useCallback(() => {
    if (!rawMeshData) return;

    const filename = `horn-${profileType}-${Date.now()}.stl`;
    downloadSTL(rawMeshData, filename);
  }, [rawMeshData, profileType]);

  // Generate 3D mesh data when profile changes - safe from errors
  const meshData = useMemo(() => {
    // More thorough null/undefined checks
    if (
      !profile ||
      !profile.points ||
      !profile.widthProfile ||
      !profile.heightProfile ||
      !profile.metadata?.parameters
    ) {
      return null;
    }

    try {
      const hornGeometry: HornGeometry = {
        mode: throatShape as "ellipse" | "rectangular", // Use throat shape as base mode
        profile: profile.points,
        widthProfile: profile.widthProfile,
        heightProfile: profile.heightProfile,
        shapeProfile: profile.shapeProfile, // Include shape profile for transitions
        throatRadius:
          Math.min(
            profile.metadata.parameters.throatWidth || 50,
            profile.metadata.parameters.throatHeight || 50,
          ) / 2,
        throatWidth: profile.metadata.parameters.throatWidth || 50,
        throatHeight: profile.metadata.parameters.throatHeight || 50,
        width: profile.metadata.parameters.mouthWidth || 600,
        height: profile.metadata.parameters.mouthHeight || 600,
        throatShape: throatShape as "ellipse" | "rectangular",
        mouthShape: mouthShape as "ellipse" | "rectangular",
        wallThickness: wallThickness > 0 ? wallThickness : undefined,
        driverMount: driverMount.enabled ? driverMount : undefined,
        hornMount: hornMount.enabled ? hornMount : undefined,
      };

      const mesh = generateHornMesh3D(hornGeometry, {
        resolution: meshResolution,
        elementSize: 5, // This parameter is not used in the current implementation
      });

      return meshToThree(mesh);
    } catch (error) {
      // Silently fail - 3D viewer will show fallback message
      // eslint-disable-next-line no-console
      console.warn("Mesh generation failed:", error);
      return null;
    }
  }, [profile, throatShape, mouthShape, meshResolution, wallThickness, driverMount, hornMount]);

  const handleParameterChange = useCallback(
    (key: string, value: string): void => {
      setInputValues((prev) => {
        const newValues = { ...prev };

        // Always allow the user to type whatever they want
        if (key in newValues) {
          (newValues as Record<string, string>)[key] = value;
        }

        // Handle aspect ratio locking - but be more graceful about empty/invalid values
        const numValue = parseFloat(value);
        const hasValidNumber = !isNaN(numValue) && isFinite(numValue) && numValue > 0;

        if (hasValidNumber) {
          if (throatLocked && (key === "throatWidth" || key === "throatHeight")) {
            const prevWidth = parseFloat(prev.throatWidth);
            const prevHeight = parseFloat(prev.throatHeight);

            // Calculate aspect ratio - use existing ratio if valid, otherwise default to 1:1
            let ratio = 1;
            if (!isNaN(prevWidth) && !isNaN(prevHeight) && prevWidth > 0 && prevHeight > 0) {
              ratio = key === "throatWidth" ? prevHeight / prevWidth : prevWidth / prevHeight;
            }

            if (key === "throatWidth") {
              newValues.throatHeight = (numValue * ratio).toString();
            } else {
              newValues.throatWidth = (numValue * ratio).toString();
            }
          } else if (mouthLocked && (key === "mouthWidth" || key === "mouthHeight")) {
            const prevWidth = parseFloat(prev.mouthWidth);
            const prevHeight = parseFloat(prev.mouthHeight);

            // Calculate aspect ratio - use existing ratio if valid, otherwise default to 1:1
            let ratio = 1;
            if (!isNaN(prevWidth) && !isNaN(prevHeight) && prevWidth > 0 && prevHeight > 0) {
              ratio = key === "mouthWidth" ? prevHeight / prevWidth : prevWidth / prevHeight;
            }

            if (key === "mouthWidth") {
              newValues.mouthHeight = (numValue * ratio).toString();
            } else {
              newValues.mouthWidth = (numValue * ratio).toString();
            }
          }
        } else if (value === "") {
          // When user clears a field, clear the locked partner too if locking is enabled
          if (throatLocked && key === "throatWidth") {
            newValues.throatHeight = "";
          } else if (throatLocked && key === "throatHeight") {
            newValues.throatWidth = "";
          } else if (mouthLocked && key === "mouthWidth") {
            newValues.mouthHeight = "";
          } else if (mouthLocked && key === "mouthHeight") {
            newValues.mouthWidth = "";
          }
        }

        return newValues;
      });
    },
    [throatLocked, mouthLocked],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-900 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-float"></div>
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-indigo-900 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-float animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-slate-800 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-float animation-delay-4000"></div>
      </div>

      <div className="relative flex h-screen">
        <div className="flex flex-1 gap-6 p-6">
          {/* Glass sidebar */}
          <div className="w-80 backdrop-blur-lg bg-slate-800/30 rounded-2xl shadow-2xl border border-slate-700/30 flex flex-col h-full">
            <h2 className="text-xl font-semibold p-6 pb-4 text-slate-100 flex items-center flex-shrink-0">
              <svg
                className="w-5 h-5 mr-2 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
              Configuration
            </h2>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="profile-type"
                    className="block text-sm font-medium text-slate-300 mb-2"
                  >
                    Profile Type
                  </label>
                  <select
                    id="profile-type"
                    value={profileType}
                    onChange={(e) => setProfileType(e.currentTarget.value)}
                    className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    {availableProfiles.map((type) => (
                      <option key={type} value={type} className="bg-gray-800">
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-300">
                      Throat Dimensions (mm)
                    </label>
                    <button
                      onClick={() => setThroatLocked(!throatLocked)}
                      className={`p-1.5 rounded-lg transition-all ${
                        throatLocked
                          ? "bg-blue-600 text-white"
                          : "bg-slate-700/50 text-slate-400 hover:text-slate-200"
                      }`}
                      title={throatLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
                    >
                      {throatLocked ? (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumericInput
                      id="throat-width"
                      label="Width"
                      value={
                        inputValues.throatWidth === ""
                          ? ""
                          : parseFloat(inputValues.throatWidth) || ""
                      }
                      min={PARAMETER_CONSTRAINTS.throatWidth.min}
                      max={PARAMETER_CONSTRAINTS.throatWidth.max}
                      onChange={(value) => handleParameterChange("throatWidth", value)}
                      unit="mm"
                    />
                    <NumericInput
                      id="throat-height"
                      label="Height"
                      value={
                        inputValues.throatHeight === ""
                          ? ""
                          : parseFloat(inputValues.throatHeight) || ""
                      }
                      min={PARAMETER_CONSTRAINTS.throatHeight.min}
                      max={PARAMETER_CONSTRAINTS.throatHeight.max}
                      onChange={(value) => handleParameterChange("throatHeight", value)}
                      unit="mm"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-300">
                      Mouth Dimensions (mm)
                    </label>
                    <button
                      onClick={() => setMouthLocked(!mouthLocked)}
                      className={`p-1.5 rounded-lg transition-all ${
                        mouthLocked
                          ? "bg-blue-600 text-white"
                          : "bg-slate-700/50 text-slate-400 hover:text-slate-200"
                      }`}
                      title={mouthLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
                    >
                      {mouthLocked ? (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumericInput
                      id="mouth-width"
                      label="Width"
                      value={
                        inputValues.mouthWidth === ""
                          ? ""
                          : parseFloat(inputValues.mouthWidth) || ""
                      }
                      min={PARAMETER_CONSTRAINTS.mouthWidth.min}
                      max={PARAMETER_CONSTRAINTS.mouthWidth.max}
                      onChange={(value) => handleParameterChange("mouthWidth", value)}
                      unit="mm"
                    />
                    <NumericInput
                      id="mouth-height"
                      label="Height"
                      value={
                        inputValues.mouthHeight === ""
                          ? ""
                          : parseFloat(inputValues.mouthHeight) || ""
                      }
                      min={PARAMETER_CONSTRAINTS.mouthHeight.min}
                      max={PARAMETER_CONSTRAINTS.mouthHeight.max}
                      onChange={(value) => handleParameterChange("mouthHeight", value)}
                      unit="mm"
                    />
                  </div>
                </div>

                <NumericInput
                  id="length"
                  label="Length"
                  value={inputValues.length === "" ? "" : parseFloat(inputValues.length) || ""}
                  min={PARAMETER_CONSTRAINTS.length.min}
                  max={PARAMETER_CONSTRAINTS.length.max}
                  onChange={(value) => handleParameterChange("length", value)}
                  unit="mm"
                />

                <NumericInput
                  id="resolution"
                  label="Resolution"
                  value={
                    inputValues.resolution === "" ? "" : parseFloat(inputValues.resolution) || ""
                  }
                  min={PARAMETER_CONSTRAINTS.resolution.min}
                  max={PARAMETER_CONSTRAINTS.resolution.max}
                  onChange={(value) => handleParameterChange("resolution", value)}
                />

                <NumericInput
                  id="speed-of-sound"
                  label="Speed of Sound"
                  value={
                    inputValues.speedOfSound === ""
                      ? ""
                      : parseFloat(inputValues.speedOfSound) || ""
                  }
                  min={PARAMETER_CONSTRAINTS.speedOfSound.min}
                  max={PARAMETER_CONSTRAINTS.speedOfSound.max}
                  onChange={(value) => handleParameterChange("speedOfSound", value)}
                  unit="m/s"
                />

                {/* Shape Transition Controls */}
                <div className="space-y-3 pt-3 border-t border-slate-700/50">
                  <h3 className="text-sm font-medium text-slate-300">Shape Transition</h3>

                  <div>
                    <label
                      htmlFor="throat-shape"
                      className="block text-sm font-medium text-slate-300 mb-2"
                    >
                      Throat Shape
                    </label>
                    <select
                      id="throat-shape"
                      value={throatShape}
                      onChange={(e) =>
                        setThroatShape(
                          e.currentTarget.value as "ellipse" | "rectangular" | "superellipse",
                        )
                      }
                      className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="ellipse">Ellipse</option>
                      <option value="rectangular">Rectangular</option>
                      <option value="superellipse">Superellipse</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="mouth-shape"
                      className="block text-sm font-medium text-slate-300 mb-2"
                    >
                      Mouth Shape
                    </label>
                    <select
                      id="mouth-shape"
                      value={mouthShape}
                      onChange={(e) =>
                        setMouthShape(
                          e.currentTarget.value as "ellipse" | "rectangular" | "superellipse",
                        )
                      }
                      className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="ellipse">Ellipse</option>
                      <option value="rectangular">Rectangular</option>
                      <option value="superellipse">Superellipse</option>
                    </select>
                  </div>

                  <NumericInput
                    id="transition-length"
                    label="Transition Length"
                    value={
                      inputValues.transitionLength === ""
                        ? ""
                        : parseFloat(inputValues.transitionLength) || ""
                    }
                    min={10}
                    max={10000}
                    onChange={(value) => handleParameterChange("transitionLength", value)}
                    unit="mm"
                  />

                  <div>
                    <label
                      htmlFor="morphing-function"
                      className="block text-sm font-medium text-slate-300 mb-2"
                    >
                      Transition Style
                    </label>
                    <select
                      id="morphing-function"
                      value={morphingFunction}
                      onChange={(e) =>
                        setMorphingFunction(e.currentTarget.value as "linear" | "cubic" | "sigmoid")
                      }
                      className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="linear">Linear</option>
                      <option value="cubic">Smooth (Cubic)</option>
                      <option value="sigmoid">S-Curve (Sigmoid)</option>
                    </select>
                    <div className="text-xs text-slate-500 mt-1">
                      How the shape morphs from throat to mouth
                    </div>
                  </div>
                </div>

                {/* 3D View Options */}
                {viewMode === "3d" && (
                  <div className="space-y-3 pt-3 border-t border-slate-700/50">
                    <h3 className="text-sm font-medium text-slate-300">3D View Options</h3>

                    <div>
                      <label
                        htmlFor="mesh-resolution"
                        className="block text-sm font-medium text-slate-300 mb-2"
                      >
                        Mesh Quality
                      </label>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500">Low</span>
                        <input
                          id="mesh-resolution"
                          type="range"
                          min="10"
                          max="250"
                          step="10"
                          value={meshResolution}
                          onChange={(e) => setMeshResolution(Number(e.currentTarget.value))}
                          className="flex-1 h-2 bg-slate-900/50 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xs text-slate-500">High</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Resolution: {meshResolution} segments
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="wall-thickness"
                        className="block text-sm font-medium text-slate-300 mb-2"
                      >
                        Wall Thickness (mm)
                      </label>
                      <input
                        id="wall-thickness"
                        type="number"
                        min="0"
                        step="0.5"
                        value={wallThickness}
                        onChange={(e) => {
                          const val = parseFloat(e.currentTarget.value);
                          setWallThickness(isNaN(val) ? 0 : val);
                        }}
                        className="w-full px-3 py-1.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded text-slate-100 text-sm"
                        placeholder="0 for solid horn"
                      />
                      <div className="text-xs text-slate-500 mt-1">
                        {wallThickness > 0
                          ? `Double-walled: ${wallThickness}mm thick`
                          : "Solid horn (no wall thickness)"}
                      </div>
                    </div>

                    <label className="flex items-center space-x-2 text-sm text-slate-400">
                      <input
                        type="checkbox"
                        checked={wireframe}
                        onChange={(e) => setWireframe(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900/50 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Wireframe</span>
                    </label>

                    <button
                      onClick={handleDownloadSTL}
                      disabled={!meshData}
                      className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
                        meshData
                          ? "bg-gradient-to-r from-green-600 to-emerald-700 text-white hover:from-green-700 hover:to-emerald-800 shadow-lg hover:shadow-xl"
                          : "bg-slate-700/30 text-slate-500 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        <span>Download STL</span>
                      </div>
                    </button>
                  </div>
                )}

                {/* Mount Configuration */}
                <div className="space-y-3 pt-3 border-t border-slate-700/50">
                  <h3 className="text-sm font-medium text-slate-300">Mount Options</h3>

                  {/* Driver Mount */}
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 text-sm text-slate-400">
                      <input
                        type="checkbox"
                        checked={driverMount.enabled}
                        onChange={(e) =>
                          setDriverMount({ ...driverMount, enabled: e.target.checked })
                        }
                        className="rounded border-slate-700 bg-slate-900/50 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Driver Mount (Throat)</span>
                    </label>

                    {driverMount.enabled && (
                      <div className="ml-6 space-y-2">
                        <div>
                          <label
                            htmlFor="driver-outer-diameter"
                            className="block text-xs text-slate-400 mb-1"
                          >
                            Outer Diameter (mm)
                          </label>
                          <input
                            id="driver-outer-diameter"
                            type="number"
                            value={driverMount.outerDiameter}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setDriverMount({
                                ...driverMount,
                                outerDiameter: isNaN(val) ? 0 : val,
                              });
                            }}
                            className="w-full px-3 py-1.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded text-slate-100 text-sm"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="driver-thickness"
                            className="block text-xs text-slate-400 mb-1"
                          >
                            Mount Thickness (mm)
                          </label>
                          <input
                            id="driver-thickness"
                            type="number"
                            value={driverMount.thickness}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setDriverMount({
                                ...driverMount,
                                thickness: isNaN(val) ? 0 : val,
                              });
                            }}
                            className="w-full px-3 py-1.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded text-slate-100 text-sm"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="driver-bolt-circle"
                            className="block text-xs text-slate-400 mb-1"
                          >
                            Bolt Circle Diameter (mm)
                          </label>
                          <input
                            id="driver-bolt-circle"
                            type="number"
                            value={driverMount.boltCircleDiameter}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setDriverMount({
                                ...driverMount,
                                boltCircleDiameter: isNaN(val) ? 0 : val,
                              });
                            }}
                            className="w-full px-3 py-1.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded text-slate-100 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label
                              htmlFor="driver-bolt-count"
                              className="block text-xs text-slate-400 mb-1"
                            >
                              Bolt Count
                            </label>
                            <input
                              id="driver-bolt-count"
                              type="number"
                              min="3"
                              max="12"
                              value={driverMount.boltCount}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setDriverMount({
                                  ...driverMount,
                                  boltCount: isNaN(val) ? 4 : val,
                                });
                              }}
                              className="w-full px-3 py-1.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded text-slate-100 text-sm"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="driver-bolt-hole"
                              className="block text-xs text-slate-400 mb-1"
                            >
                              Hole Ø (mm)
                            </label>
                            <input
                              id="driver-bolt-hole"
                              type="number"
                              value={driverMount.boltHoleDiameter}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setDriverMount({
                                  ...driverMount,
                                  boltHoleDiameter: isNaN(val) ? 6 : val,
                                });
                              }}
                              className="w-full px-3 py-1.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded text-slate-100 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Horn Mount */}
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 text-sm text-slate-400">
                      <input
                        type="checkbox"
                        checked={hornMount.enabled}
                        onChange={(e) => setHornMount({ ...hornMount, enabled: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900/50 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Horn Mount (Mouth)</span>
                    </label>

                    {hornMount.enabled && (
                      <div className="ml-6 space-y-2">
                        <div>
                          <label
                            htmlFor="horn-width-ext"
                            className="block text-xs text-slate-400 mb-1"
                          >
                            Width Extension (mm)
                          </label>
                          <input
                            id="horn-width-ext"
                            type="number"
                            value={hornMount.widthExtension}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setHornMount({ ...hornMount, widthExtension: isNaN(val) ? 50 : val });
                            }}
                            className="w-full px-3 py-1.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded text-slate-100 text-sm"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="horn-thickness"
                            className="block text-xs text-slate-400 mb-1"
                          >
                            Mount Thickness (mm)
                          </label>
                          <input
                            id="horn-thickness"
                            type="number"
                            value={hornMount.thickness}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setHornMount({ ...hornMount, thickness: isNaN(val) ? 10 : val });
                            }}
                            className="w-full px-3 py-1.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded text-slate-100 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label
                              htmlFor="horn-bolt-spacing"
                              className="block text-xs text-slate-400 mb-1"
                            >
                              Bolt Spacing (mm)
                            </label>
                            <input
                              id="horn-bolt-spacing"
                              type="number"
                              value={hornMount.boltSpacing}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setHornMount({ ...hornMount, boltSpacing: isNaN(val) ? 100 : val });
                              }}
                              className="w-full px-3 py-1.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded text-slate-100 text-sm"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="horn-bolt-hole"
                              className="block text-xs text-slate-400 mb-1"
                            >
                              Hole Ø (mm)
                            </label>
                            <input
                              id="horn-bolt-hole"
                              type="number"
                              value={hornMount.boltHoleDiameter}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setHornMount({
                                  ...hornMount,
                                  boltHoleDiameter: isNaN(val) ? 8 : val,
                                });
                              }}
                              className="w-full px-3 py-1.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded text-slate-100 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Glass button */}
                <button className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-800 transform hover:-translate-y-0.5 transition-all duration-200 mt-4">
                  Generate Profile
                </button>
              </div>
            </div>
          </div>

          {/* Glass main content */}
          <div className="flex-1 backdrop-blur-lg bg-slate-800/30 rounded-2xl shadow-2xl p-6 border border-slate-700/30 flex flex-col min-h-0">
            {/* View Mode Tabs */}
            <div className="flex space-x-2 mb-4 flex-shrink-0">
              <button
                onClick={() => setViewMode("2d")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  viewMode === "2d"
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-slate-900/50 text-slate-400 hover:text-slate-200"
                }`}
              >
                2D Profile
              </button>
              <button
                onClick={() => setViewMode("3d")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  viewMode === "3d"
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-slate-900/50 text-slate-400 hover:text-slate-200"
                }`}
              >
                3D Model
              </button>
            </div>

            {/* View Content */}
            <div className="flex-1 min-h-0 relative">
              {viewMode === "2d" ? (
                profile ? (
                  <HornProfileViewer profile={profile} height={600} />
                ) : (
                  <div className="flex items-center justify-center h-full rounded-lg">
                    <p className="text-gray-500">
                      Invalid parameters - adjust values to generate profile
                    </p>
                  </div>
                )
              ) : meshData ? (
                <div className="absolute inset-0 rounded-lg overflow-hidden">
                  <HornViewer3D
                    positions={meshData.positions}
                    indices={meshData.indices}
                    normals={meshData.normals}
                    wireframe={wireframe}
                    showGrid={true}
                    gridPosition={[
                      0,
                      -Math.min(parameters.throatWidth || 50, parameters.throatHeight || 50) / 2,
                      0,
                    ]}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full rounded-lg">
                  <p className="text-gray-500">
                    {profile
                      ? "Generating 3D model..."
                      : "Invalid parameters - adjust values to generate model"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

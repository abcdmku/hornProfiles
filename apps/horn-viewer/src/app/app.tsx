import React, { useState, useMemo } from "react";
import { generateProfile, HornProfileParameters, getAvailableProfiles } from "horn-profiles";
import { HornProfileViewer } from "viewer-2d";
import { HornViewer3D } from "@horn-sim/viewer-3d";
import { generateHornMesh3D, meshToThree } from "@horn-sim/mesher";
import type { HornGeometry, DriverMountConfig, HornMountConfig } from "@horn-sim/types";

export function App(): React.JSX.Element {
  const [profileType, setProfileType] = useState("conical");
  const [parameters, setParameters] = useState<HornProfileParameters>({
    throatWidth: 50,
    throatHeight: 50,
    mouthWidth: 600,
    mouthHeight: 600,
    length: 500,
    resolution: 100,
    cutoffFrequency: 100,
    speedOfSound: 343.2,
  });
  const [throatLocked, setThroatLocked] = useState(true);
  const [mouthLocked, setMouthLocked] = useState(true);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [wireframe, setWireframe] = useState(false);
  const [meshMode, setMeshMode] = useState<"circle" | "ellipse" | "rectangular">("circle");
  const [meshResolution, setMeshResolution] = useState(50);

  // Mount configurations
  const [driverMount, setDriverMount] = useState<DriverMountConfig>({
    enabled: false,
    outerDiameter: 150,
    boltHoleDiameter: 6,
    boltCircleDiameter: 120,
    boltCount: 4,
  });

  const [hornMount, setHornMount] = useState<HornMountConfig>({
    enabled: false,
    widthExtension: 50,
    boltSpacing: 100,
    boltHoleDiameter: 8,
  });

  const profile = generateProfile(profileType, parameters);
  const availableProfiles = getAvailableProfiles();

  // Generate 3D mesh data when profile changes
  const meshData = useMemo(() => {
    if (!profile) return null;

    const hornGeometry: HornGeometry = {
      mode: meshMode,
      profile: profile.points,
      widthProfile: profile.widthProfile,
      heightProfile: profile.heightProfile,
      throatRadius:
        Math.min(
          profile.metadata.parameters.throatWidth,
          profile.metadata.parameters.throatHeight,
        ) / 2,
      width: profile.metadata.parameters.mouthWidth,
      height: profile.metadata.parameters.mouthHeight,
      driverMount: driverMount.enabled ? driverMount : undefined,
      hornMount: hornMount.enabled ? hornMount : undefined,
    };

    const mesh = generateHornMesh3D(hornGeometry, {
      resolution: meshResolution,
      elementSize: 5, // This parameter is not used in the current implementation
    });

    return meshToThree(mesh);
  }, [profile, meshMode, meshResolution, driverMount, hornMount]);

  const handleParameterChange = (key: keyof HornProfileParameters, value: string): void => {
    const numValue = parseFloat(value) || 0;

    setParameters((prev) => {
      const newParams = { ...prev };

      // Handle aspect ratio locking for throat
      if (key === "throatWidth" && throatLocked) {
        const aspectRatio = prev.throatHeight / prev.throatWidth;
        newParams.throatWidth = numValue;
        newParams.throatHeight = numValue * aspectRatio;
      } else if (key === "throatHeight" && throatLocked) {
        const aspectRatio = prev.throatWidth / prev.throatHeight;
        newParams.throatHeight = numValue;
        newParams.throatWidth = numValue * aspectRatio;
      }
      // Handle aspect ratio locking for mouth
      else if (key === "mouthWidth" && mouthLocked) {
        const aspectRatio = prev.mouthHeight / prev.mouthWidth;
        newParams.mouthWidth = numValue;
        newParams.mouthHeight = numValue * aspectRatio;
      } else if (key === "mouthHeight" && mouthLocked) {
        const aspectRatio = prev.mouthWidth / prev.mouthHeight;
        newParams.mouthHeight = numValue;
        newParams.mouthWidth = numValue * aspectRatio;
      }
      // No locking, just update the value
      else {
        newParams[key] = numValue;
      }

      return newParams;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-900 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-float"></div>
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-indigo-900 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-float animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-slate-800 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-float animation-delay-4000"></div>
      </div>

      <div className="relative flex flex-col h-screen">
        {/* Glass header */}
        <header className="relative backdrop-blur-lg bg-slate-900/50 border-b border-slate-700/50 px-6 py-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg shadow-lg"></div>
              <h1 className="text-3xl font-bold text-slate-100">Horn Profile Viewer</h1>
            </div>
            <div className="text-sm text-slate-400">Acoustic Engineering Suite</div>
          </div>
        </header>

        <div className="flex flex-1 gap-6 p-6">
          {/* Glass sidebar */}
          <div className="w-80 backdrop-blur-lg bg-slate-800/30 rounded-2xl shadow-2xl p-6 border border-slate-700/30">
            <h2 className="text-xl font-semibold mb-6 text-slate-100 flex items-center">
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
                  <div>
                    <label htmlFor="throat-width" className="block text-xs text-slate-400 mb-1">
                      Width
                    </label>
                    <input
                      id="throat-width"
                      type="number"
                      value={parameters.throatWidth}
                      onChange={(e) => handleParameterChange("throatWidth", e.currentTarget.value)}
                      className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label htmlFor="throat-height" className="block text-xs text-slate-400 mb-1">
                      Height
                    </label>
                    <input
                      id="throat-height"
                      type="number"
                      value={parameters.throatHeight}
                      onChange={(e) => handleParameterChange("throatHeight", e.currentTarget.value)}
                      className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
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
                  <div>
                    <label htmlFor="mouth-width" className="block text-xs text-slate-400 mb-1">
                      Width
                    </label>
                    <input
                      id="mouth-width"
                      type="number"
                      value={parameters.mouthWidth}
                      onChange={(e) => handleParameterChange("mouthWidth", e.currentTarget.value)}
                      className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label htmlFor="mouth-height" className="block text-xs text-slate-400 mb-1">
                      Height
                    </label>
                    <input
                      id="mouth-height"
                      type="number"
                      value={parameters.mouthHeight}
                      onChange={(e) => handleParameterChange("mouthHeight", e.currentTarget.value)}
                      className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="length" className="block text-sm font-medium text-slate-300 mb-2">
                  Length (mm)
                </label>
                <input
                  id="length"
                  type="number"
                  value={parameters.length}
                  onChange={(e) => handleParameterChange("length", e.currentTarget.value)}
                  className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label
                  htmlFor="resolution"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  Resolution
                </label>
                <input
                  id="resolution"
                  type="number"
                  value={parameters.resolution}
                  onChange={(e) => handleParameterChange("resolution", e.currentTarget.value)}
                  className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label
                  htmlFor="speed-of-sound"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  Speed of Sound (m/s)
                </label>
                <input
                  id="speed-of-sound"
                  type="number"
                  value={parameters.speedOfSound}
                  onChange={(e) => handleParameterChange("speedOfSound", e.currentTarget.value)}
                  className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              {/* 3D View Options */}
              {viewMode === "3d" && (
                <div className="space-y-3 pt-3 border-t border-slate-700/50">
                  <h3 className="text-sm font-medium text-slate-300">3D View Options</h3>

                  <div>
                    <label
                      htmlFor="mesh-mode"
                      className="block text-sm font-medium text-slate-300 mb-2"
                    >
                      Cross Section
                    </label>
                    <select
                      id="mesh-mode"
                      value={meshMode}
                      onChange={(e) =>
                        setMeshMode(e.currentTarget.value as "circle" | "ellipse" | "rectangular")
                      }
                      className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="circle">Circle</option>
                      <option value="ellipse">Ellipse</option>
                      <option value="rectangular">Rectangular</option>
                    </select>
                  </div>

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

                  <label className="flex items-center space-x-2 text-sm text-slate-400">
                    <input
                      type="checkbox"
                      checked={wireframe}
                      onChange={(e) => setWireframe(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900/50 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Wireframe</span>
                  </label>
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
                          onChange={(e) =>
                            setDriverMount({
                              ...driverMount,
                              outerDiameter: Number(e.target.value),
                            })
                          }
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
                          onChange={(e) =>
                            setDriverMount({
                              ...driverMount,
                              boltCircleDiameter: Number(e.target.value),
                            })
                          }
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
                            onChange={(e) =>
                              setDriverMount({ ...driverMount, boltCount: Number(e.target.value) })
                            }
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
                            onChange={(e) =>
                              setDriverMount({
                                ...driverMount,
                                boltHoleDiameter: Number(e.target.value),
                              })
                            }
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
                          onChange={(e) =>
                            setHornMount({ ...hornMount, widthExtension: Number(e.target.value) })
                          }
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
                            onChange={(e) =>
                              setHornMount({ ...hornMount, boltSpacing: Number(e.target.value) })
                            }
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
                            onChange={(e) =>
                              setHornMount({
                                ...hornMount,
                                boltHoleDiameter: Number(e.target.value),
                              })
                            }
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
                <HornProfileViewer profile={profile} height={600} />
              ) : meshData ? (
                <div className="absolute inset-0 rounded-lg overflow-hidden">
                  <HornViewer3D
                    positions={meshData.positions}
                    indices={meshData.indices}
                    normals={meshData.normals}
                    wireframe={wireframe}
                    showGrid={true}
                    gridPosition={[0, -parameters.throatRadius, 0]}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full rounded-lg">
                  <p className="text-gray-500">Generate a profile to view 3D model</p>
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

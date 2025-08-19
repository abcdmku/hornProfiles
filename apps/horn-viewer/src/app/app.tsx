import React, { useState, useMemo } from "react";
import { generateProfile, HornProfileParameters, getAvailableProfiles } from "horn-profiles";
import { HornProfileViewer } from "viewer-2d";
import { HornViewer3D } from "@horn-sim/viewer-3d";
import { generateHornMesh3D, meshToThree } from "@horn-sim/mesher";
import type { HornGeometry } from "@horn-sim/types";

export function App() {
  const [profileType, setProfileType] = useState("conical");
  const [parameters, setParameters] = useState<HornProfileParameters>({
    throatRadius: 25,
    mouthRadius: 300,
    length: 500,
    resolution: 100,
    cutoffFrequency: 100,
    speedOfSound: 343.2,
  });
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [meshMode, setMeshMode] = useState<"circle" | "ellipse" | "rectangular">("circle");

  const profile = generateProfile(profileType, parameters);
  const availableProfiles = getAvailableProfiles();

  // Generate 3D mesh data when profile changes
  const meshData = useMemo(() => {
    if (!profile) return null;

    const hornGeometry: HornGeometry = {
      mode: meshMode,
      profile: profile.points,
      throatRadius: profile.metadata.parameters.throatRadius,
    };

    const mesh = generateHornMesh3D(hornGeometry, {
      resolution: 50,
      elementSize: 5,
    });

    return meshToThree(mesh);
  }, [profile, meshMode]);

  const handleParameterChange = (key: keyof HornProfileParameters, value: string) => {
    setParameters((prev) => ({
      ...prev,
      [key]: parseFloat(value) || 0,
    }));
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
                <label
                  htmlFor="throat-radius"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  Throat Radius (mm)
                </label>
                <input
                  id="throat-radius"
                  type="number"
                  value={parameters.throatRadius}
                  onChange={(e) => handleParameterChange("throatRadius", e.currentTarget.value)}
                  className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label
                  htmlFor="mouth-radius"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  Mouth Radius (mm)
                </label>
                <input
                  id="mouth-radius"
                  type="number"
                  value={parameters.mouthRadius}
                  onChange={(e) => handleParameterChange("mouthRadius", e.currentTarget.value)}
                  className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
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

                  <label className="flex items-center space-x-2 text-sm text-slate-400">
                    <input
                      type="checkbox"
                      checked={wireframe}
                      onChange={(e) => setWireframe(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900/50 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Wireframe</span>
                  </label>

                  <label className="flex items-center space-x-2 text-sm text-slate-400">
                    <input
                      type="checkbox"
                      checked={autoRotate}
                      onChange={(e) => setAutoRotate(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900/50 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Auto Rotate</span>
                  </label>
                </div>
              )}

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
                    autoRotate={autoRotate}
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

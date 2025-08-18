import React, { useState } from "react";
import { generateProfile, HornProfileParameters, getAvailableProfiles } from "horn-profiles";
import { HornProfileViewer } from "viewer-2d";

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

  const profile = generateProfile(profileType, parameters);
  const availableProfiles = getAvailableProfiles();

  const handleParameterChange = (key: keyof HornProfileParameters, value: string) => {
    setParameters((prev) => ({
      ...prev,
      [key]: parseFloat(value) || 0,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-700 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float"></div>
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-cyan-700 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-700 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float animation-delay-4000"></div>
      </div>

      <div className="relative flex flex-col h-screen">
        {/* Glass header */}
        <header className="relative backdrop-blur-lg bg-white/10 border-b border-white/20 px-6 py-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg shadow-lg animate-glow"></div>
              <h1 className="text-3xl font-bold text-white">Horn Profile Viewer</h1>
            </div>
            <div className="text-sm text-purple-200">Acoustic Engineering Suite</div>
          </div>
        </header>

        <div className="flex flex-1 gap-6 p-6">
          {/* Glass sidebar */}
          <div className="w-80 backdrop-blur-lg bg-white/10 rounded-2xl shadow-2xl p-6 border border-white/20">
            <h2 className="text-xl font-semibold mb-6 text-white flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-purple-400"
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
                  className="block text-sm font-medium text-purple-200 mb-2"
                >
                  Profile Type
                </label>
                <select
                  id="profile-type"
                  value={profileType}
                  onChange={(e) => setProfileType(e.currentTarget.value)}
                  className="w-full px-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
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
                  className="block text-sm font-medium text-purple-200 mb-2"
                >
                  Throat Radius (mm)
                </label>
                <input
                  id="throat-radius"
                  type="number"
                  value={parameters.throatRadius}
                  onChange={(e) => handleParameterChange("throatRadius", e.currentTarget.value)}
                  className="w-full px-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label
                  htmlFor="mouth-radius"
                  className="block text-sm font-medium text-purple-200 mb-2"
                >
                  Mouth Radius (mm)
                </label>
                <input
                  id="mouth-radius"
                  type="number"
                  value={parameters.mouthRadius}
                  onChange={(e) => handleParameterChange("mouthRadius", e.currentTarget.value)}
                  className="w-full px-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label htmlFor="length" className="block text-sm font-medium text-purple-200 mb-2">
                  Length (mm)
                </label>
                <input
                  id="length"
                  type="number"
                  value={parameters.length}
                  onChange={(e) => handleParameterChange("length", e.currentTarget.value)}
                  className="w-full px-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label
                  htmlFor="resolution"
                  className="block text-sm font-medium text-purple-200 mb-2"
                >
                  Resolution
                </label>
                <input
                  id="resolution"
                  type="number"
                  value={parameters.resolution}
                  onChange={(e) => handleParameterChange("resolution", e.currentTarget.value)}
                  className="w-full px-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label
                  htmlFor="speed-of-sound"
                  className="block text-sm font-medium text-purple-200 mb-2"
                >
                  Speed of Sound (m/s)
                </label>
                <input
                  id="speed-of-sound"
                  type="number"
                  value={parameters.speedOfSound}
                  onChange={(e) => handleParameterChange("speedOfSound", e.currentTarget.value)}
                  className="w-full px-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              {/* Glass button */}
              <button className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 mt-4">
                Generate Profile
              </button>
            </div>
          </div>

          {/* Glass main content */}
          <div className="flex-1 backdrop-blur-lg bg-white/10 rounded-2xl shadow-2xl p-6 border border-white/20">
            <div className="h-full">
              <HornProfileViewer profile={profile} height={600} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

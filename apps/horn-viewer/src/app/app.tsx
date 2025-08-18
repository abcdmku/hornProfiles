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
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 shadow-lg">
        <h1 className="text-3xl font-bold">Horn Profile Viewer</h1>
      </header>

      <div className="flex flex-1 gap-6 p-6">
        <div className="w-80 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-6 text-gray-800">Profile Configuration</h2>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="profile-type"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Profile Type
              </label>
              <select
                id="profile-type"
                value={profileType}
                onChange={(e) => setProfileType(e.currentTarget.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {availableProfiles.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="throat-radius"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Throat Radius (mm)
              </label>
              <input
                id="throat-radius"
                type="number"
                value={parameters.throatRadius}
                onChange={(e) => handleParameterChange("throatRadius", e.currentTarget.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="mouth-radius"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Mouth Radius (mm)
              </label>
              <input
                id="mouth-radius"
                type="number"
                value={parameters.mouthRadius}
                onChange={(e) => handleParameterChange("mouthRadius", e.currentTarget.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="length" className="block text-sm font-medium text-gray-700 mb-1">
                Length (mm)
              </label>
              <input
                id="length"
                type="number"
                value={parameters.length}
                onChange={(e) => handleParameterChange("length", e.currentTarget.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="resolution" className="block text-sm font-medium text-gray-700 mb-1">
                Resolution
              </label>
              <input
                id="resolution"
                type="number"
                value={parameters.resolution}
                onChange={(e) => handleParameterChange("resolution", e.currentTarget.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {profileType === "exponential" && (
              <div>
                <label
                  htmlFor="cutoff-frequency"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Cutoff Frequency (Hz)
                </label>
                <input
                  id="cutoff-frequency"
                  type="number"
                  value={parameters.cutoffFrequency}
                  onChange={(e) => handleParameterChange("cutoffFrequency", e.currentTarget.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="speed-of-sound"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Speed of Sound (m/s)
              </label>
              <input
                id="speed-of-sound"
                type="number"
                value={parameters.speedOfSound}
                onChange={(e) => handleParameterChange("speedOfSound", e.currentTarget.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-lg shadow-md p-6">
          <HornProfileViewer profile={profile} height={600} />
        </div>
      </div>
    </div>
  );
}

export default App;

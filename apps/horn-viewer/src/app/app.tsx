import React, { useState } from "react";
import { generateProfile, HornProfileParameters, getAvailableProfiles } from "horn-profiles";
import { HornProfileViewer } from "viewer-2d";
import "./app.module.css";

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
    <div className="app">
      <header className="app-header">
        <h1>Horn Profile Viewer</h1>
      </header>

      <div className="app-content">
        <div className="controls-panel">
          <h2>Profile Configuration</h2>

          <div className="control-group">
            <label htmlFor="profile-type">Profile Type:</label>
            <select
              id="profile-type"
              value={profileType}
              onChange={(e) => setProfileType(e.target.value)}
            >
              {availableProfiles.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="throat-radius">Throat Radius (mm):</label>
            <input
              id="throat-radius"
              type="number"
              value={parameters.throatRadius}
              onChange={(e) => handleParameterChange("throatRadius", e.target.value)}
            />
          </div>

          <div className="control-group">
            <label htmlFor="mouth-radius">Mouth Radius (mm):</label>
            <input
              id="mouth-radius"
              type="number"
              value={parameters.mouthRadius}
              onChange={(e) => handleParameterChange("mouthRadius", e.target.value)}
            />
          </div>

          <div className="control-group">
            <label htmlFor="length">Length (mm):</label>
            <input
              id="length"
              type="number"
              value={parameters.length}
              onChange={(e) => handleParameterChange("length", e.target.value)}
            />
          </div>

          <div className="control-group">
            <label htmlFor="resolution">Resolution:</label>
            <input
              id="resolution"
              type="number"
              value={parameters.resolution}
              onChange={(e) => handleParameterChange("resolution", e.target.value)}
            />
          </div>

          {(profileType === "exponential" ||
            profileType === "tractrix" ||
            profileType === "spherical") && (
            <>
              <div className="control-group">
                <label htmlFor="cutoff-frequency">Cutoff Frequency (Hz):</label>
                <input
                  id="cutoff-frequency"
                  type="number"
                  value={parameters.cutoffFrequency}
                  onChange={(e) => handleParameterChange("cutoffFrequency", e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <div className="viewer-panel">
          <HornProfileViewer profile={profile} height={500} />
        </div>
      </div>
    </div>
  );
}

export default App;

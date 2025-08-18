import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ProfileGeneratorResult } from "horn-profiles";

export interface HornProfileViewerProps {
  profile: ProfileGeneratorResult;
  width?: number | string;
  height?: number;
  showGrid?: boolean;
  strokeColor?: string;
}

export const HornProfileViewer: React.FC<HornProfileViewerProps> = ({
  profile,
  width = "100%",
  height = 400,
  showGrid = true,
  strokeColor = "#8884d8",
}) => {
  // Transform points for Recharts format
  const data = profile.points.map((point) => ({
    x: point.x,
    y: point.y,
    "-y": -point.y, // Mirror for bottom half
  }));

  return (
    <div className="horn-profile-viewer">
      <h3>{profile.metadata.profileType.toUpperCase()} Profile</h3>
      <ResponsiveContainer width={width} height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis
            dataKey="x"
            label={{ value: "Length (mm)", position: "insideBottom", offset: -5 }}
          />
          <YAxis
            label={{ value: "Radius (mm)", angle: -90, position: "insideLeft" }}
            domain={["dataMin", "dataMax"]}
          />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="y"
            stroke={strokeColor}
            name="Top Profile"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="-y"
            stroke={strokeColor}
            name="Bottom Profile"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="profile-metadata">
        <h4>Calculated Values:</h4>
        <ul>
          {Object.entries(profile.metadata.calculatedValues).map(([key, value]) => (
            <li key={key}>
              <strong>{key}:</strong> {typeof value === "number" ? value.toFixed(4) : value}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

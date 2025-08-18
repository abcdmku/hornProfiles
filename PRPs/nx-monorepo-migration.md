# PRP: Nx Monorepo Migration with PNPM

## Project Overview
Refactor the existing horn-profiles TypeScript library into an Nx monorepo using pnpm as the package manager. The migration will:
1. Move the current horn-profiles code to `/libs/horn-profiles`
2. Create a new 2D viewer library in `/libs/viewer-2d` 
3. Create a React application in `/apps/horn-viewer`
4. Set up proper integration between all components

## Current State Analysis
The existing codebase is a single TypeScript library with:
- **src/** - Core library code (profiles, types, utils, registry)
- **tests/** - Unit tests using Vitest
- **examples/** - Usage examples
- **dist/** - Compiled output
- Well-structured TypeScript with strict typing
- ESLint and Prettier configured
- Comprehensive test coverage

## Target Architecture
```
horn-profiles-monorepo/
├── apps/
│   └── horn-viewer/              # React app for viewing horn profiles
│       ├── src/
│       ├── public/
│       ├── project.json
│       └── tsconfig.app.json
├── libs/
│   ├── horn-profiles/            # Core horn profile library (migrated)
│   │   ├── src/
│   │   ├── project.json
│   │   └── tsconfig.lib.json
│   └── viewer-2d/                # 2D visualization library
│       ├── src/
│       ├── project.json
│       └── tsconfig.lib.json
├── nx.json                       # Nx configuration
├── pnpm-workspace.yaml           # PNPM workspace configuration
├── package.json                  # Root package.json
└── tsconfig.base.json           # Base TypeScript configuration
```

## Research References

### Nx Documentation
- **Installation**: https://nx.dev/getting-started/installation
- **React Monorepo Tutorial**: https://nx.dev/getting-started/tutorials/react-monorepo-tutorial
- **Import Existing Project**: https://nx.dev/recipes/adopting-nx/import-project
- **Library Generator**: https://nx.dev/nx-api/react/generators/library
- **JS Library Generator**: https://nx.dev/nx-api/js/generators/library
- **Folder Structure**: https://nx.dev/concepts/decisions/folder-structure

### Visualization Libraries
- **Recharts** (Recommended for simplicity): https://recharts.org/
- **Visx** (For more control): https://airbnb.io/visx/
- **D3.js** (Maximum flexibility): https://d3js.org/

### Best Practices
- **Nx + PNPM Setup**: https://nx.dev/blog/setup-a-monorepo-with-pnpm-workspaces-and-speed-it-up-with-nx
- **Adding Nx to PNPM Workspace**: https://nx.dev/recipes/adopting-nx/adding-to-monorepo

## Implementation Blueprint

### Phase 1: Initialize Nx Workspace
```bash
# Create new Nx workspace with pnpm
npx create-nx-workspace@latest horn-profiles-monorepo \
  --preset=react-monorepo \
  --appName=horn-viewer \
  --style=css \
  --bundler=vite \
  --e2eTestRunner=none \
  --packageManager=pnpm

# Navigate to workspace
cd horn-profiles-monorepo
```

### Phase 2: Migrate Horn Profiles Library
```bash
# Generate TypeScript library
nx g @nx/js:library horn-profiles \
  --directory=libs/horn-profiles \
  --buildable \
  --bundler=tsc \
  --unitTestRunner=vitest

# Copy source files (preserve structure)
# src/types → libs/horn-profiles/src/lib/types
# src/profiles → libs/horn-profiles/src/lib/profiles
# src/utils → libs/horn-profiles/src/lib/utils
# src/registry → libs/horn-profiles/src/lib/registry
# tests → libs/horn-profiles/src/tests
```

### Phase 3: Create 2D Viewer Library
```bash
# Generate React library for visualization
nx g @nx/react:library viewer-2d \
  --directory=libs/viewer-2d \
  --style=css \
  --bundler=vite \
  --unitTestRunner=vitest \
  --component=false

# Install visualization dependencies
pnpm add recharts -w
pnpm add @types/recharts -D -w
```

### Phase 4: Configure Libraries

#### libs/horn-profiles/src/index.ts
```typescript
// Re-export all public APIs
export * from './lib/types';
export * from './lib/profiles/conical';
export * from './lib/profiles/exponential';
export * from './lib/profiles/tractrix';
export * from './lib/profiles/spherical';
export * from './lib/registry';
export * from './lib/utils/math';
export * from './lib/utils/validation';
export { generateProfile, getAvailableProfiles } from './lib/main';
```

#### libs/viewer-2d/src/lib/components/HornProfileViewer.tsx
```typescript
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ProfileGeneratorResult } from '@horn-profiles-monorepo/horn-profiles';

export interface HornProfileViewerProps {
  profile: ProfileGeneratorResult;
  width?: number | string;
  height?: number;
  showGrid?: boolean;
  strokeColor?: string;
}

export const HornProfileViewer: React.FC<HornProfileViewerProps> = ({
  profile,
  width = '100%',
  height = 400,
  showGrid = true,
  strokeColor = '#8884d8'
}) => {
  // Transform points for Recharts format
  const data = profile.points.map(point => ({
    x: point.x,
    y: point.y,
    '-y': -point.y // Mirror for bottom half
  }));

  return (
    <div className="horn-profile-viewer">
      <h3>{profile.metadata.profileType.toUpperCase()} Profile</h3>
      <ResponsiveContainer width={width} height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis 
            dataKey="x" 
            label={{ value: 'Length (mm)', position: 'insideBottom', offset: -5 }}
          />
          <YAxis 
            label={{ value: 'Radius (mm)', angle: -90, position: 'insideLeft' }}
            domain={['dataMin', 'dataMax']}
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
              <strong>{key}:</strong> {typeof value === 'number' ? value.toFixed(4) : value}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
```

### Phase 5: Configure React Application

#### apps/horn-viewer/src/app/app.tsx
```typescript
import React, { useState } from 'react';
import { 
  generateProfile, 
  HornProfileParameters,
  getAvailableProfiles 
} from '@horn-profiles-monorepo/horn-profiles';
import { HornProfileViewer } from '@horn-profiles-monorepo/viewer-2d';
import './app.css';

export function App() {
  const [profileType, setProfileType] = useState('conical');
  const [parameters, setParameters] = useState<HornProfileParameters>({
    throatRadius: 25,
    mouthRadius: 300,
    length: 500,
    resolution: 100,
    cutoffFrequency: 100,
    speedOfSound: 343.2
  });

  const profile = generateProfile(profileType, parameters);
  const availableProfiles = getAvailableProfiles();

  const handleParameterChange = (key: keyof HornProfileParameters, value: string) => {
    setParameters(prev => ({
      ...prev,
      [key]: parseFloat(value) || 0
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
              {availableProfiles.map(type => (
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
              onChange={(e) => handleParameterChange('throatRadius', e.target.value)}
            />
          </div>

          <div className="control-group">
            <label htmlFor="mouth-radius">Mouth Radius (mm):</label>
            <input
              id="mouth-radius"
              type="number"
              value={parameters.mouthRadius}
              onChange={(e) => handleParameterChange('mouthRadius', e.target.value)}
            />
          </div>

          <div className="control-group">
            <label htmlFor="length">Length (mm):</label>
            <input
              id="length"
              type="number"
              value={parameters.length}
              onChange={(e) => handleParameterChange('length', e.target.value)}
            />
          </div>

          <div className="control-group">
            <label htmlFor="resolution">Resolution:</label>
            <input
              id="resolution"
              type="number"
              value={parameters.resolution}
              onChange={(e) => handleParameterChange('resolution', e.target.value)}
            />
          </div>

          {(profileType === 'exponential' || profileType === 'tractrix' || profileType === 'spherical') && (
            <>
              <div className="control-group">
                <label htmlFor="cutoff-frequency">Cutoff Frequency (Hz):</label>
                <input
                  id="cutoff-frequency"
                  type="number"
                  value={parameters.cutoffFrequency}
                  onChange={(e) => handleParameterChange('cutoffFrequency', e.target.value)}
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
```

### Phase 6: Configuration Files

#### pnpm-workspace.yaml
```yaml
packages:
  - 'apps/*'
  - 'libs/*'
```

#### nx.json (key sections)
```json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"]
    },
    "test": {
      "inputs": ["default", "^production", "{workspaceRoot}/jest.preset.js"]
    }
  },
  "defaultBase": "main"
}
```

#### tsconfig.base.json (path mappings)
```json
{
  "compilerOptions": {
    "paths": {
      "@horn-profiles-monorepo/horn-profiles": ["libs/horn-profiles/src/index.ts"],
      "@horn-profiles-monorepo/viewer-2d": ["libs/viewer-2d/src/index.ts"]
    }
  }
}
```

## Implementation Tasks

1. **Workspace Setup** (30 min)
   - Create Nx workspace with pnpm
   - Configure workspace settings
   - Set up pnpm-workspace.yaml

2. **Library Migration** (45 min)
   - Generate horn-profiles library structure
   - Copy and reorganize existing code
   - Update import paths
   - Migrate tests

3. **Viewer Library Creation** (60 min)
   - Generate viewer-2d library
   - Install Recharts
   - Implement HornProfileViewer component
   - Create supporting components

4. **React App Development** (60 min)
   - Configure app structure
   - Implement control panel
   - Integrate viewer component
   - Add styling

5. **Testing & Validation** (30 min)
   - Run existing tests in new structure
   - Test library integration
   - Verify build process

6. **Documentation** (15 min)
   - Update README
   - Document new structure
   - Add development instructions

## Validation Gates

```bash
# 1. Workspace validation
pnpm install
nx list

# 2. Library builds
nx build horn-profiles
nx build viewer-2d

# 3. Type checking
nx run-many --target=typecheck --all

# 4. Linting
nx run-many --target=lint --all

# 5. Unit tests
nx run-many --target=test --all

# 6. Application serving
nx serve horn-viewer

# 7. Build all projects
nx run-many --target=build --all
```

## Error Handling Strategy

1. **Migration Issues**
   - Preserve original code in backup
   - Use `nx g move` for renaming if needed
   - Fix import paths systematically

2. **Dependency Conflicts**
   - Use pnpm's strict dependency resolution
   - Explicitly define versions in root package.json
   - Use workspace protocol for internal dependencies

3. **Build Failures**
   - Check tsconfig path mappings
   - Verify project.json configurations
   - Ensure proper dependency order

## Common Gotchas & Solutions

1. **Path Mappings**: Ensure tsconfig.base.json has correct mappings for all libraries
2. **Import Order**: Libraries must be imported using the workspace scope (@horn-profiles-monorepo/*)
3. **Vitest Configuration**: May need adjustment for monorepo structure
4. **React Fast Refresh**: Vite configuration might need tweaking for monorepo
5. **PNPM Strictness**: Some packages may need explicit installation at root level

## Success Criteria

- ✅ Nx workspace created with pnpm
- ✅ Horn-profiles library migrated and buildable
- ✅ 2D viewer library created and functional
- ✅ React app displays horn profiles interactively
- ✅ All tests pass
- ✅ All projects build successfully
- ✅ Development server runs without errors

## Additional Resources

- **Nx Cloud**: Consider setting up for distributed caching
- **Storybook**: Could be added for component development
- **E2E Testing**: Cypress or Playwright can be added later
- **CI/CD**: GitHub Actions configuration for Nx

## Migration Script

```bash
#!/bin/bash
# Quick migration script to automate initial setup

# Create workspace
npx create-nx-workspace@latest horn-profiles-monorepo \
  --preset=react-monorepo \
  --appName=horn-viewer \
  --style=css \
  --bundler=vite \
  --e2eTestRunner=none \
  --packageManager=pnpm \
  --nxCloud=skip

cd horn-profiles-monorepo

# Generate libraries
nx g @nx/js:library horn-profiles --directory=libs/horn-profiles --buildable --bundler=tsc --unitTestRunner=vitest
nx g @nx/react:library viewer-2d --directory=libs/viewer-2d --style=css --bundler=vite --unitTestRunner=vitest

# Install dependencies
pnpm add recharts -w
pnpm add @types/recharts -D -w

echo "Base structure created. Now migrate code files manually."
```

## Confidence Score: 9/10

**High confidence due to:**
- Clear migration path with Nx import command
- Well-documented Nx generators and configurations
- Existing code is well-structured and easy to migrate
- Recharts is straightforward for 2D visualization
- Comprehensive research on all aspects

**Minor uncertainty (-1) for:**
- Exact file organization during migration might need minor adjustments
- Some configuration tweaking may be needed for specific build optimizations
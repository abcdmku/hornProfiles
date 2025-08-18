# PRP: CAD-Style 2D Viewer Component

## Feature Overview
Create a professional CAD-style 2D viewer for displaying horn profile plots with analysis tools. The viewer must be completely isolated from horn profiles (a generic 2D plotter), provide measurement and analysis capabilities, and use modern Tailwind design.

## Context and Research Findings

### Current Implementation
- **Existing Viewer**: `libs/viewer-2d/src/lib/components/HornProfileViewer.tsx` uses Recharts (simple charting library)
- **Data Structure**: Points come as `{x: number, y: number}[]` from horn-profiles library
- **UI Framework**: React 19 + Vite + Tailwind CSS in Nx monorepo
- **Current Features**: Basic line chart, metadata display, limited interactivity

### Library Selection: Konva.js
After comparing Konva.js, Fabric.js, and Paper.js, **Konva.js** is selected for:
- **Performance**: 23 fps with 8k objects vs Fabric's 9 fps
- **React Integration**: Dedicated react-konva library with declarative bindings
- **Real-time Manipulation**: Optimized for frequent updates and animations
- **Documentation**: Extensive examples for zoom, pan, grid, measurements

### Required Features
1. **CAD-like Display**
   - Professional grid with major/minor lines
   - Rulers on X and Y axes
   - Coordinate display
   - Crosshair cursor

2. **Interactive Tools**
   - Pan (middle mouse / space+drag)
   - Zoom (mouse wheel, zoom controls)
   - Fit to view
   - Reset view

3. **Measurement Tools**
   - Distance measurement between points
   - Angle measurement (3-point)
   - Area calculation for closed shapes
   - Point coordinates display

4. **Analysis Features**
   - Derivative visualization (slope)
   - Curvature analysis
   - Min/max point identification
   - Profile comparison overlay

5. **Export Options**
   - SVG export
   - PNG export with resolution options
   - Data export (CSV, JSON)

## Implementation Blueprint

### Directory Structure
```
libs/viewer-2d/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── Viewer2D.tsx              # Main component
│   │   │   ├── Canvas/
│   │   │   │   ├── GridLayer.tsx         # Grid rendering
│   │   │   │   ├── RulerLayer.tsx        # Rulers
│   │   │   │   ├── PlotLayer.tsx         # Data plotting
│   │   │   │   ├── MeasurementLayer.tsx  # Measurement tools
│   │   │   │   └── AnnotationLayer.tsx   # Labels/annotations
│   │   │   ├── Controls/
│   │   │   │   ├── ZoomControls.tsx      # Zoom buttons
│   │   │   │   ├── ToolSelector.tsx      # Tool palette
│   │   │   │   └── ExportMenu.tsx        # Export options
│   │   │   └── Panels/
│   │   │       ├── InfoPanel.tsx         # Coordinate display
│   │   │       └── AnalysisPanel.tsx     # Analysis results
│   │   ├── hooks/
│   │   │   ├── useViewport.ts            # Viewport management
│   │   │   ├── useMeasurement.ts         # Measurement logic
│   │   │   └── useInteraction.ts         # Mouse/keyboard
│   │   ├── utils/
│   │   │   ├── geometry.ts               # Math calculations
│   │   │   ├── export.ts                 # Export functions
│   │   │   └── transform.ts              # Coordinate transforms
│   │   └── types/
│   │       └── index.ts                  # Type definitions
│   └── index.ts
```

### Core Implementation Pseudocode

```typescript
// Main Viewer Component Structure
function Viewer2D({ data, options }) {
  // Viewport state (position, scale, rotation)
  const viewport = useViewport(initialBounds)
  
  // Tool state (select, pan, measure, etc.)
  const [activeTool, setActiveTool] = useState('select')
  
  // Measurement state
  const measurements = useMeasurement()
  
  // Interaction handling
  const interactions = useInteraction(viewport, activeTool)
  
  return (
    <div className="viewer-container">
      <ToolBar onToolChange={setActiveTool} />
      <Stage
        width={width}
        height={height}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        x={viewport.x}
        y={viewport.y}
        onWheel={interactions.handleWheel}
        onMouseDown={interactions.handleMouseDown}
        onMouseMove={interactions.handleMouseMove}
      >
        <Layer name="grid">
          <GridLayer viewport={viewport} />
        </Layer>
        <Layer name="rulers">
          <RulerLayer viewport={viewport} />
        </Layer>
        <Layer name="plot">
          <PlotLayer data={data} viewport={viewport} />
        </Layer>
        <Layer name="measurements">
          <MeasurementLayer measurements={measurements} />
        </Layer>
        <Layer name="annotations">
          <AnnotationLayer viewport={viewport} />
        </Layer>
      </Stage>
      <InfoPanel viewport={viewport} cursor={interactions.cursor} />
      <AnalysisPanel data={data} />
    </div>
  )
}
```

### Key Algorithms

```typescript
// Zoom relative to cursor
function zoomAtPoint(stage, point, scaleBy) {
  const oldScale = stage.scaleX()
  const mousePointTo = {
    x: (point.x - stage.x()) / oldScale,
    y: (point.y - stage.y()) / oldScale
  }
  
  const newScale = oldScale * scaleBy
  stage.scale({ x: newScale, y: newScale })
  
  const newPos = {
    x: point.x - mousePointTo.x * newScale,
    y: point.y - mousePointTo.y * newScale
  }
  stage.position(newPos)
}

// Snap to grid
function snapToGrid(value, gridSize) {
  return Math.round(value / gridSize) * gridSize
}

// Distance calculation
function distance(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y)
}

// Angle calculation (3 points)
function angle(p1, vertex, p2) {
  const a = distance(vertex, p1)
  const b = distance(vertex, p2)
  const c = distance(p1, p2)
  return Math.acos((a*a + b*b - c*c) / (2*a*b)) * (180/Math.PI)
}

// Area calculation (polygon)
function polygonArea(points) {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    area += points[i].x * points[j].y
    area -= points[i].y * points[j].x
  }
  return Math.abs(area / 2)
}
```

## Dependencies to Install

```bash
# Core canvas library
pnpm add konva react-konva

# Utility libraries
pnpm add @scena/react-ruler  # For rulers
pnpm add file-saver          # For export functionality

# Development dependencies
pnpm add -D @types/file-saver
```

## Implementation Tasks

1. **Setup Base Structure** [Priority: 1]
   - Install Konva.js and react-konva
   - Create component directory structure
   - Setup basic Stage and Layer components
   - Configure TypeScript types

2. **Implement Viewport System** [Priority: 1]
   - Create useViewport hook for state management
   - Implement zoom (wheel, buttons, fit-to-view)
   - Implement pan (drag, middle-mouse)
   - Add boundary constraints

3. **Create Grid System** [Priority: 2]
   - Render major/minor grid lines
   - Dynamic grid spacing based on zoom
   - Grid snapping functionality
   - Grid visibility toggle

4. **Add Rulers** [Priority: 2]
   - X and Y axis rulers with tick marks
   - Dynamic scale based on viewport
   - Current cursor position indicator
   - Unit display (mm, inches)

5. **Implement Plot Rendering** [Priority: 1]
   - Convert point data to Konva Line shapes
   - Handle multiple plots (overlay)
   - Apply styling (color, thickness, dash)
   - Optimize for large datasets

6. **Add Measurement Tools** [Priority: 3]
   - Distance tool (2-point)
   - Angle tool (3-point)
   - Area tool (polygon)
   - Persistent measurement display

7. **Create Control Interface** [Priority: 2]
   - Tool selector (select, pan, measure)
   - Zoom controls (+/-, fit, reset)
   - Grid/ruler toggles
   - Export menu

8. **Implement Analysis Features** [Priority: 4]
   - Derivative calculation and display
   - Curvature visualization
   - Min/max point markers
   - Hover tooltips with values

9. **Add Export Functionality** [Priority: 3]
   - SVG export using Konva's toDataURL
   - PNG export with resolution options
   - CSV data export
   - JSON data export

10. **Apply Tailwind Styling** [Priority: 2]
    - Modern dark/light theme
    - Responsive layout
    - Smooth animations
    - Professional CAD appearance

## File References from Codebase

### To Modify:
- `libs/viewer-2d/src/lib/components/HornProfileViewer.tsx` - Replace with new Viewer2D
- `libs/viewer-2d/src/index.ts` - Export new component

### To Reference for Patterns:
- `apps/horn-viewer/src/app/app.tsx` - Integration example
- `libs/horn-profiles/src/lib/types/index.ts` - Data types
- `apps/horn-viewer/tailwind.config.js` - Tailwind configuration

### Test Patterns:
- `libs/horn-profiles/src/lib/profiles/conical.test.ts` - Test structure example

## Validation Gates

```bash
# Type checking
npx tsc --noEmit

# Linting
npx eslint libs/viewer-2d --fix

# Unit tests (create tests for each component)
npx vitest run libs/viewer-2d

# Build verification
npx nx build viewer-2d

# Integration test (manual)
# 1. Start dev server: pnpm dev:web
# 2. Verify all tools work
# 3. Test with different datasets
# 4. Check performance with 1000+ points
```

## External Documentation URLs

### Konva.js Documentation
- Main docs: https://konvajs.org/docs/
- React integration: https://konvajs.org/docs/react/
- Zoom example: https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html
- Snap to grid: https://konvajs.org/docs/sandbox/Objects_Snapping.html
- Export: https://konvajs.org/docs/data_and_serialization/High-Quality-Export.html

### Reference Implementations
- Konva demos: https://konvajs.org/docs/sandbox/
- React-konva examples: https://github.com/konvajs/react-konva/tree/master/examples
- Grid implementation: https://medium.com/@pierrebleroux/snap-to-grid-with-konvajs-c41eae97c13f

## Error Handling Strategy

```typescript
// Wrap all interactions in error boundaries
class ViewerErrorBoundary extends React.Component {
  componentDidCatch(error, info) {
    console.error('Viewer error:', error, info)
    // Show user-friendly error message
    // Offer to reset viewer
  }
}

// Validate input data
function validatePlotData(data) {
  if (!Array.isArray(data)) throw new Error('Data must be an array')
  if (data.length < 2) throw new Error('Need at least 2 points')
  data.forEach((point, i) => {
    if (typeof point.x !== 'number' || typeof point.y !== 'number') {
      throw new Error(`Invalid point at index ${i}`)
    }
  })
}

// Handle canvas errors
stage.on('error', (err) => {
  console.error('Canvas error:', err)
  // Attempt recovery or show fallback
})
```

## Performance Optimization

```typescript
// Use React.memo for expensive components
const GridLayer = React.memo(({ viewport }) => {
  // Only re-render when viewport changes significantly
}, (prevProps, nextProps) => {
  return Math.abs(prevProps.viewport.scale - nextProps.viewport.scale) < 0.01
})

// Throttle mouse events
const handleMouseMove = useMemo(
  () => throttle((e) => {
    // Update cursor position
  }, 16), // 60fps
  []
)

// Use Konva's caching for complex shapes
shape.cache()
shape.drawHitFromCache()

// Virtualize points for large datasets
function virtualizePoints(points, viewport) {
  // Only render points within viewport bounds
  return points.filter(p => isInViewport(p, viewport))
}
```

## Component API Design

```typescript
interface Viewer2DProps {
  // Data
  data: Point2D[] | Point2D[][]  // Single or multiple plots
  
  // Display options
  width?: number | string
  height?: number
  theme?: 'light' | 'dark'
  
  // Features
  enableGrid?: boolean
  enableRulers?: boolean
  enableMeasurements?: boolean
  enableAnalysis?: boolean
  
  // Callbacks
  onMeasure?: (measurement: Measurement) => void
  onExport?: (format: string, data: any) => void
  onViewportChange?: (viewport: Viewport) => void
  
  // Styling
  plotColors?: string[]
  gridColor?: string
  backgroundColor?: string
}
```

## Testing Strategy

```typescript
// Component tests
describe('Viewer2D', () => {
  it('renders without data', () => {
    render(<Viewer2D data={[]} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })
  
  it('plots data correctly', () => {
    const data = [{x: 0, y: 0}, {x: 100, y: 100}]
    render(<Viewer2D data={data} />)
    // Verify line is drawn
  })
  
  it('zooms on wheel event', () => {
    const { container } = render(<Viewer2D data={testData} />)
    fireEvent.wheel(container, { deltaY: -100 })
    // Verify scale changed
  })
  
  it('measures distance accurately', () => {
    // Test measurement calculations
  })
})

// Integration tests
describe('Viewer2D Integration', () => {
  it('integrates with horn profile data', () => {
    const profile = generateProfile('conical', params)
    render(<Viewer2D data={profile.points} />)
    // Verify rendering
  })
})
```

## Success Metrics
- Renders 1000+ points at 60fps
- Zoom/pan smooth with no lag
- Measurements accurate to 0.1mm
- Export produces high-quality output
- All tools intuitive and responsive
- Matches Tailwind design system

## Confidence Score: 8/10

### Strengths:
- Comprehensive research on libraries and patterns
- Clear implementation blueprint with code examples
- Specific file references and integration points
- Detailed validation gates
- Performance optimization strategies

### Potential Challenges:
- Konva.js learning curve for complex interactions
- Performance with very large datasets (10k+ points)
- Coordinating multiple canvas layers efficiently
- Ensuring precise measurement accuracy

This PRP provides all necessary context for implementing a professional CAD-style 2D viewer with modern features and excellent performance.
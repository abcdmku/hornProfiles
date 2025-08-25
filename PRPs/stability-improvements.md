# PRP: Input Stability and UX Improvements

## Problem Statement
The horn viewer application crashes when users interact with numeric input fields in specific ways:
1. **Deleting all characters**: When user deletes the entire value (e.g., clearing "500" to enter "150"), the app crashes
2. **Highlighting and replacing**: When user selects all text and types a new value, the app crashes
3. **Division by zero**: Aspect ratio calculations cause NaN/Infinity errors when values become 0
4. **Poor UX**: No input validation, no min/max constraints, no error boundaries

These issues occur in all numeric inputs in the side navigation panel, affecting critical parameters like horn width, height, length, and resolution.

## Root Cause Analysis

### Primary Issue Location
**File**: `apps/horn-viewer/src/app/app.tsx`
**Function**: `handleParameterChange` (lines 78-111)

### Core Problems
1. **Division by zero in aspect ratio calculations**:
   ```typescript
   // Line 86-87: When throatWidth becomes 0
   const aspectRatio = prev.throatHeight / prev.throatWidth; // Results in Infinity
   newParams.throatHeight = numValue * aspectRatio; // Results in NaN
   ```

2. **Inadequate empty value handling**:
   ```typescript
   const numValue = parseFloat(value) || 0; // Empty string → NaN → 0
   ```

3. **No input validation**: Missing checks for:
   - Minimum/maximum values
   - NaN/Infinity values
   - Valid numeric ranges
   - Empty string handling

## Research Context

### React Numeric Input Best Practices (2024)
**Sources**: 
- https://stackoverflow.com/questions/74441392/how-do-i-avoid-getting-a-nan-error-when-cleaning-a-react-input-field-type-number
- https://react.dev/reference/react-dom/components/input
- https://github.com/facebook/react/issues/7779

**Key Findings**:
1. **Use string state for numeric inputs**: Prevents NaN issues and allows empty values
2. **Handle empty strings explicitly**: Use nullish coalescing (`??`) instead of logical OR (`||`)
3. **Validate on change, not on parse**: Separate validation from state updates
4. **Use onInput for type="number"**: Better cross-browser compatibility

### Existing Codebase Patterns
**Validation utilities available**: `libs/horn-profiles/src/lib/utils/validation.ts`
- `isPositive()`: Validates positive numbers
- `isNonNegative()`: Validates non-negative numbers
- `isInRange()`: Validates value within range
- `isFinite()`: Checks for finite numbers
- `ValidationError`: Custom error class

## Implementation Blueprint

### Phase 1: Create Safe Input Handling Utilities

```typescript
// apps/horn-viewer/src/utils/input-handlers.ts

interface NumericInputConfig {
  min?: number;
  max?: number;
  defaultValue: number;
  allowEmpty?: boolean;
  precision?: number;
}

export function createSafeNumericHandler(
  config: NumericInputConfig,
  onChange: (value: number | '') => void
) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // Allow empty string for better UX
    if (rawValue === '' && config.allowEmpty) {
      onChange('');
      return;
    }
    
    const numValue = parseFloat(rawValue);
    
    // Validate numeric value
    if (isNaN(numValue)) {
      return; // Ignore invalid input
    }
    
    // Apply constraints
    let constrainedValue = numValue;
    if (config.min !== undefined) {
      constrainedValue = Math.max(config.min, constrainedValue);
    }
    if (config.max !== undefined) {
      constrainedValue = Math.min(config.max, constrainedValue);
    }
    
    onChange(constrainedValue);
  };
}

export function safeAspectRatioCalculation(
  baseValue: number,
  referenceValue: number,
  fallbackRatio: number = 1
): number {
  if (referenceValue === 0 || !isFinite(referenceValue)) {
    return baseValue * fallbackRatio;
  }
  const ratio = baseValue / referenceValue;
  if (!isFinite(ratio)) {
    return baseValue * fallbackRatio;
  }
  return ratio;
}
```

### Phase 2: Refactor State Management

```typescript
// Modify app.tsx state to use string | number union type
interface NumericParameters {
  throatWidth: number | '';
  throatHeight: number | '';
  mouthWidth: number | '';
  mouthHeight: number | '';
  length: number | '';
  resolution: number | '';
  cutoffFrequency: number | '';
  speedOfSound: number | '';
}

// Add parameter constraints
const PARAMETER_CONSTRAINTS = {
  throatWidth: { min: 1, max: 1000, default: 50 },
  throatHeight: { min: 1, max: 1000, default: 50 },
  mouthWidth: { min: 10, max: 5000, default: 600 },
  mouthHeight: { min: 10, max: 5000, default: 600 },
  length: { min: 10, max: 10000, default: 500 },
  resolution: { min: 10, max: 500, default: 100 },
  cutoffFrequency: { min: 20, max: 20000, default: 100 },
  speedOfSound: { min: 100, max: 500, default: 343.2 }
};
```

### Phase 3: Implement Safe Parameter Handler

```typescript
const handleParameterChange = useCallback((
  key: keyof HornProfileParameters,
  value: string
): void => {
  const constraint = PARAMETER_CONSTRAINTS[key];
  
  setParameters((prev) => {
    const newParams = { ...prev };
    
    // Handle empty value
    if (value === '') {
      newParams[key] = '';
      return newParams;
    }
    
    // Parse and validate
    const numValue = parseFloat(value);
    if (isNaN(numValue) || !isFinite(numValue)) {
      return prev; // Don't update on invalid input
    }
    
    // Apply constraints
    const constrainedValue = Math.max(
      constraint.min,
      Math.min(constraint.max, numValue)
    );
    
    // Handle aspect ratio locking with safe calculations
    if (throatLocked && (key === 'throatWidth' || key === 'throatHeight')) {
      const prevWidth = typeof prev.throatWidth === 'number' ? prev.throatWidth : constraint.default;
      const prevHeight = typeof prev.throatHeight === 'number' ? prev.throatHeight : constraint.default;
      
      if (key === 'throatWidth') {
        const ratio = safeAspectRatioCalculation(prevHeight, prevWidth);
        newParams.throatWidth = constrainedValue;
        newParams.throatHeight = Math.min(
          PARAMETER_CONSTRAINTS.throatHeight.max,
          Math.max(PARAMETER_CONSTRAINTS.throatHeight.min, constrainedValue * ratio)
        );
      } else {
        const ratio = safeAspectRatioCalculation(prevWidth, prevHeight);
        newParams.throatHeight = constrainedValue;
        newParams.throatWidth = Math.min(
          PARAMETER_CONSTRAINTS.throatWidth.max,
          Math.max(PARAMETER_CONSTRAINTS.throatWidth.min, constrainedValue * ratio)
        );
      }
    } else if (mouthLocked && (key === 'mouthWidth' || key === 'mouthHeight')) {
      // Similar logic for mouth dimensions
      // ... (implement similar safe calculations)
    } else {
      newParams[key] = constrainedValue;
    }
    
    return newParams;
  });
}, [throatLocked, mouthLocked]);
```

### Phase 4: Enhanced Input Components

```typescript
// Create reusable numeric input component
interface NumericInputProps {
  id: string;
  label: string;
  value: number | '';
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  unit?: string;
}

function NumericInput({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  placeholder,
  unit
}: NumericInputProps) {
  const displayValue = value === '' ? '' : value.toString();
  
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-slate-400 mb-1">
        {label} {unit && <span className="text-slate-500">({unit})</span>}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={displayValue}
        onInput={(e) => onChange(e.currentTarget.value)}
        onBlur={(e) => {
          // On blur, ensure value is within constraints
          if (e.currentTarget.value === '') {
            onChange(min?.toString() || '0');
          }
        }}
        className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
        placeholder={placeholder}
      />
    </div>
  );
}
```

### Phase 5: Add Error Boundary

```typescript
// apps/horn-viewer/src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
          <h2 className="text-red-400 font-semibold">Something went wrong</h2>
          <p className="text-red-300 text-sm mt-2">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-red-700 text-white rounded hover:bg-red-600"
          >
            Reset
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Tasks Implementation Order

1. **Create input utilities module** (`apps/horn-viewer/src/utils/input-handlers.ts`)
   - Implement `createSafeNumericHandler`
   - Implement `safeAspectRatioCalculation`
   - Export parameter constraints

2. **Add ErrorBoundary component** (`apps/horn-viewer/src/components/ErrorBoundary.tsx`)
   - Implement error boundary with recovery
   - Add error logging

3. **Create NumericInput component** (`apps/horn-viewer/src/components/NumericInput.tsx`)
   - Implement reusable numeric input
   - Add validation and constraints

4. **Refactor app.tsx**
   - Update state types to support empty values
   - Replace `handleParameterChange` with safe version
   - Replace all numeric inputs with NumericInput component
   - Wrap app in ErrorBoundary

5. **Add input validation tests**
   - Test empty value handling
   - Test constraint enforcement
   - Test aspect ratio calculations
   - Test error recovery

## Validation Gates

```bash
# Type checking - must pass
npx tsc --noEmit

# Build - must succeed
pnpm --filter horn-viewer build

# Dev server - must run without crashes
timeout 30 pnpm --filter horn-viewer dev

# Manual testing checklist (to be verified by AI agent):
# 1. Delete all characters from any numeric input - should not crash
# 2. Highlight and replace values - should not crash
# 3. Enter negative values - should be constrained to min
# 4. Enter very large values - should be constrained to max
# 5. Toggle aspect ratio lock with 0 values - should not produce NaN
# 6. Rapid input changes - should remain responsive
```

## Additional Improvements

### Future Enhancements (Optional)
1. **Debounced updates**: Add debouncing to prevent excessive re-renders
2. **Undo/Redo**: Implement parameter history
3. **Presets**: Add common horn configurations
4. **Keyboard shortcuts**: Arrow keys for increment/decrement
5. **Input tooltips**: Show min/max constraints on hover

### Performance Considerations
- Use `React.memo` for NumericInput component
- Implement `useMemo` for expensive calculations
- Consider virtualization for large parameter lists

## File References for Implementation

**Files to modify**:
1. `apps/horn-viewer/src/app/app.tsx` - Main application component
2. `apps/horn-viewer/src/main.tsx` - Add ErrorBoundary wrapper

**Files to create**:
1. `apps/horn-viewer/src/utils/input-handlers.ts` - Input utilities
2. `apps/horn-viewer/src/components/ErrorBoundary.tsx` - Error boundary
3. `apps/horn-viewer/src/components/NumericInput.tsx` - Numeric input component
4. `apps/horn-viewer/src/utils/constants.ts` - Parameter constraints

**Existing utilities to leverage**:
- `libs/horn-profiles/src/lib/utils/validation.ts` - Validation functions

## Success Criteria

1. **No crashes**: Application remains stable under all input scenarios
2. **Graceful degradation**: Invalid inputs are ignored or constrained
3. **Clear feedback**: Users understand input constraints
4. **Maintained functionality**: All existing features continue to work
5. **Improved UX**: Smoother input experience with proper validation

## Confidence Score: 9/10

This PRP provides comprehensive context and implementation details for one-pass success. The only uncertainty is around potential edge cases in the 3D mesh generation that might need additional safety checks, but the core input stability issues are fully addressed.
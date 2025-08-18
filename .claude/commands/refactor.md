# filename

Refactor TypeScript files following best practices and the refactor.md guide.

## Usage

```
/refactor <filename>
```

## Examples

```
/refactor src/components/UserProfile.tsx
/refactor src/utils/api.ts
```

## What it does

This command will:

1. **Analyze the file** - Read and understand the current implementation
2. **Identify issues** - Find code smells, type safety issues, and optimization opportunities
3. **Create a refactoring plan** - Generate a todo list of improvements
4. **Execute refactoring** - Make incremental changes following best practices
5. **Validate changes** - Run TypeScript compiler, linter, and tests
6. **Report results** - Summarize what was improved

## Refactoring Process

The command follows this systematic approach:

### Phase 1: Analysis
- Read the entire file and understand its purpose
- Check for existing tests
- Analyze dependencies and imports
- Identify related files in the same directory
- Check existing code style and conventions

### Phase 2: Issue Detection
- **Critical Issues**
  - Any use of `any` type
  - Suppressed TypeScript errors (`@ts-ignore`)
  - Empty catch blocks
  - Hardcoded credentials or secrets

- **Code Smells**
  - Functions longer than 20 lines
  - Files longer than 200 lines
  - Deep nesting (>3 levels)
  - Duplicate code blocks
  - Mixed abstraction levels
  - Complex conditionals
  - Long parameter lists (>3)
  - Multiple unrelated functions in one file

- **Performance Issues**
  - Missing memoization in React components
  - Unnecessary re-renders
  - Inefficient loops or computations

### Phase 3: Refactoring Actions
- Extract long functions into smaller ones
- **Split large files into separate modules**
  - Move each major function to its own file
  - Group related utility functions together
  - Create barrel exports (index.ts) for clean imports
- Convert promises to async/await
- Replace magic values with constants
- Add proper TypeScript types
- Extract custom hooks (React)
- Simplify complex conditionals
- Apply dependency injection where needed
- Optimize performance bottlenecks

### Phase 4: Validation
- Run TypeScript compiler (`npx tsc --noEmit`)
- Run linter (`npm run lint`)
- Run tests if available (`npm test`)
- Check for unused imports
- Verify no console.logs were added

## Options

You can specify focus areas:

```
/refactor src/api.ts types        # Focus on type safety
/refactor src/Component.tsx perf   # Focus on performance
/refactor src/service.ts clean     # Focus on code cleanliness
```

## What gets refactored

Based on the refactor.md guide, the command will:

1. **Type Safety**
   - Remove all `any` types
   - Add proper type annotations
   - Use discriminated unions
   - Extract type aliases

2. **Code Organization**
   - Extract functions (>20 lines)
   - Apply single responsibility principle
   - Group related functionality
   - Use proper abstraction levels
   - **Break large files into separate modules**
     - Extract each major function to its own file
     - Keep logical groupings of related utility functions
     - Maintain overall file length under 200 lines
     - Create index files for re-exporting when needed

3. **Modern Patterns**
   - Convert callbacks to async/await
   - Use optional chaining and nullish coalescing
   - Apply functional programming where appropriate
   - Use const assertions for literals

4. **React Specific** (if applicable)
   - Extract custom hooks
   - Add proper memoization
   - Optimize re-renders
   - Split large components

5. **Performance**
   - Add appropriate memoization
   - Optimize loops and computations
   - Lazy load when beneficial
   - Remove unnecessary dependencies

## Safety Features

The command includes safety measures:
- Creates a todo list for complex refactors
- Makes incremental changes
- Validates after each major change
- Preserves existing functionality
- Follows existing code conventions
- Can rollback if issues arise

## Output

After refactoring, you'll receive:
- Summary of changes made
- List of improvements
- Any remaining issues that need manual review
- Test results (if tests exist)
- Performance impact (if measurable)

## Notes

- The command requires the file to exist
- Works best with TypeScript files (.ts, .tsx)
- Follows the project's existing conventions
- Won't introduce new dependencies without asking
- Preserves all existing functionality
- Creates clean, readable, maintainable code

## Related Commands

- `/analyze` - Analyze code without refactoring
- `/test` - Run tests for a file
- `/lint` - Check linting issues
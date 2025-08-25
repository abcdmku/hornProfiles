import { generateCrossSectionPoints } from './dist/libs/horn-mesher/index.js';

// Test rectangle orientation
console.log('Testing rectangle orientation:');
console.log('Width should be horizontal (y-axis)');
console.log('Height should be vertical (z-axis)\n');

// Test with width > height (should be wider horizontally)
const wideRect = generateCrossSectionPoints('rectangular', 2, 1, 4);
console.log('Wide rectangle (width=2, height=1):');
wideRect.forEach((p, i) => {
  console.log(`${i}: y=${p.y.toFixed(2)}, z=${p.z.toFixed(2)}`);
});

console.log('\nExpected: y values range from -2 to 2 (width)');
console.log('Expected: z values range from -1 to 1 (height)');

// Test with height > width (should be taller vertically)
const tallRect = generateCrossSectionPoints('rectangular', 1, 2, 4);
console.log('Tall rectangle (width=1, height=2):');
tallRect.forEach((p, i) => {
  console.log(`${i}: y=${p.y.toFixed(2)}, z=${p.z.toFixed(2)}`);
});

console.log('\nExpected: y values range from -1 to 1 (width)');
console.log('Expected: z values range from -2 to 2 (height)');
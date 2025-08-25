import { generateCrossSectionPoints } from './dist/libs/horn-mesher/index.js';

console.log('Testing mixed cross-section modes:');
console.log('Rectangular throat with elliptical mouth\n');

// Test rectangular throat dimensions
const rectThroat = generateCrossSectionPoints('rectangular', 2, 1, 4);
console.log('Rectangular throat (width=2, height=1):');
rectThroat.forEach((p, i) => {
  console.log(`  Corner ${i}: y=${p.y.toFixed(2)}, z=${p.z.toFixed(2)}`);
});

console.log('\nExpected for proper orientation:');
console.log('  y values should range from -2 to 2 (width)');
console.log('  z values should range from -1 to 1 (height)');

// Check if the orientation is correct
const yMax = Math.max(...rectThroat.map(p => Math.abs(p.y)));
const zMax = Math.max(...rectThroat.map(p => Math.abs(p.z)));

if (Math.abs(yMax - 2) < 0.01 && Math.abs(zMax - 1) < 0.01) {
  console.log('\n✓ Rectangular throat orientation is CORRECT');
} else {
  console.log('\n✗ Rectangular throat orientation is INCORRECT');
  console.log(`  Actual: y max = ${yMax}, z max = ${zMax}`);
}
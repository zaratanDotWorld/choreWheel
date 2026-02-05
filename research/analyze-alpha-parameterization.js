/**
 * Analysis: Finding optimal α for the simplified damping formula
 *
 * Formula: d = effectiveP / (effectiveP + α × numItems)
 * Where: effectiveP = Σᵢ √prefs_i (sum of square roots)
 */

const fs = require('fs');
const path = require('path');

// Parse CSV file
function parseCSV (csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n').slice(1); // Skip header

  return lines.map((line) => {
    // Format: id,"residentId","alphaChore","betaChore","preference"
    // id is unquoted, rest are quoted
    const match = line.match(/^\d+,"([^"]+)","([^"]+)","([^"]+)","([^"]+)"/);
    if (!match) return null;
    return {
      residentId: match[1],
      alphaChore: match[2],
      betaChore: match[3],
      preference: parseFloat(match[4]),
    };
  }).filter(Boolean);
}

// Get unique chores
function getUniqueChores (preferences) {
  const chores = new Set();
  preferences.forEach((p) => {
    chores.add(p.alphaChore);
    chores.add(p.betaChore);
  });
  return chores;
}

// Get preference counts by resident
function getPrefsByResident (preferences) {
  const counts = {};
  preferences.forEach((p) => {
    counts[p.residentId] = (counts[p.residentId] || 0) + 1;
  });
  return counts;
}

// Compute effectiveP using sum of square roots (true QV)
function computeEffectiveP (prefsByResident) {
  return Object.values(prefsByResident).reduce((sum, n) => sum + Math.sqrt(n), 0);
}

// Compute effectiveP using squared formula (QF-style, for comparison)
function computeEffectivePSquared (prefsByResident) {
  const sumOfRoots = Object.values(prefsByResident).reduce((sum, n) => sum + Math.sqrt(n), 0);
  return sumOfRoots * sumOfRoots;
}

// Compute damping with new formula
function computeDampingNew (effectiveP, numItems, alpha) {
  const raw = effectiveP / (effectiveP + alpha * numItems);
  return Math.max(0.05, Math.min(0.99, raw));
}

// Compute damping with old formula (for comparison)
function computeDampingOld (effectivePSquared, maxPairs, alpha) {
  const raw = effectivePSquared / (effectivePSquared + alpha * maxPairs);
  return Math.max(0.05, Math.min(0.99, raw));
}

// Analyze a dataset
function analyzeDataset (name, csvPath) {
  const preferences = parseCSV(csvPath);
  const chores = getUniqueChores(preferences);
  const prefsByResident = getPrefsByResident(preferences);

  const numItems = chores.size;
  const maxPairs = numItems * (numItems - 1) / 2;
  const totalPrefs = preferences.length;
  const numActiveResidents = Object.keys(prefsByResident).length;

  const effectiveP = computeEffectiveP(prefsByResident);
  const effectivePSquared = computeEffectivePSquared(prefsByResident);

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Dataset: ${name}`);
  console.log('='.repeat(70));

  console.log('\n--- Basic Stats ---');
  console.log(`Number of items (chores): ${numItems}`);
  console.log(`Max pairs: ${maxPairs}`);
  console.log(`√maxPairs: ${Math.sqrt(maxPairs).toFixed(2)}`);
  console.log(`Total preferences: ${totalPrefs}`);
  console.log(`Active residents: ${numActiveResidents}`);

  console.log('\n--- Preference Distribution ---');
  const sortedResidents = Object.entries(prefsByResident)
    .sort((a, b) => b[1] - a[1]);
  sortedResidents.forEach(([ id, count ], i) => {
    const shortId = id.slice(-6);
    const sqrt = Math.sqrt(count).toFixed(2);
    console.log(`  Resident ${i + 1} (${shortId}): ${count} prefs (√ = ${sqrt})`);
  });

  console.log('\n--- Effective P Calculations ---');
  console.log(`Sum of √prefs (QV formula): ${effectiveP.toFixed(2)}`);
  console.log(`(Sum of √prefs)² (QF formula): ${effectivePSquared.toFixed(2)}`);
  console.log(`Ratio effectiveP / numItems: ${(effectiveP / numItems).toFixed(3)}`);

  // Coalition analysis
  const maxContributor = sortedResidents[0][1];
  const othersSum = sortedResidents.slice(1).reduce((sum, [ , count ]) => sum + Math.sqrt(count), 0);
  const dominantContribution = Math.sqrt(maxContributor);
  console.log('\n--- Coalition Analysis ---');
  console.log(`Dominant contributor: ${maxContributor} prefs (√ = ${dominantContribution.toFixed(2)})`);
  console.log(`Others combined √contribution: ${othersSum.toFixed(2)}`);
  console.log(`Coalition multiplier: ${(effectiveP / dominantContribution).toFixed(2)}x`);

  // Explore α values with NEW formula
  console.log('\n--- New Formula: d = effectiveP / (effectiveP + α × numItems) ---');
  console.log('α\t\td\t\tHalf-sat point');
  const alphasNew = [ 0.1, 0.2, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0 ];
  const resultsNew = [];
  alphasNew.forEach((alpha) => {
    const d = computeDampingNew(effectiveP, numItems, alpha);
    const halfSat = alpha * numItems; // effectiveP needed for d=0.5
    resultsNew.push({ alpha, d, halfSat });
    console.log(`${alpha.toFixed(1)}\t\t${d.toFixed(3)}\t\t${halfSat.toFixed(1)}`);
  });

  // Explore α values with OLD formula (for comparison)
  console.log('\n--- Old Formula: d = effectiveP² / (effectiveP² + α × maxPairs) ---');
  console.log('α\t\td\t\tHalf-sat point');
  const alphasOld = [ 0.1, 0.2, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0 ];
  alphasOld.forEach((alpha) => {
    const d = computeDampingOld(effectivePSquared, maxPairs, alpha);
    const halfSat = alpha * maxPairs;
    console.log(`${alpha.toFixed(1)}\t\t${d.toFixed(3)}\t\t${halfSat.toFixed(1)}`);
  });

  // Find α that gives specific d values
  console.log('\n--- Target Analysis (New Formula) ---');
  const targetDs = [ 0.5, 0.6, 0.7, 0.8, 0.85, 0.9 ];
  console.log('Target d\tRequired α\tHalf-sat point');
  targetDs.forEach((targetD) => {
    // d = E / (E + α*n) => α*n = E*(1-d)/d => α = E*(1-d)/(d*n)
    const requiredAlpha = effectiveP * (1 - targetD) / (targetD * numItems);
    const halfSat = requiredAlpha * numItems;
    console.log(`${targetD.toFixed(2)}\t\t${requiredAlpha.toFixed(3)}\t\t${halfSat.toFixed(1)}`);
  });

  return {
    name,
    numItems,
    maxPairs,
    totalPrefs,
    numActiveResidents,
    effectiveP,
    effectivePSquared,
    prefsByResident: sortedResidents,
  };
}

// Main
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║     Alpha Parameterization Analysis for Simplified Damping Formula   ║');
console.log('║                                                                      ║');
console.log('║     d = effectiveP / (effectiveP + α × numItems)                     ║');
console.log('║     where effectiveP = Σᵢ √prefs_i                                   ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');

const sageData = analyzeDataset('Sage (9 residents)', path.join(__dirname, 'prefs-sage-9.csv'));
const solegriaData = analyzeDataset('Solegria (5 residents)', path.join(__dirname, 'prefs-solegria-5.csv'));

// Cross-dataset comparison
console.log('\n' + '='.repeat(70));
console.log('CROSS-DATASET COMPARISON');
console.log('='.repeat(70));

console.log('\n--- Summary ---');
console.log('Dataset\t\t\tnumItems\teffectiveP\tratio (E/n)');
const sageRatio = (sageData.effectiveP / sageData.numItems).toFixed(3);
const solRatio = (solegriaData.effectiveP / solegriaData.numItems).toFixed(3);
console.log(`Sage\t\t\t${sageData.numItems}\t\t${sageData.effectiveP.toFixed(1)}\t\t${sageRatio}`);
console.log(`Solegria\t\t${solegriaData.numItems}\t\t${solegriaData.effectiveP.toFixed(1)}\t\t${solRatio}`);

console.log('\n--- Finding Common α ---');
console.log('Goal: Find α that gives reasonable damping for both datasets');
console.log('');

// Test various α values across both datasets
const testAlphas = [ 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0 ];
console.log('α\t\tSage d\t\tSolegria d\tDifference');
testAlphas.forEach((alpha) => {
  const dSage = computeDampingNew(sageData.effectiveP, sageData.numItems, alpha);
  const dSolegria = computeDampingNew(solegriaData.effectiveP, solegriaData.numItems, alpha);
  const diff = Math.abs(dSage - dSolegria);
  console.log(`${alpha.toFixed(1)}\t\t${dSage.toFixed(3)}\t\t${dSolegria.toFixed(3)}\t\t${diff.toFixed(3)}`);
});

console.log('\n--- Participation Context ---');
console.log('Sage: 6 of 9 residents active (67% participation)');
console.log('Solegria: 2 of 5 residents active (40% participation), highly skewed');

console.log('\n--- Recommendation ---');
console.log('');
console.log('Design goal: ~1/3 participation → d ≈ 0.6-0.7 (fairly expressive)');
console.log('');
console.log('Sage has good participation (67%) → should get d ≈ 0.7-0.8');
console.log('Solegria has lower/skewed participation → should get d ≈ 0.5-0.6');
console.log('');

// Find α that achieves these targets
const sageTarget = 0.75;
const solegriaTarget = 0.55;
const alphaSage = sageData.effectiveP * (1 - sageTarget) / (sageTarget * sageData.numItems);
const alphaSolegria = solegriaData.effectiveP * (1 - solegriaTarget) / (solegriaTarget * solegriaData.numItems);

console.log(`α for Sage d=${sageTarget}: ${alphaSage.toFixed(3)}`);
console.log(`α for Solegria d=${solegriaTarget}: ${alphaSolegria.toFixed(3)}`);
console.log(`Average: ${((alphaSage + alphaSolegria) / 2).toFixed(3)}`);
console.log('');

// Final recommendation
const recommendedAlpha = 0.5;
const finalDSage = computeDampingNew(sageData.effectiveP, sageData.numItems, recommendedAlpha);
const finalDSolegria = computeDampingNew(solegriaData.effectiveP, solegriaData.numItems, recommendedAlpha);

console.log(`With α = ${recommendedAlpha}:`);
console.log(`  Sage: d = ${finalDSage.toFixed(3)} (${sageData.numActiveResidents} active residents)`);
console.log(`  Solegria: d = ${finalDSolegria.toFixed(3)} (${solegriaData.numActiveResidents} active residents, skewed)`);

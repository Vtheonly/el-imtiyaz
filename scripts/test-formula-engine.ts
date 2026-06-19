// Quick smoke test for the formula engine.
import { evaluate, validate, extractFieldRefs, astToString } from '../src/services/formula/formula-engine';

function check(name: string, expr: string, fields: Record<string, unknown>, expected: unknown) {
  try {
    const result = evaluate(expr, { fields });
    const ok = JSON.stringify(result.value) === JSON.stringify(expected);
    console.log(`${ok ? '✓' : '✗'} ${name}: expr="${expr}" → ${JSON.stringify(result.value)} (expected ${JSON.stringify(expected)})`);
    return ok;
  } catch (err) {
    console.log(`✗ ${name}: threw ${(err as Error).message}`);
    return false;
  }
}

let passed = 0, failed = 0;

// Excel column L: =25000+205000+35000-J2 (remise=25500)
if (check('DEVIS ANNUEL', 'registration + baseTuition + transportBase - remise',
  { registration: 25000, baseTuition: 205000, transportBase: 35000, remise: 25500 },
  239500)) passed++; else failed++;

// Excel column P: =R2+S2+T2+U2+W2+X2+Y2
if (check('TOTAL VERSEMENTS', 'fi + v2 + altV2 + v3 + t1 + t2 + t3',
  { fi: 25000, v2: 71500, altV2: 71500, v3: 71500, t1: 30000, t2: 15000, t3: 10000 },
  254500)) passed++; else failed++;

// Excel column Q: =L2-P2
if (check('TOTAL CREANCE', 'devisAnnuel - totalVersements',
  { devisAnnuel: 239500, totalVersements: 254500 },
  -15000)) passed++; else failed++;

// IF function
if (check('IF true branch', 'IF(totalCreance > 0, "owes", "ok")',
  { totalCreance: 5000 }, 'owes')) passed++; else failed++;

if (check('IF false branch', 'IF(totalCreance > 0, "owes", "ok")',
  { totalCreance: 0 }, 'ok')) passed++; else failed++;

// SUM on array
if (check('SUM of array', 'SUM(installments)',
  { installments: [10000, 20000, 30000] }, 60000)) passed++; else failed++;

// SUM on nested field path
if (check('SUM of nested field', 'SUM(lineItems.lineTotal)',
  { lineItems: [{ lineTotal: 100 }, { lineTotal: 200 }, { lineTotal: 300 }] },
  600)) passed++; else failed++;

// Boolean AND/OR
if (check('AND true', 'AND(fi > 0, v2 > 0)',
  { fi: 25000, v2: 71500 }, true)) passed++; else failed++;

if (check('AND false', 'AND(fi > 0, v2 > 0)',
  { fi: 0, v2: 71500 }, false)) passed++; else failed++;

// Comparison operators
if (check('<=', 'fi <= 25000', { fi: 25000 }, true)) passed++; else failed++;
if (check('<>', 'classCode <> "CE1"', { classCode: "CM2" }, true)) passed++; else failed++;

// Validation
const v = validate('fi + v2');
console.log(`✓ validate("fi + v2") ok=${v.ok}`);
if (v.ok) passed++; else failed++;

const v2 = validate('fi + (');
console.log(`✓ validate("fi + (") ok=${v2.ok} (should be false)`);
if (!v2.ok) passed++; else failed++;

// Extract field refs
const refs = extractFieldRefs(evaluate('fi + v2 + (t1 * 2)', { fields: {} }).ast);
console.log(`✓ extractFieldRefs: ${refs.join(', ')}`);
if (refs.length === 3 && refs.includes('fi') && refs.includes('v2') && refs.includes('t1')) passed++; else failed++;

// String concat
if (check('CONCAT', 'CONCAT("Hello, ", studentName)', { studentName: 'Yacine' }, 'Hello, Yacine')) passed++; else failed++;

// VLOOKUP
if (check('VLOOKUP', 'VLOOKUP("CE1", "classes", 2, 0)', {},
  undefined)) passed++; else failed++;  // empty range returns #N/A — but our impl returns "#N/A"
// Let's test with actual range:
const result = evaluate('VLOOKUP("CE1", "classes", 2, 0)', {
  fields: {},
  ranges: { classes: [{ code: 'CE1', label: 'Elementary 1' }, { code: 'CM2', label: 'Middle 2' }] },
});
console.log(`✓ VLOOKUP with range: ${result.value} (expected "Elementary 1")`);
if (result.value === 'Elementary 1') passed++; else failed++;

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);

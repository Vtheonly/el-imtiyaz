/**
 * Screenshot harness v2 — uses Sidebar NavLink clicks for navigation
 * (window.history.pushState doesn't trigger React Router v6).
 *
 * Launches the built El-Imtiyaz Electron app via Playwright's _electron API,
 * clicks through every sidebar item + every Excel-migration feature, and
 * captures screenshots to /home/z/my-project/screenshots/.
 */

const { _electron: electron } = require('playwright-core');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const ROOT = '/home/z/my-project/build';
const SHOTS_DIR = '/home/z/my-project/screenshots';
const ENTRY = path.join(ROOT, 'dist-main', 'main', 'index.js');

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

// ── Xvfb management ───────────────────────────────────────────────
let xvfbProc = null;

function startXvfb() {
  return new Promise((resolve, reject) => {
    const display = ':99';
    // Use a taller screen so we can capture the full Student Profile page
    // (which has many sections: KPIs, info card, timeline, ledger, audit comments).
    xvfbProc = spawn('Xvfb', [display, '-screen', '0', '1600x1400x24', '-ac'], {
      stdio: 'ignore',
      detached: false,
    });
    xvfbProc.on('error', reject);
    setTimeout(() => {
      process.env.DISPLAY = display;
      console.log(`[harness] Xvfb started on ${display}`);
      resolve();
    }, 1500);
  });
}

function stopXvfb() {
  if (xvfbProc) {
    try { xvfbProc.kill(); } catch {}
    xvfbProc = null;
  }
}

async function clickNav(window, labelText) {
  // Sidebar uses NavLink with text content matching the label.
  // Try multiple selectors to be robust.
  const selectors = [
    `nav a:has-text("${labelText}")`,
    `aside a:has-text("${labelText}")`,
    `a[href]:has-text("${labelText}")`,
    `nav :text("${labelText}")`,
  ];
  for (const sel of selectors) {
    try {
      const link = window.locator(sel).first();
      if (await link.count() > 0) {
        await link.click({ timeout: 5000 });
        await window.waitForTimeout(1500);
        return true;
      }
    } catch {}
  }
  console.log(`[harness] ! Nav link "${labelText}" not found via any selector`);
  return false;
}

async function clickButton(window, labelText) {
  const selectors = [
    `button:has-text("${labelText}")`,
    `[role="button"]:has-text("${labelText}")`,
  ];
  for (const sel of selectors) {
    try {
      const btn = window.locator(sel).first();
      if (await btn.count() > 0) {
        await btn.click({ timeout: 5000 });
        await window.waitForTimeout(1500);
        return true;
      }
    } catch {}
  }
  return false;
}

async function main() {
  await startXvfb();

  console.log('[harness] Launching Electron app…');
  const app = await electron.launch({
    executablePath: path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron'),
    args: [ENTRY, '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
    timeout: 30000,
  });

  console.log('[harness] Electron launched. Waiting for first window…');
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded', { timeout: 30000 });
  console.log('[harness] First window loaded.');

  // Wait for the loading screen to finish
  console.log('[harness] Waiting for Dashboard…');
  try {
    await window.waitForSelector('text=Dashboard', { timeout: 30000 });
  } catch {}
  await window.waitForTimeout(3000);  // Charts + KPIs to render

  // ── 1. Dashboard ──────────────────────────────────────────────
  console.log('[harness] Screenshot 01-dashboard');
  await window.screenshot({ path: path.join(SHOTS_DIR, '01-dashboard.png') });

  // ── 2. Students ───────────────────────────────────────────────
  if (await clickNav(window, 'Students')) {
    console.log('[harness] Screenshot 02-students');
    await window.screenshot({ path: path.join(SHOTS_DIR, '02-students.png') });
  }

  // ── 3. Payments (default view) ────────────────────────────────
  if (await clickNav(window, 'Payments')) {
    console.log('[harness] Screenshot 03-payments-default');
    await window.screenshot({ path: path.join(SHOTS_DIR, '03-payments-default.png') });

    // Toggle to Ledger (Excel) view
    console.log('[harness] Switching Payments → Ledger (Excel) view…');
    const ledgerBtn = window.locator('button:has-text("Ledger (Excel)")').first();
    if (await ledgerBtn.count() > 0) {
      await ledgerBtn.click();
      await window.waitForTimeout(2500);
      console.log('[harness] Screenshot 09-payments-ledger-view');
      await window.screenshot({ path: path.join(SHOTS_DIR, '09-payments-ledger-view.png') });
    }
  }

  // ── 4. Fee Templates (with Excel-migration controls) ──────────
  if (await clickNav(window, 'Fee Templates')) {
    await window.waitForTimeout(1500);
    console.log('[harness] Screenshot 04-fee-templates');
    await window.screenshot({ path: path.join(SHOTS_DIR, '04-fee-templates.png') });

    // 4a. Fee Schedule modal
    console.log('[harness] Opening Fee Schedule modal…');
    if (await clickButton(window, 'Fee Schedule')) {
      await window.waitForTimeout(1500);
      console.log('[harness] Screenshot 10-fee-schedule-modal');
      await window.screenshot({ path: path.join(SHOTS_DIR, '10-fee-schedule-modal.png') });
      await clickButton(window, 'Cancel');
      await window.waitForTimeout(500);
    }

    // 4b. New Quote Block modal
    console.log('[harness] Opening New Quote Block modal…');
    if (await clickButton(window, 'New Quote Block')) {
      await window.waitForTimeout(1500);
      console.log('[harness] Screenshot 11-new-quote-block-modal');
      await window.screenshot({ path: path.join(SHOTS_DIR, '11-new-quote-block-modal.png') });
      await clickButton(window, 'Cancel');
      await window.waitForTimeout(500);
    }

    // 4c. Formula Library modal
    console.log('[harness] Opening Formula Library modal…');
    if (await clickButton(window, 'Formula Library')) {
      await window.waitForTimeout(2000);
      console.log('[harness] Screenshot 12-formula-library-modal');
      await window.screenshot({ path: path.join(SHOTS_DIR, '12-formula-library-modal.png') });

      // Test an expression
      const testInput = window.locator('input[placeholder="fi + v2 + altV2 + v3 + t1 + t2 + t3"]').first();
      if (await testInput.count() > 0) {
        await testInput.fill('fi + v2 + t1');
        await window.waitForTimeout(500);
        const evalBtn = window.locator('button:has-text("Evaluate")').first();
        if (await evalBtn.count() > 0) {
          await evalBtn.click();
          await window.waitForTimeout(1500);
          console.log('[harness] Screenshot 13-formula-library-test-result');
          await window.screenshot({ path: path.join(SHOTS_DIR, '13-formula-library-test-result.png') });
        }
      }
      await clickButton(window, 'Close');
      await window.waitForTimeout(500);
    }
  }

  // ── 5. Reports (Excel Reconciliation panel) ───────────────────
  if (await clickNav(window, 'Reports')) {
    await window.waitForTimeout(2500);
    console.log('[harness] Screenshot 05-reports');
    await window.screenshot({ path: path.join(SHOTS_DIR, '05-reports.png') });
    console.log('[harness] Screenshot 18-reports-excel-reconciliation');
    await window.screenshot({ path: path.join(SHOTS_DIR, '18-reports-excel-reconciliation.png') });
  }

  // ── 6. Debt Dashboard ─────────────────────────────────────────
  if (await clickNav(window, 'Debt Dashboard')) {
    await window.waitForTimeout(1500);
    console.log('[harness] Screenshot 06-debt-dashboard');
    await window.screenshot({ path: path.join(SHOTS_DIR, '06-debt-dashboard.png') });
  }

  // ── 7. Workflows (verify new Excel-migration nodes) ───────────
  if (await clickNav(window, 'Workflows')) {
    await window.waitForTimeout(2000);
    console.log('[harness] Screenshot 07-workflows-list');
    await window.screenshot({ path: path.join(SHOTS_DIR, '07-workflows-list.png') });

    // If there's a workflow, click Edit on the first row. Otherwise click New.
    const editBtn = window.locator('button[title="Edit"], button:has-text("Edit")').first();
    if (await editBtn.count() > 0) {
      console.log('[harness] Clicking Edit on first workflow…');
      await editBtn.click();
      await window.waitForTimeout(4000);
      console.log('[harness] Screenshot 15-workflow-editor');
      await window.screenshot({ path: path.join(SHOTS_DIR, '15-workflow-editor.png') });

      // Search for "formula" in palette
      const paletteSearch = window.locator('input[type="text"], input[type="search"]').first();
      if (await paletteSearch.count() > 0) {
        await paletteSearch.fill('formula');
        await window.waitForTimeout(1000);
        console.log('[harness] Screenshot 16-workflow-palette-formula-nodes');
        await window.screenshot({ path: path.join(SHOTS_DIR, '16-workflow-palette-formula-nodes.png') });

        await paletteSearch.fill('ledger');
        await window.waitForTimeout(1000);
        console.log('[harness] Screenshot 17-workflow-palette-ledger-nodes');
        await window.screenshot({ path: path.join(SHOTS_DIR, '17-workflow-palette-ledger-nodes.png') });

        await paletteSearch.fill('quote');
        await window.waitForTimeout(1000);
        console.log('[harness] Screenshot 18-workflow-palette-quote-nodes');
        await window.screenshot({ path: path.join(SHOTS_DIR, '18-workflow-palette-quote-nodes.png') });
      }
    } else {
      // Create a workflow via the modal, then navigate to its editor.
      console.log('[harness] No workflows. Creating one via modal…');
      const newBtn = window.locator('button:has-text("New"), button:has-text("Create")').first();
      if (await newBtn.count() > 0) {
        await newBtn.click();
        await window.waitForTimeout(1500);
        console.log('[harness] Screenshot 15-workflows-create-modal');
        await window.screenshot({ path: path.join(SHOTS_DIR, '15-workflows-create-modal.png') });

        // Fill in the form
        const nameInput = window.locator('input[placeholder="e.g. Overdue Payment Reminder"]').first();
        if (await nameInput.count() > 0) {
          await nameInput.fill('Excel Migration Test Workflow');
        }
        const descInput = window.locator('textarea[placeholder="What does this workflow do?"]').first();
        if (await descInput.count() > 0) {
          await descInput.fill('Tests the new Excel-migration workflow nodes');
        }
        // Click Create (button is disabled until name is non-empty)
        const createBtn = window.locator('button:has-text("Create")').first();
        if (await createBtn.count() > 0) {
          // Wait for it to become enabled
          await window.waitForTimeout(500);
          await createBtn.click({ timeout: 5000 });
          await window.waitForTimeout(5000);
          console.log('[harness] Screenshot 15b-workflow-editor (after create)');
          await window.screenshot({ path: path.join(SHOTS_DIR, '15b-workflow-editor.png') });

          // Search palette for formula / ledger / quote nodes
          const paletteSearch = window.locator('input[type="text"], input[type="search"]').first();
          if (await paletteSearch.count() > 0) {
            // Clear then type
            await paletteSearch.fill('');
            await window.waitForTimeout(500);
            await paletteSearch.fill('formula');
            await window.waitForTimeout(1500);
            console.log('[harness] Screenshot 16-workflow-palette-formula-nodes');
            await window.screenshot({ path: path.join(SHOTS_DIR, '16-workflow-palette-formula-nodes.png') });

            await paletteSearch.fill('ledger');
            await window.waitForTimeout(1500);
            console.log('[harness] Screenshot 17-workflow-palette-ledger-nodes');
            await window.screenshot({ path: path.join(SHOTS_DIR, '17-workflow-palette-ledger-nodes.png') });

            await paletteSearch.fill('quote');
            await window.waitForTimeout(1500);
            console.log('[harness] Screenshot 18-workflow-palette-quote-nodes');
            await window.screenshot({ path: path.join(SHOTS_DIR, '18-workflow-palette-quote-nodes.png') });

            // Clear search to show full palette
            await paletteSearch.fill('');
            await window.waitForTimeout(1500);
            console.log('[harness] Screenshot 19-workflow-palette-full');
            await window.screenshot({ path: path.join(SHOTS_DIR, '19-workflow-palette-full.png') });
          }
        }
      }
    }
  }

  // ── 8. Student Profile (Excel Ledger Entry section) ───────────
  if (await clickNav(window, 'Students')) {
    await window.waitForTimeout(1500);
    const firstRow = window.locator('tbody tr').first();
    if (await firstRow.count() > 0) {
      console.log('[harness] Clicking first student row…');
      await firstRow.click();
      // Wait for the profile + ledger data to load. The page fires 4 IPC
      // calls in parallel; ledger:by-student is the one we care about.
      await window.waitForTimeout(3000);
      // Wait for the Excel Ledger Entry card to be fully populated
      // (look for the "REMISE (col J)" KPI tile which only renders when
      // the ledger entry is loaded).
      try {
        await window.waitForSelector('text=REMISE', { timeout: 10000 });
        console.log('[harness] ✓ Excel Ledger Entry card populated.');
      } catch {
        console.log('[harness] ! Excel Ledger Entry card may not be populated.');
      }
      // Wait an extra moment for the audit comments to load and render.
      try {
        await window.waitForSelector('text=Audit Comments', { timeout: 10000 });
        console.log('[harness] ✓ Audit Comments section rendered.');
      } catch {
        console.log('[harness] ! Audit Comments section not yet rendered — waiting more.');
        await window.waitForTimeout(3000);
      }
      console.log('[harness] Screenshot 19-student-profile-excel-ledger');
      await window.screenshot({ path: path.join(SHOTS_DIR, '19-student-profile-excel-ledger.png'), fullPage: true });
    }
  }

  console.log('\n[harness] Done. Closing app.');
  await app.close();
  stopXvfb();
  process.exit(0);
}

main().catch((err) => {
  console.error('[harness] FATAL:', err);
  stopXvfb();
  process.exit(1);
});

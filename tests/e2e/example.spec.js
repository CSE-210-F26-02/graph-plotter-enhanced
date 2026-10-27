// @ts-check
import { test, expect } from '@playwright/test';

/**
 * ### Scenario 1

**User**: Bob is a small business owner who wants to visualize his sales data.
**Goal**: Bob wants to create a visual representation of his sales data to better understand trends and make informed business decisions.
**Steps**:
1. Bob opens the graphing application on his desktop.
2. Bob inputs his sales data points into the application.
3. Bob selects a line graph to visualize the trends over time.
4. Bob customizes the graph by adding labels, titles, and choosing appropriate colors.
5. Bob interacts with the graph by zooming in on specific time periods and hovering over data points for details.
6. Bob saves and exports the graph to share with his team.

**Outcome**: Bob successfully creates a visual representation of his sales data, which helps him and his team understand trends and make informed business decisions.

**Expectations**: Bob expects the graphing application to be user-friendly, responsive, and capable of accurately representing his sales data in a visually appealing manner.
 */

const localUrl = 'http://localhost:5173';

test('Scenario 1: Bob visualizes his sales data', async ({ page }) => {
  await page.goto(localUrl);

  // Expect a h1 title to be visible.
  await expect(page.getByRole('heading', { level: 1, name: 'Graph Plotter' })).toBeVisible();
  // Expect a p with class="sub" and with text "Welcome to Graph Plotter"
  await expect(page.locator('p.sub')).toHaveText('Load a CSV, pick two numeric columns, and plot a scatter or line graph. Runs fully in your browser.');
  // Expect a file input element that accepts csv files.
  await expect(page.locator('input[type="file"][accept=".csv"]')).toBeVisible();

  // Expects a div that has a class named "settings-panel"
  await expect(page.locator('div.settings-panel')).toBeVisible();
  const settingsPanel = page.locator('div.settings-panel');
  await expect(settingsPanel.locator('.settings-row')).toHaveCount(3);

  // Verify each of the following labels is present
  await expect(settingsPanel.getByLabel('X axis')).toBeVisible();
  await expect(settingsPanel.getByLabel('Y axis')).toBeVisible();
  await expect(settingsPanel.getByLabel('Title', { exact: true })).toBeVisible();
  await expect(settingsPanel.getByLabel('Title size')).toBeVisible();
  await expect(settingsPanel.getByLabel('X label', { exact: true })).toBeVisible();
  await expect(settingsPanel.getByLabel('Y label', { exact: true })).toBeVisible();
  await expect(settingsPanel.getByLabel('X/Y label size')).toBeVisible();

  // Expects a chart container div to be visible.
  await expect(page.locator('div.chart-container')).toBeVisible();
  const chartContainer = page.locator('div.chart-container');

  // Expect a control wrapper inside the chart container, since the there's no tittle so download button is separate.
  await expect(chartContainer.locator('div.control-wrapper')).toBeVisible();

  // Expects a custom-chart element to be visible.
  await expect(chartContainer.locator('custom-chart')).toBeVisible();

  // Load a file
  const fileInput = page.locator('input[type="file"][accept=".csv"]');
  await fileInput.setInputFiles('tests/e2e/data/sample-business-data.csv');

  // Switch to line chart view.
  await page.getByRole('button', { name: 'Line' }).click();

  // Use playwright screenshot regression checker to capture a baseline screenshot of the chart container.
  await expect(chartContainer).toHaveScreenshot('chart-container.png', {
    maxDiffPixels: 20,
    threshold: 0.2,
    animations: 'disabled'
  });
});

// test('get started link', async ({ page }) => {
//   await page.goto('https://playwright.dev/');

//   // Click the get started link.
//   await page.getByRole('link', { name: 'Get started' }).click();

//   // Expects page to have a heading with the name of Installation.
//   await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
// });

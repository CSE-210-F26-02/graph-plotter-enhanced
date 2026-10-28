// @ts-check
import { test, expect } from '@playwright/test'

const localUrl = 'http://localhost:5173'

// Define type for page object
/**
 * @typedef {import('@playwright/test').Page} Page
 */

/**
 * Checks if the page has loaded successfully by verifying the presence of key elements.
 * @param {Page} page - The Playwright page object.
 * @returns {Promise<{settingsPanel: import('@playwright/test').Locator, chartContainer: import('@playwright/test').Locator}>} - Returns the settings panel and chart container locators.
 */
const checkIfPageLoadedSuccessfully = async (page ) => {
        // Expect a h1 title to be visible.
    await expect(
        page.getByRole('heading', { level: 1, name: 'Graph Plotter' })
    ).toBeVisible()
    // Expect a p with class="sub" and with text "Welcome to Graph Plotter"
    await expect(page.locator('p.sub')).toHaveText(
        'Load a CSV, pick two numeric columns, and plot a scatter or line graph. Runs fully in your browser.'
    )
    // Expect a file input element that accepts csv files.
    await expect(
        page.locator('input[type="file"][accept=".csv"]')
    ).toBeVisible()

    // Expects a div that has a class named "settings-panel"
    await expect(page.locator('div.settings-panel')).toBeVisible()
    const settingsPanel = page.locator('div.settings-panel')
    await expect(settingsPanel.locator('.settings-row')).toHaveCount(3)

    // Verify each of the following labels is present
    await expect(settingsPanel.getByLabel('X axis')).toBeVisible()
    await expect(settingsPanel.getByLabel('Y axis')).toBeVisible()
    await expect(
        settingsPanel.getByLabel('Title', { exact: true })
    ).toBeVisible()
    await expect(settingsPanel.getByLabel('Title size')).toBeVisible()
    await expect(
        settingsPanel.getByLabel('X label', { exact: true })
    ).toBeVisible()
    await expect(
        settingsPanel.getByLabel('Y label', { exact: true })
    ).toBeVisible()
    await expect(settingsPanel.getByLabel('X/Y label size')).toBeVisible()

    // Expects a chart container div to be visible.
    await expect(page.locator('div.chart-container')).toBeVisible()
    const chartContainer = page.locator('div.chart-container')

    // Expect a control wrapper inside the chart container, since the there's no tittle so download button is separate.
    await expect(chartContainer.locator('div.control-wrapper')).toBeVisible()

    // Expects a custom-chart element to be visible.
    await expect(chartContainer.locator('custom-chart')).toBeVisible()

    return { settingsPanel, chartContainer }
}

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

test('Scenario 1: Bob visualizes his sales data', async ({ page }) => {
    await page.goto(localUrl)

    const pageSize = page.viewportSize()
    const isMobile = pageSize && pageSize.width !== undefined && pageSize.width < 768

    let { settingsPanel, chartContainer } = await checkIfPageLoadedSuccessfully(page)

    // Load a file
    const fileInput = page.locator('input[type="file"][accept=".csv"]')
    await fileInput.setInputFiles('tests/e2e/data/sample-business-data.csv')

    // Add a title to the chart.
    await page.getByLabel('Title', { exact: true }).fill('Sales Data')
    await page.getByLabel('Title size').fill('24')
    // Add an X label to the chart.
    await page.getByLabel('X label', { exact: true }).fill('Year')
    await page.getByLabel('X/Y label size').fill('18')
    // Add a Y label to the chart.
    await page.getByLabel('Y label', { exact: true }).fill('Sales Amount (USD)')

    // Switch to line chart view.
    await page.getByRole('button', { name: 'Line' }).click()

    // Click "Generate graph" button.
    await page.getByRole('button', { name: 'Generate graph' }).click()

    // Expect a control wrapper inside the chart container to be hidden, since the there's a title now.
    await isMobile ? expect(chartContainer.locator('div.control-wrapper')).toBeVisible() : expect(chartContainer.locator('div.control-wrapper')).toBeHidden()

    // Use playwright screenshot regression checker to capture a baseline screenshot of the chart container.
    await expect(chartContainer).toHaveScreenshot('sales-year-over-year.png', {
        maxDiffPixels: 20,
        threshold: 0.2,
        animations: 'disabled'
    })

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save PNG' }).click()
    const download = await downloadPromise
    const downloadPath = await download.path()
    expect(downloadPath).not.toBeNull()
    
    await page.waitForTimeout(2000)
    
    // // Tooltip test: Hover over a data point and check if the tooltip appears with the correct information.
    const canvas = chartContainer.locator('custom-chart canvas')
    // Look for a tooltip div with id="tooltip" inside the chart container.
    const tooltip = chartContainer.locator('#tooltip')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas bounding box not found')
    // Move the mouse to a specific point on the canvas where a data point is expected to be.
    const isChrome = page.context().browser()?.browserType().name() === 'chromium'
    const x = box.x + (isMobile ? isChrome ? 248.00 : 243.00 : 720) // Adjust these values based on the expected data point location
    const y = box.y +  (isMobile ? isChrome ? 67.70 : 65.70 : 70.1431884765625)
    await isMobile ? page.touchscreen.tap(x, y) : page.mouse.move(x, y)

    await expect(tooltip).toBeVisible()
    await expect(tooltip).toHaveText("Year: 2019, Sales Amount: 3900")

    // Test switching columns: Change the X and Y axis selections and verify that the graph updates accordingly.
    await settingsPanel.getByLabel('X axis').selectOption('Year')
    await settingsPanel.getByLabel('Y axis').selectOption('Profit')
    await page.getByRole('button', { name: 'Generate graph' }).click()
    await expect(chartContainer).toHaveScreenshot(
        'sales-amount-vs-year.png',
        {
            maxDiffPixels: 20,
            threshold: 0.2,
            animations: 'disabled'
        }
    )
})

/** End of test scenario */

/** 
 * ### Scenario 2

**User**: Jooahn is a student who wants to analyze his study habits and performance.
**Goal**: Jooahn wants to create visualizations of his study time and grades to identify patterns and improve his academic performance.
**Steps**:
1. Jooahn opens the graphing application on his tablet.
2. Jooahn inputs his study hours and corresponding grades into the application.
3. Jooahn selects a scatter plot to visualize the correlation between study time and performance.
4. Jooahn customizes the graph by adding labels, titles, and choosing appropriate colors.
5. Jooahn interacts with the graph by zooming in on specific data points and hovering over points for details.
6. Jooahn saves and exports the graph to review his study habits over time.

**Outcome**: Jooahn successfully creates visual representations of his study habits and performance, which helps him identify patterns and make informed decisions to improve his academic results.
**Expectations**: Jooahn expects the graphing application to be easy to use, accurate, and capable of effectively representing his study data to aid in his academic improvement.
 */

test('Scenario 2: Jooahn analyzes study habits and performance', async ({ page }) => {
    await page.goto(localUrl)

    const pageSize = page.viewportSize()
    const isMobile = pageSize && pageSize.width !== undefined && pageSize.width < 768

    let { chartContainer } = await checkIfPageLoadedSuccessfully(page)

    // Load a file
    const fileInput = page.locator('input[type="file"][accept=".csv"]')
    await fileInput.setInputFiles('tests/e2e/data/sample-study-data.csv')

    // Add a title to the chart.
    await page.getByLabel('Title', { exact: true }).fill('Study Hours vs Grade')
    await page.getByLabel('Title size').fill('24')
    // Add an X label to the chart.
    await page
        .getByLabel('X label', { exact: true })
        .fill('Number Of Study Hours')
    await page.getByLabel('X/Y label size').fill('18')
    // Add a Y label to the chart.
    await page.getByLabel('Y label', { exact: true }).fill('Grade')

    // Switch to Scatter chart view.
    await page.getByRole('button', { name: 'Scatter' }).click()

    // Click "Generate graph" button.
    await page.getByRole('button', { name: 'Generate graph' }).click()

    // Expect a control wrapper inside the chart container to be hidden, since the there's a title now.
    await isMobile ? expect(chartContainer.locator('div.control-wrapper')).toBeVisible() : expect(chartContainer.locator('div.control-wrapper')).toBeHidden()

    // Use playwright screenshot regression checker to capture a baseline screenshot of the chart container.
    await expect(chartContainer).toHaveScreenshot('study-hours-vs-grade.png', {
        maxDiffPixels: 20,
        threshold: 0.2,
        animations: 'disabled'
    })

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save PNG' }).click()
    const download = await downloadPromise
    const downloadPath = await download.path()
    expect(downloadPath).not.toBeNull()
})

/** End of test scenario */

/**
 * ### Scenario 3

**User**: Aster is a biologist who needs to present her findings to her team.
**Goal**: Aster wants to create clear and informative visualizations of her research data to effectively communicate her results.
**Steps**:
1. Aster opens the graphing application on her laptop.
2. Aster inputs her experimental data points into the application.
3. Aster selects a scatter plot to visualize the relationship between variables.
4. Aster customizes the graph by adding labels, titles, and choosing appropriate colors.
5. Aster interacts with the graph by zooming in on specific data clusters and hovering over points for details.
6. Aster saves and exports the graph to include in her presentation.

**Outcome**: Aster successfully creates visual representations of her research data, which helps her team understand the findings and facilitates discussion during the presentation.
**Expectations**: Aster expects the graphing application to be intuitive, flexible, and capable of accurately representing her research data in a clear and informative manner.
*/

test('Scenario 3: Aster creates a scatter plot for her research data', async ({ page }) => {
    await page.goto(localUrl)

    const pageSize = page.viewportSize()
    const isMobile = pageSize && pageSize.width !== undefined && pageSize.width < 768

    let { chartContainer } = await checkIfPageLoadedSuccessfully(page)

    // Load a file
    const fileInput = page.locator('input[type="file"][accept=".csv"]')
    await fileInput.setInputFiles('tests/e2e/data/sample-biology-data.csv')

    // Add a title to the chart.
    await page
        .getByLabel('Title', { exact: true })
        .fill('DNA Growth in a Controlled Laboratory Environment')
    await page.getByLabel('Title size').fill('24')
    // Add an X label to the chart.
    await page.getByLabel('X label', { exact: true }).fill('Time (hours)')
    await page.getByLabel('X/Y label size').fill('18')
    // Add a Y label to the chart.
    await page
        .getByLabel('Y label', { exact: true })
        .fill('DNA Concentration in Solution (M)')

    // Switch to Scatter chart view.
    await page.getByRole('button', { name: 'Scatter' }).click()

    // Click "Generate graph" button.
    await page.getByRole('button', { name: 'Generate graph' }).click()

    // Expect a control wrapper inside the chart container to be hidden, since the there's a title now.
    await isMobile ? expect(chartContainer.locator('div.control-wrapper')).toBeVisible() : expect(chartContainer.locator('div.control-wrapper')).toBeHidden()

    // Use playwright screenshot regression checker to capture a baseline screenshot of the chart container.
    await expect(chartContainer).toHaveScreenshot('dna-growth-in-lab.png', {
        maxDiffPixels: 20,
        threshold: 0.2,
        animations: 'disabled'
    })

    // Zoom in on the chart.
    // Get canvas component inside the custom-chart element.
    const canvas = chartContainer.locator('custom-chart canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas bounding box not found')
    // Click on area then use scroll wheel to zoom in.
    await canvas.scrollIntoViewIfNeeded()
    const x = box.x + 150
    const y = box.y + box.height - 30
    await page.mouse.move(x, y)
    await page.keyboard.down('Control');
    for (let i = 0; i < 20; i++) {
        await canvas.dispatchEvent('wheel', { deltaY: -100, clientX: x, clientY: y });
    }
    await page.keyboard.up('Control');
    // Wait for a short period to allow the zoom action to take effect.
    await page.waitForTimeout(500)
    // Check that the chart container has changed after zooming in by taking a screenshot and comparing it to the previous one.
    await expect(chartContainer).toHaveScreenshot(
        'dna-growth-in-lab-zoomed.png',
        {
            maxDiffPixels: 20,
            threshold: 0.2,
            animations: 'disabled'
        }
    )

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save PNG' }).click()
    const download = await downloadPromise
    const downloadPath = await download.path()
    expect(downloadPath).not.toBeNull()
})

/** End of test scenario */

/** Scenario 4
 * ### Scenario 4

**User**: Sammy is bit older and not the most tech-savvy, but he wants to visualize his personal fitness data.
**Goal**: Sammy wants to create visualizations of his fitness progress over time to stay motivated and track his achievements, even if he is unfamiliar with technical terms like CSV or Excel file formats.
**Steps**:
1. Sammy opens the graphing application on his iPad.
2. Sammy inputs his fitness data points, but not exactly sure what a CSV is, so he tries a Excel file
3. Application should provide a helpful error message and guide him saying file format is not supported and suggest him to convert it to CSV.
4. Sammy converts his Excel file to CSV and successfully inputs his fitness data points into the application however the file is missing a header row, so the application should provide a helpful error message and guide him to add a header row to the CSV file.
5. Sammy adds a header row to his CSV file 
6. Sammy's CSV stores the numbers as strings, so the application should provide a helpful error message and guide him to convert the numbers to numeric format.
7. Sammy converts the numbers in his CSV file to numeric format and successfully inputs his fitness data points into the application.
8. Sammy selects a line graph to visualize his fitness progress over time.

**Outcome**: Sammy successfully creates visual representations of his fitness progress, which helps him stay motivated and track his achievements over time.
**Expectations**: Sammy expects the graphing application to be user-friendly, provide helpful error messages and guidance for file format issues, and accurately represent his fitness data in a visually appealing manner.
*/

test('Scenario 4: Sammy visualizes his fitness progress over time', async ({ page }) => {
    await page.goto(localUrl)

    const pageSize = page.viewportSize()
    const isMobile = pageSize && pageSize.width !== undefined && pageSize.width < 768

    let { chartContainer } = await checkIfPageLoadedSuccessfully(page)

    // Try to load a non-CSV file (Excel file) and expect an error message.
    const fileInput = page.locator('input[type="file"][accept=".csv"]')
    await fileInput.setInputFiles('tests/e2e/data/sample-fitness-data-bad.xlsx')
    await expect(page.locator('#err')).toHaveText(
        'Wrong file type. Please upload a CSV file.'
    )
    
    // Load a CSV file with broken header row and expect an error message.
    await fileInput.setInputFiles('tests/e2e/data/sample-fitness-data-bad-broken-headers.csv')
    await expect(page.locator('#err')).toHaveText(
        'Unclosed quote in CSV header line: "Days Since Fitness Training,Steps,Calories Burned,Distance (km)'
    )
    
    // Load a CSV file with non-numeric data and expect an error message.
    await fileInput.setInputFiles('tests/e2e/data/sample-fitness-data-bad-data-are-not-numbers.csv')
    await expect(page.locator('#err')).toHaveText(
        'Need at least two numeric columns.'
    )

    // Load a valid CSV file.
    await fileInput.setInputFiles('tests/e2e/data/sample-fitness-data.csv')

    // Add a title to the chart.
    await page.getByLabel('Title', { exact: true }).fill('Fitness Progress')
    await page.getByLabel('Title size').fill('24')
    // Add an X label to the chart.
    await page.getByLabel('X label', { exact: true }).fill('Days Since Fitness Training')
    await page.getByLabel('X/Y label size').fill('18')
    // Add a Y label to the chart.
    await page.getByLabel('Y label', { exact: true }).fill('Steps')

    // Switch to Line chart view.
    await page.getByRole('button', { name: 'Line' }).click()

    // Click "Generate graph" button.
    await page.getByRole('button', { name: 'Generate graph' }).click()

    // Expect a control wrapper inside the chart container to be hidden, since the there's a title now.
    await isMobile ? expect(chartContainer.locator('div.control-wrapper')).toBeVisible() : expect(chartContainer.locator('div.control-wrapper')).toBeHidden()

    // Use playwright screenshot regression checker to capture a baseline screenshot of the chart container.
    await expect(chartContainer).toHaveScreenshot('fitness-progress.png', {
        maxDiffPixels: 20,
        threshold: 0.2,
        animations: 'disabled'
    })

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save PNG' }).click()
    const download = await downloadPromise
    const downloadPath = await download.path()
    expect(downloadPath).not.toBeNull()
})

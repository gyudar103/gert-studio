// A local-browser check with every non-loopback HTTP request blocked.
const {chromium, expect} = require('../../frontend/node_modules/@playwright/test');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1000}});
    const external = [];
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === process.env.E2E_BASE_URL) return route.continue();
      external.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto(process.env.E2E_BASE_URL);
    await page.getByRole('button', {name:'Load demo',exact:true}).click();
    await page.getByRole('button', {name:'Validate',exact:true}).click();
    await expect(page.getByText('Model valid', {exact:true})).toBeVisible();
    await page.getByRole('button', {name:'Run Simulation',exact:true}).click();
    await expect(page.getByRole('heading', {name:'Completion time · terminal runs only'})).toBeVisible();
    expect(external).toEqual([]);
    await page.screenshot({path:path.resolve(__dirname,'../../dist/windows-browser.png'),fullPage:true});
    console.log('Packaged browser demo passed with all non-local HTTP traffic blocked.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

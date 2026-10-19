import {test,expect,type Page,type Locator,type TestInfo} from '@playwright/test';
import {resolve} from 'node:path';
import {exactJSON} from '../src/api';
import {PROGRESS_KEY} from '../src/tutorial/progress';
const lessonNav=(page:Page)=>page.getByRole('navigation',{name:'Tutorial lessons'});
const practice=(page:Page)=>page.locator('.tutorial-practice');
async function capture(page:Page,info:TestInfo,name:string) {
  const path=process.env.TUTORIAL_SCREENSHOT_DIR?resolve(process.env.TUTORIAL_SCREENSHOT_DIR,name):info.outputPath(name);
  await page.screenshot({path,fullPage:true});
}
async function learn(page:Page,title:RegExp) {
  await page.getByRole('button',{name:'Learn / Tutorial',exact:true}).click();
  await lessonNav(page).getByRole('button',{name:title}).click();
}
async function start(page:Page) {await page.getByRole('button',{name:'Load practice starting point',exact:true}).click();}
async function download(root:Page|Locator,page:Page) {
  const event=page.waitForEvent('download');await root.getByRole('button',{name:'Export JSON',exact:true}).click();
  const stream=await(await event).createReadStream();let text='';for await(const c of stream!) text+=c.toString();return text;
}
async function upload(root:Locator,text:string) {
  await root.getByLabel('Import model JSON').setInputFiles({name:'tutorial.json',mimeType:'application/json',buffer:Buffer.from(text)});
  await expect(root.getByRole('button',{name:'Validate',exact:true})).toBeEnabled();
}
async function completeInspection(root:Locator) {
  await root.locator('[data-control="activity-inspection"]').click();
  await root.getByLabel(/Distribution/).selectOption('fixed');await root.getByLabel(/^value/).fill('2');
  const probabilities=root.getByLabel(/^Probability/);await probabilities.first().fill('1');
}
async function simulate(root:Locator) {
  await root.getByRole('button',{name:'Run Simulation',exact:true}).click();
  await expect(root.getByRole('heading',{name:'Completion time · terminal runs only'})).toBeVisible();
}
test('project, settings, selection, results and undo survive tutorial work and keyboard shortcuts',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto('/');await page.getByRole('button',{name:'Load demo',exact:true}).click();
  await page.getByLabel('Project name',{exact:true}).fill('Original unsaved project');
  await page.getByLabel(/^Seed/).fill('123456789012345678901234567890');
  await page.getByRole('navigation',{name:'Network outline'}).getByRole('button',{name:/Mechanical design/}).click();
  await simulate(page.locator('.app'));
  const before=await download(page,page);
  await learn(page,/2\. Build/);await start(page);const root=practice(page);
  await expect.poll(()=>page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return ids.filter((id,i)=>ids.indexOf(id)!==i);})).toEqual([]);
  await completeInspection(root);await root.getByLabel('Project name',{exact:true}).fill('Practice only');
  await page.keyboard.press('Control+z');
  await lessonNav(page).getByRole('button',{name:/7\. Add the quality/}).click();
  await expect(root.getByLabel('Project name',{exact:true})).toHaveValue('Quality-control tutorial');
  // Navigating lessons never replaces practice; a declined load also preserves it.
  await root.getByLabel('Project name',{exact:true}).fill('Keep this practice');
  page.removeAllListeners('dialog');page.once('dialog',d=>d.dismiss());await start(page);
  await expect(root.getByLabel('Project name',{exact:true})).toHaveValue('Keep this practice');
  await page.getByRole('button',{name:'Return to my project'}).click();
  await expect(page.getByRole('button',{name:'Learn / Tutorial'})).toBeFocused();
  const original=page.locator('[aria-label="My project workspace"]');
  await expect(original.getByLabel('Project name',{exact:true})).toHaveValue('Original unsaved project');
  await expect(original.getByLabel(/^Seed/)).toHaveValue('123456789012345678901234567890');
  await expect(original.getByLabel(/Activity ID/)).toHaveValue('mechanical');
  expect(await download(original,page)).toBe(before);
  await original.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(original.getByLabel('Project name',{exact:true})).not.toHaveValue('Original unsaved project');
  expect(errors).toEqual([]);
});

test('draft guidance uses real selected documentation, null-preserving export/import and backend readiness',async({page})=>{
  page.on('dialog',d=>d.accept());await page.goto('/');await learn(page,/16\. Keep unknown/);await start(page);const root=practice(page);
  await page.getByRole('button',{name:'Find control: Duration documentation',exact:true}).click();
  await expect(root.getByLabel(/Activity ID/)).toHaveValue('inspection');
  const rationale=root.getByLabel('Duration documentation: Rationale',{exact:true});
  await expect(rationale).toBeVisible();await rationale.fill('Missing measurement; leave estimates unknown');
  await root.getByLabel('Duration documentation: Certainty level',{exact:true}).fill('Low — no timing data');
  await root.getByRole('button',{name:'Validate',exact:true}).click();
  await expect(root.getByText('Draft valid · Complete missing inputs before simulation',{exact:true})).toBeVisible();
  const text=await download(root,page),model=JSON.parse(text);
  expect(model.activities[1].duration).toBeNull();expect(model.activities[1].outcomes.map((o:any)=>o.probability)).toEqual([null,null]);
  expect(model.file_type).toBeUndefined();expect(model.activities[1].duration_documentation.certainty).toBe('Low — no timing data');
  await upload(root,text);await expect(root.getByRole('button',{name:'Run Simulation',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Check exercise',exact:true}).click();
  await expect(page.getByText('Backend-validated draft restored with explicit unknowns. Simulation remains blocked.')).toBeVisible();
  await root.locator('[data-control="activity-inspection"]').click();await root.getByLabel(/Distribution/).selectOption('uniform');await root.getByLabel(/^min/).fill('0');
  const partial=await download(root,page);expect(JSON.parse(partial).activities[1].duration).toEqual({type:'uniform',min:'0',max:null});
  await upload(root,partial);await root.locator('[data-control="activity-inspection"]').click();
  await expect(root.getByLabel(/^min/)).toHaveValue('0');await expect(root.getByLabel(/^max/)).toHaveValue('');
  await root.getByLabel(/Distribution/).selectOption('fixed');await root.getByLabel(/^value/).fill('0');
  const p=root.getByLabel(/^Probability/);await p.nth(0).fill('0.80');await expect(p.nth(1)).toHaveValue('');
  await p.nth(1).fill('0.10');await expect(p.nth(0)).toHaveValue('0.80'); // last unknown does not normalize
  await root.getByRole('button',{name:'Validate',exact:true}).click();await expect(root.getByText('Model needs attention',{exact:true})).toBeVisible();
  await p.nth(1).fill('0.20');await expect(p.nth(0)).toHaveValue('0.8'); // complete-set editing now adjusts siblings
  await simulate(root);expect(JSON.parse(await download(root,page)).simulation_result.summary.terminal_duration.mean).toBe('0');
});

test('documentation round trip stays in selected Properties and preserves seeded results',async({page},info)=>{
  page.on('dialog',d=>d.accept());await page.goto('/');await learn(page,/15\. Write documentation/);await start(page);const root=practice(page);
  await root.getByLabel(/^Realizations/).fill('10');await simulate(root);
  const original=exactJSON.parse(await download(root,page)).simulation_result;
  await page.getByRole('button',{name:'Find control: Node documentation',exact:true}).click();
  for(const field of ['Comments','Assumptions','Certainty level','Explanation']) await root.getByLabel(`Node documentation: ${field}`,{exact:true}).fill(`Node ${field}: teaching assumption`);
  await expect(root.getByRole('region',{name:'Network canvas'})).not.toContainText('Node Comments: teaching assumption');
  await expect(root.getByText('No simulation results yet.',{exact:true})).toBeVisible();
  await root.getByRole('button',{name:'Activity: Inspection',exact:true}).click();
  await page.getByRole('button',{name:'Find control: Duration documentation',exact:true}).click();
  for(const field of ['Rationale','Assumptions','Sources / references','Certainty level']) await root.getByLabel(`Duration documentation: ${field}`,{exact:true}).fill(`Duration ${field}: explicit example`);
  await page.getByRole('button',{name:'Find control: Outcome documentation',exact:true}).click();
  await root.getByLabel('Outcome 1 documentation: Rationale',{exact:true}).fill('Pass is a teaching assumption');
  await root.getByRole('button',{name:'Validate',exact:true}).click();await expect(root.getByText('Model valid',{exact:true})).toBeVisible();
  const notes=await download(root,page);await upload(root,notes);await page.getByRole('button',{name:'Check exercise',exact:true}).click();
  await expect(page.getByText('Node, duration and outcome notes restored from canonical model JSON. Notes do not change simulation mathematics.')).toBeVisible();
  await page.getByRole('button',{name:'Find control: Node documentation',exact:true}).click();
  await expect(root.getByLabel('Node documentation: Certainty level',{exact:true})).toHaveValue('Node Certainty level: teaching assumption');
  await root.getByRole('button',{name:'Activity: Inspection',exact:true}).click();await simulate(root);
  expect(exactJSON.parse(await download(root,page)).simulation_result).toEqual(original);
  await page.getByRole('button',{name:'Find control: Duration documentation',exact:true}).click();
  await expect(root.getByLabel('Duration documentation: Rationale',{exact:true})).toBeVisible();
  await capture(page,info,'tutorial-documentation.png');
});

test('snapshot restores without simulation, panel resizing preserves results, and edits/Validate/Undo invalidate them',async({page},info)=>{
  page.on('dialog',d=>d.accept());await page.goto('/');await learn(page,/4\. Save models/);await start(page);const root=practice(page);
  await completeInspection(root);await root.getByLabel(/^Realizations/).fill('10');
  let requests=0;page.on('request',req=>{if(req.url().endsWith('/api/simulate')) requests++;});
  await simulate(root);const snapshot=await download(root,page);expect(exactJSON.parse(snapshot).file_type).toBe('gert-studio-simulation-snapshot');
  await upload(root,snapshot);await expect(root.getByText('Imported saved results · No simulation was rerun.',{exact:true})).toBeVisible();expect(requests).toBe(1);
  await page.getByRole('button',{name:'Check exercise',exact:true}).click();await expect(page.getByText(/A versioned snapshot restored/)).toBeVisible();
  const separator=root.getByRole('separator',{name:'Resize properties panel',exact:true});await separator.focus();await separator.press('ArrowLeft');
  expect(await download(root,page)).toBe(snapshot);
  await root.getByRole('button',{name:'Validate',exact:true}).click();await expect(root.getByText('Model valid',{exact:true})).toBeVisible();
  await root.getByRole('tab',{name:'Simulation results',exact:true}).click();await expect(root.getByText('No simulation results yet.',{exact:true})).toBeVisible();
  await simulate(root);await root.getByLabel(/^Seed/).fill('43');await expect(root.getByText('No simulation results yet.',{exact:true})).toBeVisible();
  await simulate(root);await root.locator('[data-control="activity-inspection"]').click();await root.getByLabel(/Activity label/).fill('Edited inspection');
  await root.getByRole('button',{name:'Undo',exact:true}).click();await expect(root.getByText('No simulation results yet.',{exact:true})).toBeVisible();
  await simulate(root);await capture(page,info,'tutorial-desktop.png');
});

test('uncertainty and replay checkpoints require their real experiments; progress survives a refresh separately',async({page})=>{
  page.on('dialog',d=>d.accept());await page.goto('/');await learn(page,/8\. Read results/);await start(page);const root=practice(page);
  await root.getByLabel(/^Realizations/).fill('10');await simulate(root);await page.getByRole('button',{name:'Check exercise',exact:true}).click();
  await expect(page.getByText(/Inspect the single-run case first/)).toBeVisible();
  await root.getByLabel(/^Realizations/).fill('1');await simulate(root);
  await root.getByText('Completion-time uncertainty',{exact:true}).click();await expect(root.locator('.completion-results').getByText('Sample SD (ddof=1)',{exact:true})).toBeVisible();
  await root.getByLabel(/^Realizations/).fill('10');await simulate(root);await page.getByRole('button',{name:'Check exercise',exact:true}).click();
  await expect(page.getByText(/Ten terminal samples/)).toBeVisible();
  await lessonNav(page).getByRole('button',{name:/9\. Reproduce/}).click();await start(page);
  await simulate(root);await page.getByRole('button',{name:'Check exercise',exact:true}).click();await expect(page.getByText(/complete backend reports must match exactly/)).toBeVisible();
  await simulate(root);await page.getByRole('button',{name:'Check exercise',exact:true}).click();await expect(page.getByText(/fresh backend simulation satisfy/)).toBeVisible();
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),PROGRESS_KEY);expect(saved.completed).toEqual(expect.arrayContaining(['lesson-11','lesson-12']));expect(Object.keys(saved).sort()).toEqual(['completed','version']);
  await page.reload();await page.getByRole('button',{name:'Learn / Tutorial',exact:true}).click();
  await expect(page.getByText('2 of 22 lessons completed',{exact:true})).toBeVisible();await expect(page.getByText(/Choose a practical lesson and load its starting point/)).toBeVisible();
});

test('narrow lesson layout, keyboard navigation, control focus and progress are usable',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Learn / Tutorial',exact:true}).click();
  const nav=lessonNav(page),first=nav.getByRole('button',{name:/Start here/});await first.focus();await first.press('ArrowDown');
  await expect(nav.getByRole('button',{name:/What changed/})).toBeFocused();await page.keyboard.press('End');await expect(nav.getByRole('button',{name:/References/})).toBeFocused();
  await page.keyboard.press('Home');await page.getByLabel('Mark reading complete').check();
  await nav.getByRole('button',{name:/16\. Keep unknown/}).click();await start(page);
  await page.getByRole('button',{name:'Find control: Duration documentation',exact:true}).click();
  await expect(practice(page).getByLabel('Duration documentation: Rationale',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button',{name:'Back to lesson',exact:true}).click();await page.getByRole('button',{name:'Show lesson text',exact:true}).click();
  await capture(page,info,'tutorial-narrow.png');
});

test('rework and cutoff guided checkpoints distinguish theoretical benchmarks from actual sampled results',async({page})=>{
  page.on('dialog',d=>d.accept());await page.goto('/');await learn(page,/7\. Add the quality/);await start(page);const root=practice(page);
  await page.getByRole('button',{name:'Find control: Outcome probabilities',exact:true}).click();
  await expect(root.getByLabel(/^Probability/).first()).toBeFocused();
  await root.getByLabel(/Distribution/).selectOption('fixed');await root.getByLabel(/^value/).fill('2');
  await root.getByLabel(/^Probability/).nth(0).fill('0.80');await root.getByLabel(/^Probability/).nth(1).fill('0.20');
  await page.getByRole('button',{name:'Check exercise',exact:true}).click();await expect(page.getByText(/Validate the current practice model/)).toBeVisible();
  await simulate(root);await page.getByRole('button',{name:'Check exercise',exact:true}).click();
  await expect(page.getByText(/Unlimited theoretical mean 3.25/)).toBeVisible();
  await page.getByRole('button',{name:'Practice horizon 7 cutoff experiment',exact:true}).click();
  await root.getByLabel(/^Max simulation time/).fill('7');await simulate(root);await page.getByRole('button',{name:'Check exercise',exact:true}).click();
  await expect(page.getByText(/Theoretical acceptance 0.96, cutoff 0.04/)).toBeVisible();
  const r=exactJSON.parse(await download(root,page)).simulation_result;
  expect(r.runs.some((run:any)=>run.status==='terminal'&&run.last_processed_time==='7')).toBe(true);
  expect(r.summary.statuses.cutoff_time.count).toBeGreaterThan(0);
});

test('tutorial opens and simulates offline through the production assets',async({page})=>{
  const external:string[]=[],errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(!['127.0.0.1','localhost'].includes(url.hostname)) {external.push(url.href);return route.abort();}
    return route.continue();
  });
  await page.goto('/');await page.getByLabel('Project name',{exact:true}).fill('Offline unsaved project');
  await learn(page,/3\. Run and check/);await start(page);const root=practice(page);
  await completeInspection(root);await root.getByLabel(/^Realizations/).fill('10');await simulate(root);
  await page.getByRole('button',{name:'Check exercise',exact:true}).click();
  await expect(page.getByText(/fresh backend simulation satisfy/)).toBeVisible();
  await lessonNav(page).getByRole('button',{name:/0\. Get GERT Studio/}).click();
  const release=page.getByRole('link',{name:'GERT Studio 0.2.0 Windows preview release',exact:true});
  await expect(release).toHaveAttribute('target','_blank');await expect(release).toHaveAttribute('rel','noopener noreferrer');
  await page.getByRole('button',{name:'Return to my project',exact:true}).click();
  await expect(page.locator('[aria-label="My project workspace"]').getByLabel('Project name',{exact:true})).toHaveValue('Offline unsaved project');
  expect(external).toEqual([]);expect(errors).toEqual([]);
});

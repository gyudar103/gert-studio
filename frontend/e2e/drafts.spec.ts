import {test,expect,type Page} from '@playwright/test';

async function exported(page:Page) {
  const event=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export JSON',exact:true}).click();
  const stream=await(await event).createReadStream();
  let text='';for await(const chunk of stream!) text+=chunk.toString();
  return text;
}

test('create documented draft, export/import nulls, complete inputs, simulate and undo',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto('/');
  await page.getByRole('button',{name:'+ Item',exact:true}).click();
  await page.getByLabel('Item label',{exact:true}).fill('Request');
  await page.getByRole('button',{name:'+ Start',exact:true}).click();
  await page.getByRole('button',{name:'+ Add initial inventory item',exact:true}).click();
  await page.getByRole('group',{name:'Initial inventory',exact:true}).getByLabel(/Quantity 1/).fill('1');
  await page.getByRole('button',{name:'+ Terminal',exact:true}).click();
  await page.getByRole('button',{name:'Fit View',exact:true}).click();
  // The actual canvas click opens the existing properties panel.
  await page.locator('[data-id="n:0"] strong').click();
  await expect(page.getByLabel(/Node ID/)).toHaveValue('start_1');
  await page.getByText('Node documentation',{exact:true}).click();
  await page.getByLabel('Node documentation: Comments',{exact:true}).fill('Trial request queue');
  await page.getByLabel('Node documentation: Assumptions',{exact:true}).fill('One request per trial');
  await page.getByLabel('Node documentation: Certainty level',{exact:true}).fill('Unverified');
  await page.getByLabel('Node documentation: Explanation',{exact:true}).fill('Pending observation');
  await expect(page.getByRole('region',{name:'Network canvas'})).not.toContainText('Trial request queue');

  await page.getByRole('button',{name:'+ Activity',exact:true}).click();
  await page.getByLabel(/Activity label/).fill('Process request');
  await page.getByRole('button',{name:'+ Add requirements item',exact:true}).click();
  await page.getByRole('group',{name:'Requirements',exact:true}).getByLabel(/Quantity 1/).fill('1');
  await page.getByLabel(/Target node/).selectOption('terminal_1');
  await expect(page.getByLabel(/Distribution/)).toHaveValue('');
  await page.getByText('Duration documentation',{exact:true}).click();
  await page.getByLabel('Duration documentation: Rationale',{exact:true}).fill('Awaiting a timed trial');
  await page.getByLabel('Duration documentation: Sources / references',{exact:true}).fill('Trial notebook 12');
  await page.getByText('Outcome 1 documentation',{exact:true}).click();
  await page.getByLabel('Outcome 1 documentation: Rationale',{exact:true}).fill('Pending completion data');
  await page.getByLabel('Outcome 1 documentation: Certainty level',{exact:true}).fill('Unknown');
  await expect(page.getByRole('button',{name:'Run Simulation',exact:true})).toBeDisabled();
  await expect(page.locator('[data-id="a:0"]')).toContainText('Incomplete');
  await page.getByRole('button',{name:'Validate',exact:true}).click();
  await expect(page.getByText('Draft valid · Complete missing inputs before simulation',{exact:true})).toBeVisible();
  const first=await exported(page),model=JSON.parse(first);
  expect(model.activities[0].duration).toBeNull();
  expect(model.activities[0].outcomes[0].probability).toBeNull();
  expect(model.nodes[0].documentation.comments).toBe('Trial request queue');
  expect(model.activities[0].duration_documentation.references).toBe('Trial notebook 12');
  expect(model.activities[0].outcomes[0].documentation.certainty).toBe('Unknown');
  await page.getByLabel('Import model JSON').setInputFiles({name:'draft.json',mimeType:'application/json',buffer:Buffer.from(first)});
  await expect(page.getByText('Draft valid · Complete missing inputs before simulation',{exact:true})).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  expect(JSON.parse(await exported(page))).toEqual(model);

  // React Flow's SVG text has pointer-events:none; the label background is its hit target.
  await page.getByRole('group',{name:'Edge from a:0 to n:1',exact:true}).locator('.react-flow__edge-textbg').click();
  await expect(page.locator('#outcome-editor-0')).toHaveClass(/focused/);
  await expect(page.getByLabel(/^Probability/)).toHaveValue('');

  // Node panel association links lead to activity details.
  await page.locator('[data-id="n:0"] strong').click();
  await page.getByRole('button',{name:'Activity: Process request',exact:true}).click();
  await expect(page.getByLabel('Duration documentation: Rationale',{exact:true})).toHaveValue('Awaiting a timed trial');
  await page.getByLabel(/Distribution/).selectOption('uniform');
  await page.getByLabel(/^min/).fill('0');
  const partial=JSON.parse(await exported(page));
  expect(partial.activities[0].duration).toEqual({type:'uniform',min:'0',max:null});
  await page.getByLabel('Import model JSON').setInputFiles({name:'partial.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(partial))});
  await expect(page.getByRole('button',{name:'Run Simulation',exact:true})).toBeDisabled();
  await page.locator('[data-id="a:0"] strong').click();
  await expect(page.getByLabel(/^min/)).toHaveValue('0');
  await expect(page.getByLabel(/^max/)).toHaveValue('');
  await page.getByLabel(/^max/).fill('0');
  await page.getByLabel(/^Probability/).fill('1');
  await page.getByLabel(/^Realizations/).fill('3');
  await page.getByLabel(/^Seed/).fill('42');
  await page.getByLabel(/^Max simulation time/).fill('10');
  await page.getByLabel(/^Max activity instances/).fill('10');
  await page.getByLabel(/^Max activity completions/).fill('10');
  await page.getByRole('button',{name:'Validate',exact:true}).click();
  await expect(page.getByText('Model valid',{exact:true})).toBeVisible();
  await expect(page.locator('[data-id="a:0"]')).not.toContainText('Incomplete');
  const response=page.waitForResponse(r=>r.url().endsWith('/api/simulate'));
  await page.getByRole('button',{name:'Run Simulation',exact:true}).click();
  const result=await(await response).json();
  expect(result.summary.terminal_duration.mean).toBe('0');
  await expect(page.getByText('3 realizations',{exact:true})).toBeVisible();
  // Undo a placeholder edit returns to known zero without losing notes.
  await page.getByLabel(/^max/).fill('');
  await expect(page.getByRole('button',{name:'Run Simulation',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await page.locator('[data-id="a:0"] strong').click();
  await expect(page.getByLabel(/^max/)).toHaveValue('0');
  await expect(page.getByLabel('Duration documentation: Sources / references',{exact:true})).toHaveValue('Trial notebook 12');
  await page.getByText('Duration documentation',{exact:true}).click();
  await page.getByLabel('Duration documentation: Rationale',{exact:true}).fill('Revised rationale');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await page.locator('[data-id="a:0"] strong').click();
  await expect(page.getByLabel('Duration documentation: Rationale',{exact:true})).toHaveValue('Awaiting a timed trial');
  await page.screenshot({path:'test-results/documented-draft-completed.png',fullPage:true});
  expect(errors).toEqual([]);
});

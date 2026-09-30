import {test,expect} from '@playwright/test';
import {demoWorkspace} from '../src/demo';

test('load demo → validate → simulate → export/import → reproduce results',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  let simulationRequests=0;page.on('request',request=>{if(request.url().endsWith('/api/simulate')) simulationRequests++;});
  await page.goto('/');
  await page.getByRole('button',{name:'Load demo',exact:true}).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(11);
  await expect(page.locator('.react-flow__edge')).toHaveCount(12);
  await page.getByRole('button',{name:'Validate',exact:true}).click();
  await expect(page.getByText('Model valid',{exact:true})).toBeVisible();
  const response=page.waitForResponse(r=>r.url().endsWith('/api/simulate'));
  await page.getByRole('button',{name:'Run Simulation',exact:true}).click();
  const original=await (await response).text();
  await expect(page.getByRole('heading',{name:'Completion time · terminal runs only'})).toBeVisible();
  await expect(page.getByText('100 realizations',{exact:true})).toBeVisible();
  await expect(page.getByText('20260914',{exact:true})).toBeVisible();
  const fullMean=JSON.parse(original).summary.terminal_duration.mean;
  const compactMean=String(Number(Number(fullMean).toPrecision(3)));
  const mean=page.locator('.metrics > div').filter({has:page.getByText('MEAN',{exact:true})}).getByRole('button');
  await expect(mean).toHaveText(compactMean);
  for(let i=0;i<3;i++) {
    await mean.click();await expect(mean).toHaveText(fullMean);await expect(mean).toHaveAttribute('aria-pressed','true');
    await mean.click();await expect(mean).toHaveText(compactMean);await expect(mean).toHaveAttribute('aria-pressed','false');
  }
  expect(simulationRequests).toBe(1);
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
  const downloadEvent=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export JSON',exact:true}).click();
  const download=await downloadEvent;
  const stream=await download.createReadStream();
  let exported='';for await(const chunk of stream!) exported+=chunk.toString();
  expect(JSON.parse(exported)).toEqual(demoWorkspace().model);
  page.on('dialog',dialog=>dialog.accept());
  await page.getByLabel('Import model JSON').setInputFiles({name:'demo.json',mimeType:'application/json',buffer:Buffer.from(exported)});
  await expect(page.getByText('Model valid',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Run Simulation',exact:true})).toBeEnabled();
  const repeat=page.waitForResponse(r=>r.url().endsWith('/api/simulate'));
  await page.getByRole('button',{name:'Run Simulation',exact:true}).click();
  expect(await(await repeat).text()).toBe(original);
  await expect(page.getByRole('columnheader',{name:'Unfinished',exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/demo-results.png',fullPage:true});
  expect(errors).toEqual([]);
});

test('rejects invalid imports without replacing the editor and preserves numeric tokens',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Load demo',exact:true}).click();
  const fixture=demoWorkspace().model;
  fixture.activities[0].duration={type:'fixed',value:'0.1000000000000000000001'};
  const text=JSON.stringify(fixture).replace('"value":"0.1000000000000000000001"','"value":0.1000000000000000000001');
  page.on('dialog',d=>d.accept());
  await page.getByLabel('Import model JSON').setInputFiles({name:'decimal.json',mimeType:'application/json',buffer:Buffer.from(text)});
  await expect(page.getByText('Model valid',{exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'Network outline'}).getByRole('button',{name:/Mechanical design/}).click();
  await expect(page.getByLabel(/^value/)).toHaveValue('0.1000000000000000000001');
  const request=page.waitForRequest(r=>r.url().endsWith('/api/models/validate'));
  await page.getByRole('button',{name:'Validate',exact:true}).click();
  expect((await request).postData()).toContain('"value":"0.1000000000000000000001"');
  await expect(page.getByRole('button',{name:'Validate',exact:true})).toBeEnabled();
  fixture.activities[3].outcomes[0].probability='0.7';
  await page.getByLabel('Import model JSON').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
  await expect(page.getByRole('alert')).toContainText('Import not loaded');
  await expect(page.getByText(/These diagnostics refer to the rejected import/)).toBeVisible();
  await expect(page.getByLabel(/^value/)).toHaveValue('0.1000000000000000000001');
  await page.getByLabel('Import model JSON').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{')});
  await expect(page.getByRole('alert')).toContainText('Cannot import JSON');
  await expect(page.getByLabel('Project name')).toHaveValue(fixture.project.name);
});

test('constructs a deterministic network through forms and canvas connections',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'+ Item',exact:true}).click();
  await page.getByLabel('Item label').fill('Prototype');
  await page.getByRole('button',{name:'+ Start',exact:true}).click();
  await page.getByRole('button',{name:'+ Add initial inventory item',exact:true}).click();
  const inventoryQuantity=page.getByRole('group',{name:'Initial inventory',exact:true})
    .getByRole('textbox',{name:/^Quantity 1(?:\s*\*)?$/});
  await expect(inventoryQuantity).toBeEditable();
  await expect(inventoryQuantity).toHaveAttribute('required','');
  await expect(inventoryQuantity).toHaveValue('');
  await inventoryQuantity.fill('0.1');
  await expect(inventoryQuantity).toHaveValue('0.1');
  await page.getByRole('button',{name:'+ Terminal',exact:true}).click();
  await page.getByRole('button',{name:'Fit View',exact:true}).click();
  const start=page.locator('[data-id="n:0"] .source');
  const end=page.locator('[data-id="n:1"] .target');
  await expect(start).toBeInViewport();await expect(end).toBeInViewport();
  const from=(await start.boundingBox())!,to=(await end.boundingBox())!;
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
  await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:20});await page.mouse.up();
  await expect(page.getByLabel(/Activity ID/)).toHaveValue('activity_1');
  await page.getByRole('button',{name:'+ Add requirements item',exact:true}).click();
  const requiredQuantity=page.getByRole('group',{name:'Requirements',exact:true})
    .getByRole('textbox',{name:/^Quantity 1(?:\s*\*)?$/});
  await expect(requiredQuantity).toHaveValue('');
  await requiredQuantity.fill('0.1');
  await expect(requiredQuantity).toHaveValue('0.1');
  await page.getByLabel(/Distribution/).selectOption('fixed');
  await page.getByLabel(/^value/).fill('0.3');
  await page.getByLabel('Probability',{exact:false}).fill('1');
  await page.getByLabel(/^Realizations/).fill('3');await page.getByLabel(/^Seed/).fill('42');
  await page.getByLabel(/^Max simulation time/).fill('10');await page.getByLabel(/^Max activity instances/).fill('10');await page.getByLabel(/^Max activity completions/).fill('10');
  await page.getByRole('button',{name:'Validate',exact:true}).click();await expect(page.getByText('Model valid',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Run Simulation',exact:true}).click();
  await expect(page.getByText('3 realizations',{exact:true})).toBeVisible();
  await expect(page.locator('.metrics').getByText('0.3',{exact:true})).toHaveCount(7);
});


test('drag is one undo action and probability edits undo atomically',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Load demo',exact:true}).click();
  const card=page.locator('.react-flow__node').first();
  const before=await card.getAttribute('style');
  const box=await card.boundingBox();
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  await page.mouse.down();await page.mouse.move(box!.x+box!.width/2+80,box!.y+box!.height/2+40,{steps:8});await page.mouse.up();
  await expect(card).not.toHaveAttribute('style',before!);
  await page.keyboard.press('Control+z');await expect(card).toHaveAttribute('style',before!);
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
  await page.getByRole('navigation',{name:'Network outline'}).getByRole('button',{name:/Test prototype/}).click();
  await page.getByLabel('Probability',{exact:false}).first().fill('0.6');
  await expect(page.getByLabel('Probability',{exact:false}).nth(1)).toHaveValue('0.3');
  await page.keyboard.press('Control+z');
  await page.getByRole('navigation',{name:'Network outline'}).getByRole('button',{name:/Test prototype/}).click();
  await expect(page.getByLabel('Probability',{exact:false}).first()).toHaveValue('0.8');
});


test('Cmd+Z restores an activity drag and sequential model edits',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Load demo',exact:true}).click();
  const card=page.locator('.react-flow__node[data-id="a:0"]');
  const before=await card.getAttribute('style');
  const box=(await card.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();await page.mouse.move(box.x+box.width/2+60,box.y+box.height/2+30,{steps:8});await page.mouse.up();
  await expect(card).not.toHaveAttribute('style',before!);
  await page.keyboard.press('Meta+z');await expect(card).toHaveAttribute('style',before!);
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'+ State',exact:true}).click();
  await page.getByRole('button',{name:'+ Activity',exact:true}).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(13);
  await page.keyboard.press('Meta+z');await expect(page.locator('.react-flow__node')).toHaveCount(12);
  await page.keyboard.press('Meta+z');await expect(page.locator('.react-flow__node')).toHaveCount(11);
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
});

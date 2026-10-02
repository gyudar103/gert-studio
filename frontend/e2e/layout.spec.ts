import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {demoWorkspace} from '../src/demo';

async function drag(page:Page,name:string,x:number,y:number) {
  const handle=page.getByRole('separator',{name});
  await handle.scrollIntoViewIfNeeded();
  const box=(await handle.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+x,box.y+box.height/2+y,{steps:5});await page.mouse.up();
}

test('all splitters drag, persist and reset without model/export/history changes',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Load demo',exact:true}).click();
  const sidebar=page.getByRole('separator',{name:'Resize model sidebar'}),properties=page.getByRole('separator',{name:'Resize properties panel'}),analysis=page.getByRole('separator',{name:'Resize analysis panel'});
  await drag(page,'Resize model sidebar',50,0);await expect(sidebar).toHaveAttribute('aria-valuenow','295');
  await drag(page,'Resize properties panel',-40,0);await expect(properties).toHaveAttribute('aria-valuenow','390');
  await drag(page,'Resize analysis panel',0,-50);await expect(analysis).toHaveAttribute('aria-valuenow','310');
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON',exact:true}).click();
  const stream=await(await downloadEvent).createReadStream();let text='';for await(const chunk of stream!) text+=chunk.toString();
  expect(JSON.parse(text)).toEqual(demoWorkspace().model);
  await page.getByRole('button',{name:'+ State',exact:true}).click();
  await sidebar.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Control+z');
  await expect(page.locator('.react-flow__node')).toHaveCount(11);await expect(sidebar).toHaveAttribute('aria-valuenow','305');
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
  await page.reload();await expect(sidebar).toHaveAttribute('aria-valuenow','305');await expect(properties).toHaveAttribute('aria-valuenow','390');await expect(analysis).toHaveAttribute('aria-valuenow','310');
  await page.getByRole('button',{name:'Reset layout'}).click();await expect(sidebar).toHaveAttribute('aria-valuenow','245');await expect(properties).toHaveAttribute('aria-valuenow','350');await expect(analysis).toHaveAttribute('aria-valuenow','260');
});

test('small windows retain usable dimensions and narrow layouts ignore desktop sizes',async({page})=>{
  await page.goto('/');
  await page.getByRole('separator',{name:'Resize model sidebar'}).press('End');
  await page.setViewportSize({width:920,height:650});
  await expect.poll(async()=>Math.round((await page.locator('.canvas-panel').boundingBox())!.width)).toBeGreaterThanOrEqual(360);
  expect((await page.locator('#model-panel').boundingBox())!.width).toBeGreaterThanOrEqual(180);
  expect((await page.locator('#properties-panel').boundingBox())!.width).toBeGreaterThanOrEqual(260);
  await page.getByRole('separator',{name:'Resize analysis panel'}).press('End');
  expect((await page.locator('.workspace').boundingBox())!.height).toBeGreaterThanOrEqual(440);
  await page.setViewportSize({width:390,height:844});await expect(page.getByRole('separator')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button',{name:'+ State',exact:true}).click();await expect(page.getByLabel('Node label')).toBeVisible();
  await page.setViewportSize({width:1440,height:1000});await expect(page.getByRole('separator')).toHaveCount(3);
});

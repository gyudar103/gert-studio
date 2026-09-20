import {beforeEach,expect,it,vi} from 'vitest';
import {importModel,exportModel} from './files';
import {demoWorkspace} from './demo';
import {exactJSON} from './api';

const fetchMock=vi.fn();
beforeEach(()=>{
  vi.stubGlobal('fetch',fetchMock);fetchMock.mockReset();
  fetchMock.mockResolvedValue({ok:true,status:200,text:async()=>' {"valid":true,"diagnostics":[]}'});
});

it('round trips all model fields, decimal text and cycles without layout or settings',async()=>{
  const workspace=demoWorkspace();
  workspace.model.activities[0].duration={type:'fixed',value:'0.1000000000000000000001'};
  const text=exportModel(workspace);
  const imported=await importModel(text);
  expect(imported.workspace.model).toEqual(workspace.model);
  expect(text).not.toContain('layout');expect(text).not.toContain('max_simulation_time');
  expect(imported.workspace.layout.nodes).toHaveLength(workspace.model.nodes.length);
});

it('preserves raw JSON decimals, trailing zeros and exponents before API validation',async()=>{
  const source=exportModel(demoWorkspace()).replace('"2"','0.10000000000000000000001').replace('"3"','1e400').replace('"5"','5.00');
  const imported=await importModel(source);
  expect(fetchMock.mock.calls[0][1].body).toContain('0.10000000000000000000001');
  expect(fetchMock.mock.calls[0][1].body).toContain('1e400');
  expect(imported.workspace.model.activities[0].duration).toEqual({type:'triangular',min:'0.10000000000000000000001',mode:'1e400',max:'5.00'});
});

it.each(['{','{"id":1,"id":2}','{"id":1,"id":1}','{"id":NaN}','{"id":01}'])('rejects malformed or duplicate JSON before contacting the backend: %s',async text=>{
  await expect(importModel(text)).rejects.toThrow('Cannot import JSON');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('preserves escaped text and legal special item IDs during imports',async()=>{
  const workspace=demoWorkspace();
  workspace.model.project.name='Model 1e400 with "quoted 0.1" and \\ 2';
  workspace.model.nodes[0]={id:'start',label:'Start',type:'start',initial_inventory:Object.fromEntries([['__proto__','0.1'],['constructor','2']])};
  const imported=await importModel(exportModel(workspace));
  expect(imported.workspace.model).toEqual(workspace.model);
  expect(Object.getPrototypeOf((imported.workspace.model.nodes[0] as {initial_inventory:object}).initial_inventory)).toBeNull();
});

it('does not coerce nonnumeric model fields before authoritative validation',async()=>{
  fetchMock.mockResolvedValue({ok:false,status:422,text:async()=>' {"valid":false,"diagnostics":[{"severity":"error","code":"schema","message":"ID must be a string","path":["project","id"]}]}'});
  const source=exportModel(demoWorkspace()).replace('"prototype-demo"','123');
  await expect(importModel(source)).rejects.toThrow('invalid model');
  expect(fetchMock.mock.calls[0][1].body).toBe(source);
});

it('rejects semantically invalid imports rather than returning a replacement workspace',async()=>{
  fetchMock.mockResolvedValue({ok:true,status:200,text:async()=>' {"valid":false,"diagnostics":[]}'});
  await expect(importModel(exportModel(demoWorkspace()))).rejects.toThrow('current model is unchanged');
});

it('separates optional imported UI metadata from mathematical fields',async()=>{
  const model={...demoWorkspace().model,ui_metadata:{x:42,other:'ignored layout'}};
  expect((await importModel(JSON.stringify(model))).workspace.model).not.toHaveProperty('ui_metadata');
});

it('keeps legal special IDs in response dictionaries without changing object prototypes',()=>{
  const result=exactJSON.parse('{"activities":{"constructor":{"started":1},"__proto__":{"started":2}}}');
  expect(Object.keys(result.activities)).toEqual(['constructor','__proto__']);
  expect(Object.getPrototypeOf(result.activities)).toBeNull();
  expect(exactJSON.stringify(result)).toContain('"__proto__"');
});

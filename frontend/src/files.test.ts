import {beforeEach,expect,it,vi} from 'vitest';
import {importModel,exportModel} from './files';
import {demoWorkspace} from './demo';
import {exactJSON} from './api';
import {snapshotFixture} from './test/snapshotFixture';

const fetchMock=vi.fn();
beforeEach(()=>{
  vi.stubGlobal('fetch',fetchMock);fetchMock.mockReset();
  fetchMock.mockResolvedValue({ok:true,status:200,text:async()=>' {"valid":true,"diagnostics":[]}'});
});

it('round trips all model fields, decimal text and cycles without layout or settings',async()=>{
  const workspace=demoWorkspace();
  workspace.model.activities[0].duration={type:'fixed',value:'0.1000000000000000000001'};
  const text=exportModel(workspace);
  expect(text).toBe(JSON.stringify(workspace.model,null,2)+'\n');
  const imported=await importModel(text);
  expect(imported.workspace.model).toEqual(workspace.model);
  expect(text).not.toContain('layout');expect(text).not.toContain('max_simulation_time');
  expect(imported.workspace.layout.nodes).toHaveLength(workspace.model.nodes.length);
});

it('round trips a versioned snapshot with exact actual settings, generated seed and every returned field',async()=>{
  const {workspace,result}=snapshotFixture();
  result.extra_reporting={value:'0.12345678901234567890123456789',count:900719925474099312345n};
  const text=exportModel(workspace,result);
  const envelope=exactJSON.parse(text);
  expect(envelope.file_type).toBe('gert-studio-simulation-snapshot');expect(envelope.file_version).toBe('0.1');
  expect(envelope.simulation_settings).toEqual(result.settings);
  expect(envelope.simulation_result).toEqual(result);
  const imported=await importModel(text);
  expect(imported.workspace.model).toEqual(workspace.model);expect(imported.result).toEqual(result);
  expect(imported.settings?.seed).toBe(String(result.root_seed));
  expect(imported.settings?.realizations).toBe('2');
  expect(fetchMock).toHaveBeenCalledTimes(1);expect(fetchMock.mock.calls[0][0]).toBe('/api/models/validate');
});

it.each(['"model"','"\\u006dodel"'])('validates original contained model lexemes/types with escaped keys and harmless metadata (%s)',async key=>{
  const {workspace,result}=snapshotFixture();
  let text=exportModel(workspace,result).replace('"model":',`${key}:`).replace('"min": "2"','"min": 0.100000000000000000000001').replace('"mode": "3"','"mode": 1e400');
  text=text.replace('{','{"metadata":"model",');
  const imported=await importModel(text);
  expect(fetchMock.mock.calls[0][1].body).toContain('"min": 0.100000000000000000000001');
  expect(fetchMock.mock.calls[0][1].body).toContain('"mode": 1e400');
  expect(imported.workspace.model.activities[0].duration).toMatchObject({min:'0.100000000000000000000001',mode:'1e400'});
});

it.each([
  ['version',(s:any)=>{s.file_version='2';}],
  ['missing settings',(s:any)=>{delete s.simulation_settings;}],
  ['unknown setting',(s:any)=>{s.simulation_settings.extra=1;}],
  ['string realization',(s:any)=>{s.simulation_settings.realizations='2';}],
  ['negative horizon',(s:any)=>{s.simulation_settings.max_simulation_time='-1';}],
  ['fractional limit',(s:any)=>{s.simulation_settings.max_activity_instances=1.5;}],
  ['mismatched settings',(s:any)=>{s.simulation_settings.realizations=3;}],
  ['seed',(s:any)=>{s.simulation_result.root_seed=42;}],
  ['missing report',(s:any)=>{delete s.simulation_result.summary.terminal_duration.p95;}],
  ['bad interval',(s:any)=>{s.simulation_result.summary.statuses.terminal.confidence_interval.lower='NaN';}],
  ['bad quantile',(s:any)=>{s.simulation_result.summary.terminal_duration.quantile_confidence_intervals.p5.upper={};}],
  ['run index',(s:any)=>{s.simulation_result.runs[0].realization_index=2;}],
  ['missing runs',(s:any)=>{s.simulation_result.runs=[];}],
  ['invalid lifecycle',(s:any)=>{s.simulation_result.summary.activities.test.started=9;}],
])('rejects malformed snapshot %s before model validation',async(_,mutate)=>{
  const {workspace,result}=snapshotFixture();const snapshot=exactJSON.parse(exportModel(workspace,result));
  mutate(snapshot);await expect(importModel(exactJSON.stringify(snapshot))).rejects.toThrow('Cannot import');
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([
  (r:any)=>{r.summary.activities.unknown=r.summary.activities.test;},
  (r:any)=>{r.summary.terminal_outcomes.success.outcome_code='wrong';},
  (r:any)=>{r.runs[0].inventory.unknown={};},
  (r:any)=>{r.runs[0].instances[0].outcome_id='unknown';},
  (r:any)=>{r.runs[0].status='cutoff_time';},
])('rejects incompatible saved model IDs or run counts after model validation',async mutate=>{
  const {workspace,result}=snapshotFixture();mutate(result);
  await expect(importModel(exportModel(workspace,result))).rejects.toThrow('do not match its model');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('rejects an invalid contained model through the established backend path without coercing IDs',async()=>{
  const {workspace,result}=snapshotFixture();
  fetchMock.mockResolvedValue({ok:false,status:422,text:async()=>'{"valid":false,"diagnostics":[]}'});
  const text=exportModel(workspace,result).replace('"prototype-demo"','123');
  await expect(importModel(text)).rejects.toThrow('invalid model');
  expect(fetchMock.mock.calls[0][1].body).toContain('"id": 123');
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

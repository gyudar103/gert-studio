import {test,expect,type APIRequestContext} from '@playwright/test';
import {inspectionModel,synchronizationModel,targetModel,tutorialSettings} from '../src/tutorial/exercises';
import type {Model,SimulationResult} from '../src/types';
import {exactJSON} from '../src/api';
async function run(request:APIRequestContext,model:Model,settings:Record<string,string|number>={}):Promise<SimulationResult> {
  const form=tutorialSettings();
  const response=await request.post('/api/simulate',{data:{model,settings:{...form,realizations:100,max_activity_completions:1000,max_activity_instances:1000,seed:20260930,...settings}}});
  expect(response.status()).toBe(200);return exactJSON.parse(await response.text());
}
test('tutorial deterministic/synchronization, inclusive limits, concurrency and exact quantity recipes use the real engine',async({request})=>{
  const base=inspectionModel();
  for(const n of [1,10]) {
    const r=await run(request,base,{realizations:n}),t=r.summary.terminal_duration;
    expect(r.runs.every(x=>x.status==='terminal'&&x.last_processed_time==='2')).toBe(true);
    expect(t.sample_size).toBe(n);expect(t.mean).toBe('2');expect(t.standard_deviation).toBe('0');
    expect(t.sample_standard_deviation).toBe(n===1?null:'0');expect(t.mean_standard_error).toBe(n===1?null:'0');
    if(n===1) expect(t.mean_confidence_interval).toBeNull();else expect(t.mean_confidence_interval).toMatchObject({method:'student_t',lower:'2',upper:'2'});
    expect(Number(r.summary.statuses.terminal.confidence_interval.lower)).toBeLessThan(1);
  }
  for(const [settings,status] of [[{max_simulation_time:'2'},'terminal'],[{max_simulation_time:'1'},'cutoff_time'],[{max_activity_completions:2},'terminal'],[{max_activity_completions:1},'cutoff_activity_count'],[{max_activity_instances:2},'terminal'],[{max_activity_instances:1},'cutoff_instance_count']] as const) {
    const r=await run(request,base,{realizations:1,...settings});expect(r.runs[0].status).toBe(status);
  }
  const concurrent=await run(request,inspectionModel('concurrency'),{realizations:3});
  for(const r of concurrent.runs) {expect(r.status).toBe('deadlock');expect(r.activities.inspection).toMatchObject({started:3,completed:3,cancelled:0});}
  expect(concurrent.summary.terminal_duration.sample_size).toBe(0);expect(concurrent.summary.terminal_duration.mean).toBeNull();
  const atomic=await run(request,inspectionModel('concurrency'),{realizations:1,max_activity_instances:2});
  expect(atomic.runs[0].status).toBe('cutoff_instance_count');expect(atomic.runs[0].activities.prepare.started).toBe(0);
  const sync=await run(request,synchronizationModel(),{realizations:3});expect(sync.runs.every(r=>r.last_processed_time==='6'&&r.status==='terminal')).toBe(true);
  const competition=synchronizationModel();competition.activities[1].requirements={mechanical_request:'1'};
  const ambiguous=await run(request,competition,{realizations:1});expect(ambiguous.runs[0].status).toBe('ambiguous_resource_competition');
  expect(ambiguous.runs[0].activities.mechanical.started).toBe(0);expect(ambiguous.runs[0].activities.software.started).toBe(0);
  const recipe=inspectionModel('concurrency');recipe.item_types=[{id:'bolt',label:'Bolt'},{id:'plate',label:'Plate'}];
  recipe.nodes=[{id:'start',label:'Start',type:'start',initial_inventory:{bolt:'9',plate:'3'}},{id:'processed',label:'Processed',type:'state'}];
  recipe.activities=[{...recipe.activities[1],source_node:'start',requirements:{bolt:'2',plate:'1'},outcomes:[{id:'done',label:'Done',probability:'1',target_node:'processed',produced_items:{}}]}];
  const quantity=await run(request,recipe,{realizations:1});expect(quantity.runs[0].activities.inspection.started).toBe(3);expect(quantity.runs[0].inventory.start).toEqual({bolt:'3',plate:'0'});
});
test('rework paths satisfy analytic identities; finite cutoffs and Beta-PERT stay sampled estimates',async({request})=>{
  const model=inspectionModel('rework'),r=await run(request,model,{realizations:1000});
  expect(r.summary.statuses.terminal.count).toBe(1000);
  for(const x of r.runs) {
    const failures=Number(x.activities.rework.started);expect(x.activities.inspection.started).toBe(failures+1);expect(x.last_processed_time).toBe(String(2+5*failures));
  }
  expect(Number(r.summary.terminal_duration.mean)).toBeCloseTo(3.25,0);
  expect(Number(r.summary.activities.inspection.mean_starts)).toBeCloseTo(1.25,1);expect(Number(r.summary.activities.rework.mean_starts)).toBeCloseTo(.25,1);
  const cutoff=await run(request,model,{realizations:1000,max_simulation_time:'7'});
  const terminals=cutoff.runs.filter(x=>x.status==='terminal');expect(terminals.some(x=>x.last_processed_time==='7')).toBe(true);
  expect(terminals.every(x=>['2','7'].includes(x.last_processed_time))).toBe(true);expect(cutoff.runs.every(x=>['terminal','cutoff_time'].includes(x.status))).toBe(true);
  // Five binomial standard errors around the analytic 0.96; no exact sampled fraction is promised.
  expect(Math.abs(Number(cutoff.summary.statuses.terminal.probability)-.96)).toBeLessThan(5*Math.sqrt(.96*.04/1000));
  expect(cutoff.summary.terminal_duration.sample_size).toBe(terminals.length);
  const beta=await run(request,targetModel('duration'),{realizations:1000});
  expect(Math.abs(Number(beta.summary.terminal_duration.mean)-13/6)).toBeLessThan(.1);
  const documented=structuredClone(model);documented.nodes[1].documentation={comments:'Buffer',assumptions:'Rework returns here',certainty:'Descriptive only',explanation:'Start cannot receive incoming flow'};
  documented.activities[1].duration_documentation={rationale:'Teaching example',references:'No measured data',certainty:'Low'};documented.activities[1].outcomes[0].documentation={rationale:'Assumed pass rate'};
  expect(await run(request,documented,{realizations:1000})).toEqual(r);
});
test('drafts validate without executing, and invalid known values still fail',async({request})=>{
  const draft=targetModel('draft');
  const valid=await request.post('/api/models/validate',{data:draft});expect(valid.status()).toBe(200);expect(await valid.json()).toMatchObject({valid:true,draft_valid:true,simulation_ready:false});
  const missing=await request.post('/api/simulate',{data:{model:draft,settings:{...tutorialSettings(),realizations:1,seed:42,max_activity_instances:100,max_activity_completions:100}}});
  expect(missing.status()).toBe(422);const details=await missing.json();expect(details.diagnostics.some((d:any)=>d.code==='missing_input')).toBe(true);
  draft.activities[1].duration={type:'triangular',min:'3',mode:null,max:'2'};draft.activities[1].outcomes[0].probability='1.2';
  const invalid=await request.post('/api/models/validate',{data:draft});expect((await invalid.json()).valid).toBe(false);
});

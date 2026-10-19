import BigNumber from 'bignumber.js';
import {demoWorkspace,demoSettings} from '../demo';
import type {Activity,Model,SettingsForm,SimulationResult,ValidationReport,Workspace} from '../types';

export interface EditorObservation {
  workspace:Workspace; settings:SettingsForm; report?:ValidationReport; result?:SimulationResult;
  importedResult:boolean; lastImport?:string; busy:boolean; replayVerified?:boolean; singletonSeen?:boolean;
}
export type ExerciseId='deterministic'|'snapshot'|'pass-fail'|'duration'|'rework'|'cutoff'|'uncertainty'|'replay'|'concurrency'|'synchronization'|'documentation'|'draft'|'demo';
export interface Exercise {id:ExerciseId; title:string; instruction:string; controls:string[]}
export const exercises:Record<ExerciseId,Exercise>={
  deterministic:{id:'deterministic',title:'A two-hour inspection',instruction:'Load the starting point. Select Inspection; choose Fixed, enter value 2 and Pass probability 1. Validate, then Run Simulation. You may also build the same network from New blank using Lesson 2.',controls:['activity-inspection','duration','probabilities','validate','simulate']},
  snapshot:{id:'snapshot',title:'Restore a real result snapshot',instruction:'Complete and run the two-hour Inspection. Export JSON, then Import JSON using that downloaded file. Accept replacement of this practice network. Saved results should return without another simulation.',controls:['simulate','export','import','analysis']},
  'pass-fail':{id:'pass-fail',title:'Alternative outcomes',instruction:'Inspection has two unknown probabilities. Enter Pass 0.80 and Fail 0.20, validate the total, then simulate. Filling the last unknown changes only that field. Subsequent complete-set edits adjust siblings proportionally.',controls:['activity-inspection','probabilities','validate','simulate']},
  duration:{id:'duration',title:'An explicit Beta-PERT estimate',instruction:'Select Inspection. Choose Beta-PERT and explicitly fill min 1, mode 2, max 4, lambda 4. Validate and simulate. Compare the sampled mean with theoretical 13/6; exact equality is not expected.',controls:['activity-inspection','duration','simulate','analysis']},
  rework:{id:'rework',title:'Inspect, repair, inspect again',instruction:'Complete Inspection with Fixed 2 and probabilities Pass 0.80, Fail 0.20. Rework already returns one Component to the State buffer in 3 hours. Validate and run 1000 realizations with horizon 100 and count budgets 1000.',controls:['activity-inspection','duration','probabilities','settings','simulate','analysis']},
  cutoff:{id:'cutoff',title:'An inclusive seven-hour horizon',instruction:'Use the completed rework network. Change Max simulation time to 7, retain 1000 realizations and both count budgets at 1000, then simulate. Completions at exactly 7 count. Theoretical acceptance is 0.96; sampled outcomes vary.',controls:['settings','simulate','analysis']},
  uncertainty:{id:'uncertainty',title:'Sample size and uncertainty',instruction:'Run the complete deterministic network with Realizations 1; inspect unavailable sample SD, mean SE and Student-t CI. Then run with Realizations 10; inspect zero SD/SE and mean CI [2,2]. Check the exercise after the 10-run experiment. Wilson probability uncertainty remains distinct.',controls:['settings','simulate','analysis']},
  replay:{id:'replay',title:'Replay the recorded seed',instruction:'Run the rework network, export its snapshot, and import it. Copy Actual seed into Seed and rerun with the same settings. Export again to compare exact reports; IDs and engine/reproducibility versions matter. The checkpoint compares the complete returned report with the previous run or imported snapshot; both must match exactly.',controls:['settings','simulate','export','import','analysis']},
  concurrency:{id:'concurrency',title:'Three instances, one activity definition',instruction:'The starting point has three Components and no Terminal. Validate and simulate. Inspection should start and complete three times per realization, then Deadlock with no terminal duration sample. A terminal arrival would instead end the whole realization.',controls:['node-start','activity-inspection','settings','simulate','analysis']},
  synchronization:{id:'synchronization',title:'Wait for both deliverables',instruction:'Inspect Mechanical design (3), Software build (5), and Integrate (1). Integration requires both outputs at the same State. Validate and simulate: terminal time is max(3,5)+1 = 6.',controls:['activity-integrate','properties','simulate','analysis']},
  documentation:{id:'documentation',title:'Explain the evidence',instruction:'Select Uninspected component and fill all four Node documentation fields. Select Inspection and fill all four Duration documentation fields. Add a rationale to Pass outcome documentation. Use descriptive certainty text. Validate, Export JSON, then Import JSON and inspect the notes again.',controls:['node-ready','node-documentation','activity-inspection','duration-documentation','outcome-documentation','validate','export','import']},
  draft:{id:'draft',title:'Preserve unknowns',instruction:'Inspection starts with unknown duration and probabilities. Add a duration rationale explaining the missing evidence. Validate the draft, Export JSON, and Import JSON. Check that the unknowns remain and Run Simulation stays disabled. Later complete Fixed 2 and probabilities 0.80/0.20 to simulate.',controls:['activity-inspection','duration-documentation','validate','export','import','simulate']},
  demo:{id:'demo',title:'Explore the full prototype',instruction:'Validate and simulate the built-in demo. Inspect parallel design, Integration, Test, Repair and two terminal outcomes. Compare 100 with 1000 realizations; generous finite limits still matter.',controls:['validate','settings','simulate','analysis']},
};

export function tutorialSettings():SettingsForm {return {realizations:'1000',seed:'20260930',max_simulation_time:'100',max_activity_instances:'1000',max_activity_completions:'1000'};}
function activity(id:string,label:string,source_node:string,target:string,value:string):Activity {
  return {id,label,source_node,requirements:{component:'1'},duration:{type:'fixed',value},outcomes:[{id:id==='prepare'?'ready':'pass',label:id==='prepare'?'Ready':'Pass',probability:'1',target_node:target,produced_items:{component:'1'}}]};
}
export function inspectionModel(kind:'deterministic'|'pass-fail'|'rework'|'concurrency'='deterministic'):Model {
  const model:Model={schema_version:'0.1',project:{id:'qc-tutorial',name:'Quality-control tutorial'},item_types:[{id:'component',label:'Component'}],nodes:[
    {id:'start',label:'Project start',type:'start',initial_inventory:{component:kind==='concurrency'?'3':'1'}},
    {id:'ready',label:'Uninspected component',type:'state'},
    kind==='concurrency'?{id:'processed',label:'Processed components',type:'state'}:{id:'accepted',label:'Accepted',type:'terminal',outcome_code:'accepted',outcome_label:'Component accepted',outcome_category:'success'},
  ],activities:[activity('prepare','Prepare inspection','start','ready','0'),activity('inspection','Inspection','ready',kind==='concurrency'?'processed':'accepted','2')]};
  if(kind==='pass-fail' || kind==='rework') {
    model.nodes.push(kind==='rework'?{id:'rework-ready',label:'Rework ready',type:'state'}:{id:'rejected',label:'Rejected',type:'terminal',outcome_code:'rejected',outcome_label:'Component rejected',outcome_category:'failure'});
    model.activities[1].outcomes[0].probability='0.80';
    model.activities[1].outcomes.push({id:'fail',label:'Fail',probability:'0.20',target_node:kind==='rework'?'rework-ready':'rejected',produced_items:{component:'1'}});
    if(kind==='rework') {
      const rework=activity('rework','Rework','rework-ready','ready','3');
      rework.outcomes[0].id='repaired';rework.outcomes[0].label='Repaired';model.activities.push(rework);
    }
  }
  return model;
}
export function synchronizationModel():Model {
  const model:Model={schema_version:'0.1',project:{id:'parallel-tutorial',name:'Parallel prerequisites'},
    item_types:['mechanical_request','software_request','mechanical_module','software_build','prototype'].map(id=>({id,label:id.replaceAll('_',' ')})),
    nodes:[{id:'start',label:'Start',type:'start',initial_inventory:{mechanical_request:'1',software_request:'1'}},{id:'integration',label:'Integration',type:'state'},{id:'approved',label:'Approved',type:'terminal',outcome_code:'approved',outcome_label:'Approved',outcome_category:'success'}],activities:[]};
  for(const [id,label,source,target,input,output,time] of [
    ['mechanical','Mechanical design','start','integration','mechanical_request','mechanical_module','3'],
    ['software','Software build','start','integration','software_request','software_build','5'],
    ['integrate','Integrate','integration','approved','mechanical_module','prototype','1'],
  ]) {
    const a=activity(id,label,source,target,time);a.requirements={[input]:'1'};a.outcomes[0].produced_items={[output]:'1'};
    if(id==='integrate') a.requirements.software_build='1';
    model.activities.push(a);
  }
  return model;
}
export function targetModel(id:ExerciseId):Model {
  if(id==='demo') return demoWorkspace().model;
  if(id==='synchronization') return synchronizationModel();
  const model=inspectionModel(['rework','cutoff','replay'].includes(id)?'rework':id==='concurrency'?'concurrency':['pass-fail','draft'].includes(id)?'pass-fail':'deterministic');
  if(id==='duration') model.activities[1].duration={type:'beta-PERT',min:'1',mode:'2',max:'4',lambda:'4'};
  if(id==='draft') {model.activities[1].duration=null;model.activities[1].outcomes.forEach(o=>o.probability=null);}
  return model;
}
export function practice(id:ExerciseId):{workspace:Workspace;settings:SettingsForm} {
  if(id==='demo') return {workspace:demoWorkspace(),settings:{...demoSettings}};
  const model=targetModel(id);
  // Deliberate teaching starting points: never infer missing estimates.
  if(['deterministic','snapshot','rework'].includes(id)) {model.activities[1].duration=null;model.activities[1].outcomes.forEach(o=>o.probability=null);}
  if(id==='pass-fail') model.activities[1].outcomes.forEach(o=>o.probability=null);
  if(id==='duration') model.activities[1].duration={type:'beta-PERT',min:null,mode:null,max:null,lambda:null};
  return {workspace:{model,layout:{nodes:model.nodes.map((_,i)=>({x:i===3?600:i*320,y:i===3?400:70})),activities:model.activities.map((_,i)=>({x:i===2?340:160+i*320,y:i===2?400:210}))}},settings:tutorialSettings()};
}
const decimal=(v:string|null)=>v===null?null:new BigNumber(v).toString();
const quantities=(q:Record<string,string>)=>Object.entries(q).sort(([a],[b])=>a.localeCompare(b)).map(([id,v])=>[id,decimal(v)]);
// Compare exercise inputs only; validation and all simulation stay in the backend.
export function mathematicalInputs(model:Model):string {
  return JSON.stringify({items:model.item_types.map(i=>i.id).sort(),nodes:[...model.nodes].sort((a,b)=>a.id.localeCompare(b.id)).map(n=>[n.id,n.type,n.type==='start'?quantities(n.initial_inventory):null]),
    activities:[...model.activities].sort((a,b)=>a.id.localeCompare(b.id)).map(a=>[a.id,a.source_node,quantities(a.requirements),a.duration?Object.entries(a.duration).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,k==='type'?v:decimal(v)]):null,[...a.outcomes].sort((a,b)=>a.id.localeCompare(b.id)).map(o=>[o.id,decimal(o.probability),o.target_node,quantities(o.produced_items)])])});
}
export interface Check {complete:boolean; message:string}
export function checkExercise(id:ExerciseId,state?:EditorObservation):Check {
  const fail=(message:string):Check=>({complete:false,message});
  if(!state) return fail('Load the practice starting point first.');
  if(state.busy) return fail('Wait for the current backend request to finish.');
  const {workspace,report,result,settings}=state;
  if(mathematicalInputs(workspace.model)!==mathematicalInputs(targetModel(id))) return fail('The practice inputs do not yet match this exercise. Follow the steps, then Validate again. Labels and documentation may differ.');
  if(!report?.valid) return fail('Validate the current practice model with the backend and correct its errors.');
  if(id==='documentation' || id==='draft') {
    const inspection=workspace.model.activities.find(a=>a.id==='inspection')!;
    if(id==='documentation') {
      const node=workspace.model.nodes.find(n=>n.id==='ready')?.documentation;
      if(!['comments','assumptions','certainty','explanation'].every(k=>node?.[k as keyof typeof node]?.trim()) || !['rationale','assumptions','references','certainty'].every(k=>inspection.duration_documentation?.[k as keyof NonNullable<Activity['duration_documentation']>]?.trim()) || !inspection.outcomes[0].documentation?.rationale?.trim()) return fail('Fill the four Node documentation fields, the four Duration documentation fields, and a Pass rationale. Certainty is descriptive text.');
    } else {
      if(report.simulation_ready!==false || report.draft_valid!==true) return fail('Validate and check the backend reports a valid draft that is not simulation-ready.');
      if(!inspection.duration_documentation?.rationale?.trim()) return fail('Add a duration rationale explaining why the estimates are unknown.');
    }
    if(state.lastImport!==JSON.stringify(workspace.model)) return fail('Export this practice draft and Import JSON to verify the notes and placeholders survive a real round trip.');
    return {complete:true,message:id==='draft'?'Backend-validated draft restored with explicit unknowns. Simulation remains blocked.':'Node, duration and outcome notes restored from canonical model JSON. Notes do not change simulation mathematics.'};
  }
  if(!result || report.simulation_ready===false) return fail('Run Simulation with complete inputs. A model edit or Validate clears previous results.');
  if(id==='snapshot') return state.importedResult?{complete:true,message:'A versioned snapshot restored settings and saved results without rerunning. Consistency checks do not authenticate or recompute an imported report.'}:fail('Export the current results, then import the downloaded snapshot.');
  if(state.importedResult) return fail('Run Simulation to check this exercise against a fresh backend response.');
  const time=result.summary.terminal_duration;
  if(!result.runs.length || result.runs.some(r=>r.status==='invalid_runtime_state'||r.status.startsWith('ambiguous'))) return fail('The simulation did not demonstrate this exercise. Inspect runtime statuses and correct the model/settings.');
  if(['pass-fail','duration','demo','replay'].includes(id) && !result.runs.some(r=>r.status==='terminal')) return fail('No terminal observations are available. Check the run limits and simulate again.');
  if(id==='cutoff' && result.runs.some(r=>!['terminal','cutoff_time'].includes(r.status)||(r.status==='terminal'&&!['2','7'].includes(r.last_processed_time)))) return fail('Expected only terminal observations at 2 or 7, or time cutoffs. Inspect the settings and results.');
  if(id==='deterministic' && (time.mean!=='2' || result.runs.some(r=>r.status!=='terminal'||r.last_processed_time!=='2'))) return fail('Expected every run to finish at time 2. Check settings and run statuses.');
  if(id==='synchronization' && (time.mean!=='6' || result.runs.some(r=>r.status!=='terminal'||r.last_processed_time!=='6'))) return fail('Expected integration after both prerequisites, finishing at 6. Check limits.');
  if(id==='concurrency' && result.runs.some(r=>r.status!=='deadlock'||String(r.activities.inspection?.started)!=='3'||String(r.activities.inspection?.completed)!=='3')) return fail('Expected three Inspection starts and completions, then Deadlock with no terminal. Check limits.');
  if(['rework','cutoff'].includes(id) && (settings.realizations!=='1000'||settings.max_simulation_time!==(id==='cutoff'?'7':'100')||settings.max_activity_instances!=='1000'||settings.max_activity_completions!=='1000')) return fail('Use Realizations 1000, both count budgets 1000, and the exercise horizon (100 for rework; 7 for cutoff).');
  if(id==='uncertainty' && (!state.singletonSeen||String(time.sample_size)!=='10'||time.mean!=='2'||time.sample_standard_deviation!=='0'||time.mean_standard_error!=='0'||time.mean_confidence_interval?.lower!=='2'||time.mean_confidence_interval?.upper!=='2')) return fail('Inspect the single-run case first, then run 10 realizations. Expected mean 2, sample SD/SE 0 and Student-t interval [2,2].');
  if(id==='replay' && (settings.seed===''||String(result.root_seed)!==settings.seed||!state.replayVerified)) return fail('Run once (or import its snapshot), copy Actual seed into Seed, and rerun. The complete backend reports must match exactly.');
  const benchmarks:Partial<Record<ExerciseId,string>>={rework:'Unlimited theoretical mean 3.25; Inspection starts 1.25; Rework starts 0.25. Finite sampled results vary.',cutoff:'Horizon 7 includes exact-time completions. Theoretical acceptance 0.96, cutoff 0.04; terminal-only theoretical mean 2.8333… . Finite sampled estimates vary.',duration:'Beta-PERT theoretical mean is 13/6 ≈ 2.167; the sample mean need not equal it.',concurrency:'Three Inspection starts and completions per realization; Deadlock is separate from a failure terminal.',synchronization:'Both prerequisites arrived at Integration before it ran. Terminal time is exactly 6.',uncertainty:'Ten terminal samples: mean 2, both SDs 0, SE 0 and Student-t CI [2,2]. Wilson probability uncertainty is separate.'};
  return {complete:true,message:benchmarks[id]||'The current model and a fresh backend simulation satisfy this exercise. Export JSON to preserve your practice work.'};
}

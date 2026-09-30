import BigNumber from 'bignumber.js';
import type {Activity, Diagnostic, Duration, GertNode, Model, Outcome, Selection, SettingsForm, Workspace} from './types';

export const emptyWorkspace = ():Workspace => ({model:{schema_version:'0.1',project:{id:'project',name:'Untitled network'}, item_types:[],nodes:[],activities:[]},layout:{nodes:[],activities:[]}});
export const emptySettings = ():SettingsForm => ({realizations:'',seed:'',max_simulation_time:'',max_activity_instances:'',max_activity_completions:''});
export function freshId(prefix:string, entries:{id:string}[]) {let i=1; while(entries.some(e=>e.id===`${prefix}_${i}`)) i++; return `${prefix}_${i}`;}
export function blankDuration(type:Duration['type']):Duration {
  if(type==='fixed') return {type,value:null};
  if(type==='uniform') return {type,min:null,max:null};
  if(type==='triangular') return {type,min:null,mode:null,max:null};
  return {type,min:null,mode:null,max:null,lambda:null};
}
export const blankOutcome = (id:string,target=''):Outcome => ({id,label:id,probability:null,target_node:target,produced_items:{}});
export function newNode(type:GertNode['type'],id:string):GertNode {
  const base={id,label:id};
  if(type==='start') return {...base,type,initial_inventory:{}};
  if(type==='terminal') return {...base,type,outcome_code:id,outcome_label:id,outcome_category:'custom'};
  return {...base,type};
}
export const newActivity = (id:string,source='',target=''):Activity => ({id,label:id,source_node:source,requirements:{},duration:null,outcomes:[blankOutcome('outcome_1',target)]});

export function missingInputs(model:Model):Diagnostic[] {
  const diagnostics:Diagnostic[]=[];
  model.activities.forEach((a,i)=>{
    const add=(message:string,path:(string|number)[])=>diagnostics.push({severity:'info',code:'missing_input',message,path:['activities',i,...path],element_id:a.id});
    if(a.duration===null) add(`Activity ${a.id}: choose a duration distribution`,['duration']);
    else Object.entries(a.duration).forEach(([field,value])=>{if(value===null) add(`Activity ${a.id}: enter duration ${field}`,['duration',field]);});
    a.outcomes.forEach((o,j)=>{if(o.probability===null) add(`Activity ${a.id}, outcome ${o.id}: enter probability`,['outcomes',j,'probability']);});
  });
  return diagnostics;
}

// Display-only arithmetic. No values are written back or normalized. Avoid binary floats.
export function probabilityTotal(outcomes:Outcome[]):string {
  if(!outcomes.length || outcomes.some(o=>!o.probability?.trim())) return 'Incomplete';
  try {
    const values=outcomes.map(o=>new BigNumber(o.probability!));
    if(values.some(v=>!v.isFinite())) return 'Invalid input';
    return values.reduce((sum,v)=>sum.plus(v),new BigNumber('0')).toString();
  } catch {return 'Invalid input';}
}
// Explicit whitelist: no canvas coordinates, selection or settings enter mathematical fields.
export function apiModel(workspace:Workspace):Model {return structuredClone(workspace.model);}
export function diagnosticSelection(model:Model,path:(string|number)[],id?:string|null):Selection {
  const [collection,index]=path;
  const kind=collection==='nodes'?'node':collection==='activities'?'activity':collection==='item_types'?'item':null;
  if(kind && typeof index==='number') return {kind,index,outcome:path[2]==='outcomes' && typeof path[3]==='number'?path[3]:undefined};
  if(id && kind) {
    const entries=kind==='node'?model.nodes:kind==='activity'?model.activities:model.item_types;
    const i=entries.findIndex(e=>e.id===id); if(i>=0) return {kind,index:i};
  }
  return null;
}

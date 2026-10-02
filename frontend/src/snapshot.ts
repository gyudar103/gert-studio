import BigNumber from 'bignumber.js';
import {ApiError,exactJSON} from './api';
import type {Model,SettingsForm,SimulationResult} from './types';

const percentiles=['p5','p10','p20','p30','p50','p70','p80','p90','p95'];
const statuses=['terminal','deadlock','cutoff_activity_count','cutoff_instance_count','cutoff_time','invalid_runtime_state','ambiguous_resource_competition','ambiguous_terminal'];
type Check=(value:any)=>boolean;
const object=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const integer:Check=v=>typeof v==='bigint'||typeof v==='number'&&Number.isSafeInteger(v);
const count:Check=v=>integer(v)&&BigInt(v)>=0n;
const positive:Check=v=>count(v)&&BigInt(v)>0n;
const text:Check=v=>typeof v==='string';
const decimal:Check=v=>text(v)&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(v)&&new BigNumber(v).isFinite()&&new BigNumber(v).gte(0);
const probability:Check=v=>decimal(v)&&new BigNumber(v).lte(1);
const nullable=(check:Check):Check=>v=>v===null||check(v);
const shape=(fields:Record<string,Check>):Check=>v=>object(v)&&Object.entries(fields).every(([key,check])=>Object.hasOwn(v,key)&&check(v[key]));
const dictionary=(check:Check):Check=>v=>object(v)&&Object.values(v).every(check);
const array=(check:Check):Check=>v=>Array.isArray(v)&&v.every(check);
const literal=(value:unknown):Check=>v=>v===value;
const interval=(method:string,extra:Record<string,Check>={}):Check=>shape({level:literal('0.95'),method:literal(method),lower:decimal,upper:decimal,...extra});
const wilson:Check=v=>interval('wilson')(v)&&probability(v.lower)&&probability(v.upper)&&new BigNumber(v.lower).lte(v.upper);
const student:Check=v=>interval('student_t',{lower_clipped:v=>typeof v==='boolean',degrees_of_freedom:positive})(v)&&new BigNumber(v.lower).lte(v.upper);
const quantile:Check=v=>shape({level:literal('0.95'),method:literal('binomial_order_statistic'),lower:nullable(decimal),upper:nullable(decimal),lower_rank:nullable(positive),upper_rank:nullable(positive)})(v)
  &&(v.lower===null)===(v.lower_rank===null)&&(v.upper===null)===(v.upper_rank===null)
  &&(v.lower===null||v.upper===null||new BigNumber(v.lower).lte(v.upper)&&BigInt(v.lower_rank)<=BigInt(v.upper_rank));
const frequency=shape({count,denominator:positive,probability,standard_error:decimal,confidence_interval:wilson});
const settingsFields={realizations:positive,seed:integer,max_simulation_time:decimal,max_activity_instances:count,max_activity_completions:count};
const settingsCheck:Check=v=>shape(settingsFields)(v)&&Object.keys(v).length===Object.keys(settingsFields).length;
const lifecycle={started:count,completed:count,cancelled:count,unfinished_at_run_end:count,unfinished_at_cutoff:count,unfinished_at_ambiguity:count,unfinished_at_invalid_runtime:count};
const activity=shape({...lifecycle,denominator:positive,mean_starts:decimal,standard_deviation_starts:decimal,sample_standard_deviation_starts:nullable(decimal),mean_starts_standard_error:nullable(decimal),mean_starts_confidence_interval:nullable(student),probability_at_least_one_start:probability,probability_at_least_one_start_standard_error:decimal,probability_at_least_one_start_confidence_interval:wilson});
const duration=shape({sample_size:count,conditioning:text,...Object.fromEntries(['mean','median','min','max','standard_deviation','sample_standard_deviation','mean_standard_error',...percentiles].map(k=>[k,nullable(decimal)])),mean_confidence_interval:nullable(student),quantile_confidence_intervals:shape(Object.fromEntries(percentiles.map(k=>[k,quantile])))});
const validation=shape({valid:literal(true),diagnostics:array(shape({severity:v=>['error','warning','info'].includes(v),code:text,message:text,path:array(v=>text(v)||count(v))}))});
const instance=shape({activity_id:text,ordinal:count,start:decimal,scheduled_finish:decimal,duration:decimal,state:v=>['completed','cancelled','unfinished_at_run_end'].includes(v),outcome_id:nullable(text),unfinished_reason:nullable(text)});
const run=shape({realization_index:count,status:v=>statuses.includes(v),error:nullable(text),last_processed_time:decimal,terminal_node_id:nullable(text),inventory:dictionary(dictionary(decimal)),activities:dictionary(shape(lifecycle)),instances:array(instance)});
const resultCheck=shape({root_seed:integer,engine_version:v=>text(v)&&v.length>0,reproducibility_version:v=>text(v)&&v.length>0,settings:settingsCheck,validation,summary:shape({realizations:positive,statuses:dictionary(frequency),terminal_outcomes:dictionary(v=>frequency(v)&&text(v.outcome_code)),terminal_duration:duration,activities:dictionary(activity),cutoff_observations_are_truncated:literal(true)}),runs:array(run)});

export function validateSnapshot(value:any):{result:SimulationResult;settings:SettingsForm} {
  const reject=()=>{throw new ApiError('Cannot import simulation snapshot: malformed or inconsistent saved results. Your current workspace is unchanged.');};
  if(!shape({file_type:literal('gert-studio-simulation-snapshot'),file_version:literal('0.1'),model:object,simulation_settings:settingsCheck,simulation_result:resultCheck})(value)) reject();
  const result=value.simulation_result;
  const settings=value.simulation_settings;
  if(exactJSON.stringify(settings)!==exactJSON.stringify(result.settings)) {
    if(Object.keys(settings).length!==Object.keys(result.settings).length||Object.keys(settings).some(k=>String(settings[k])!==String(result.settings[k]))) reject();
  }
  const n=BigInt(settings.realizations);
  if(BigInt(result.root_seed)!==BigInt(settings.seed)||BigInt(result.summary.realizations)!==n||BigInt(result.runs.length)!==n) reject();
  if(statuses.some(s=>!Object.hasOwn(result.summary.statuses,s))||Object.keys(result.summary.statuses).some(s=>!statuses.includes(s))) reject();
  let total=0n;
  for(const entry of Object.values(result.summary.statuses) as any[]) {if(BigInt(entry.denominator)!==n||BigInt(entry.count)>n) reject();total+=BigInt(entry.count);}
  if(total!==n) reject();
  const terminalCount=BigInt(result.summary.statuses.terminal.count);
  if(BigInt(result.summary.terminal_duration.sample_size)!==terminalCount) reject();
  const d=result.summary.terminal_duration;
  for(const key of ['mean','median','min','max','standard_deviation',...percentiles]) if((d[key]===null)!==(terminalCount===0n)) reject();
  for(const key of ['sample_standard_deviation','mean_standard_error','mean_confidence_interval']) if((d[key]===null)!==(terminalCount<2n)) reject();
  if(d.median!==d.p50) reject();
  for(const ci of Object.values(d.quantile_confidence_intervals) as any[]) if(ci.lower_rank!==null&&BigInt(ci.lower_rank)>terminalCount||ci.upper_rank!==null&&BigInt(ci.upper_rank)>terminalCount) reject();
  for(const entry of Object.values(result.summary.terminal_outcomes) as any[]) if(BigInt(entry.denominator)!==n||BigInt(entry.count)>n) reject();
  for(const entry of Object.values(result.summary.activities) as any[]) if(BigInt(entry.denominator)!==n||BigInt(entry.started)!==BigInt(entry.completed)+BigInt(entry.cancelled)+BigInt(entry.unfinished_at_run_end)||BigInt(entry.unfinished_at_run_end)!==BigInt(entry.unfinished_at_cutoff)+BigInt(entry.unfinished_at_ambiguity)+BigInt(entry.unfinished_at_invalid_runtime)) reject();
  result.runs.forEach((r:any,i:number)=>{if(BigInt(r.realization_index)!==BigInt(i)) reject();});
  return {result,settings:Object.fromEntries(Object.entries(settings).map(([k,v])=>[k,String(v)])) as unknown as SettingsForm};
}

// Extract a top-level JSON value without reserializing numeric tokens. The strict
// parser has already rejected malformed JSON and duplicate object keys.
function modelRange(text:string):[number,number] {
  const tokens=/"(?:\\.|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g;
  let depth=0, start=-1;
  const matches=[...text.matchAll(tokens)];
  for(let i=0;i<matches.length;i++) {
    const match=matches[i];
    const token=match[0];
    if(start<0&&depth===1&&token.startsWith('"')&&JSON.parse(token)==='model'&&matches[i+1]?.[0]===':') start=matches[i+2].index!;
    if(start>=0&&match.index!>=start&&depth===1&&(token===','||token==='}')) return [start,match.index!];
    if(token==='{'||token==='[') depth++;
    if(token==='}'||token===']') depth--;
  }
  throw new ApiError('Cannot import simulation snapshot: missing model.');
}

export function rawModel(text:string):string {const [start,end]=modelRange(text);return text.slice(start,end).trim();}
export function snapshotEnvelope(text:string):unknown {
  const [start,end]=modelRange(text);
  // Model tokens are validated separately; parsing them as response integers or
  // binary64 decimals would reject or round otherwise valid exact model values.
  return exactJSON.parse(text.slice(0,start)+'{}'+text.slice(end));
}

export function validateSnapshotModel(result:SimulationResult,model:Model) {
  const r=result as any;
  const reject=()=>{throw new ApiError('Cannot import simulation snapshot: saved result IDs or counts do not match its model. Your current workspace is unchanged.');};
  const nodes=new Set(model.nodes.map(n=>n.id)),activities=new Map(model.activities.map(a=>[a.id,a])),items=new Set(model.item_types.map(i=>i.id));
  const terminals=model.nodes.filter(n=>n.type==='terminal');
  const keysMatch=(actual:object,expected:string[])=>Object.keys(actual).length===expected.length&&expected.every(id=>Object.hasOwn(actual,id));
  if(!keysMatch(r.summary.activities,[...activities.keys()])||!keysMatch(r.summary.terminal_outcomes,terminals.map(n=>n.id))) reject();
  let terminalCount=0n;
  for(const node of terminals) {const entry=r.summary.terminal_outcomes[node.id];if(entry.outcome_code!==node.outcome_code) reject();terminalCount+=BigInt(entry.count);}
  if(terminalCount!==BigInt(r.summary.statuses.terminal.count)) reject();
  const runCounts=Object.fromEntries(statuses.map(s=>[s,0n]));
  const terminalCounts=Object.fromEntries(terminals.map(n=>[n.id,0n]));
  for(const run of r.runs) {
    runCounts[run.status]++;
    if(run.status==='terminal') {if(!Object.hasOwn(terminalCounts,run.terminal_node_id)) reject();terminalCounts[run.terminal_node_id]++;}
    else if(run.terminal_node_id!==null) reject();
    if(!keysMatch(run.activities,[...activities.keys()])||Object.keys(run.inventory).some(id=>!nodes.has(id))) reject();
    for(const inventory of Object.values(run.inventory) as object[]) if(Object.keys(inventory).some(id=>!items.has(id))) reject();
    let starts=0n,completions=0n;
    for(const counts of Object.values(run.activities) as any[]) {
      if(BigInt(counts.started)!==BigInt(counts.completed)+BigInt(counts.cancelled)+BigInt(counts.unfinished_at_run_end)||BigInt(counts.unfinished_at_run_end)!==BigInt(counts.unfinished_at_cutoff)+BigInt(counts.unfinished_at_ambiguity)+BigInt(counts.unfinished_at_invalid_runtime)) reject();
      starts+=BigInt(counts.started);completions+=BigInt(counts.completed);
    }
    if(starts>BigInt(result.settings.max_activity_instances)||completions>BigInt(result.settings.max_activity_completions)||new BigNumber(run.last_processed_time).gt(result.settings.max_simulation_time)) reject();
    const instanceKeys=new Set<string>();
    for(const instance of run.instances) {
      const a=activities.get(instance.activity_id);
      if(!a||instance.outcome_id!==null&&!a.outcomes.some(o=>o.id===instance.outcome_id)||!['cutoff','ambiguity','invalid_runtime',null].includes(instance.unfinished_reason)) reject();
      const key=JSON.stringify([instance.activity_id,String(instance.ordinal)]);
      if(instanceKeys.has(key)||(instance.state==='completed')!==(instance.outcome_id!==null)||(instance.state==='unfinished_at_run_end')!==(instance.unfinished_reason!==null)||!new BigNumber(instance.start).plus(instance.duration).eq(instance.scheduled_finish)) reject();
      instanceKeys.add(key);
    }
    if(BigInt(run.instances.length)!==starts) reject();
    for(const id of activities.keys()) {
      const instances=run.instances.filter((i:any)=>i.activity_id===id);
      for(const state of ['completed','cancelled','unfinished_at_run_end']) if(BigInt(instances.filter((i:any)=>i.state===state).length)!==BigInt(run.activities[id][state])) reject();
      for(const reason of ['cutoff','ambiguity','invalid_runtime']) if(BigInt(instances.filter((i:any)=>i.unfinished_reason===reason).length)!==BigInt(run.activities[id]['unfinished_at_'+reason])) reject();
    }
  }
  for(const status of statuses) if(runCounts[status]!==BigInt(r.summary.statuses[status].count)) reject();
  for(const node of terminals) if(terminalCounts[node.id]!==BigInt(r.summary.terminal_outcomes[node.id].count)) reject();
  for(const id of activities.keys()) for(const key of Object.keys(lifecycle)) {
    const total=r.runs.reduce((sum:bigint,run:any)=>sum+BigInt(run.activities[id][key]),0n);
    if(total!==BigInt(r.summary.activities[id][key])) reject();
  }
}

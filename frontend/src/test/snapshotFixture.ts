import {demoWorkspace} from '../demo';
import {resultsFixture} from './resultsFixture';

export function snapshotFixture() {
  const workspace=demoWorkspace();
  const result:any=resultsFixture();
  const zero={started:0,completed:0,cancelled:0,unfinished_at_run_end:0,unfinished_at_cutoff:0,unfinished_at_ambiguity:0,unfinished_at_invalid_runtime:0};
  const test=result.summary.activities.test;
  result.summary.activities=Object.fromEntries(workspace.model.activities.map(a=>[a.id,a.id==='test'?test:{...test,...zero,mean_starts:'0',probability_at_least_one_start:'0'}]));
  result.summary.terminal_outcomes.failure={...result.summary.terminal_outcomes.success,count:0,probability:'0',outcome_code:'failure'};
  result.runs.forEach((run:any,i:number)=>{
    run.terminal_node_id=i===0?'success':null;
    run.activities=Object.fromEntries(workspace.model.activities.map(a=>[a.id,{...zero,...(a.id==='test'?{started:1,completed:i===0?1:0,unfinished_at_run_end:i===1?1:0,unfinished_at_cutoff:i===1?1:0}:{})}]));
    run.instances=[{activity_id:'test',ordinal:0,start:'0',scheduled_finish:'18.341252780000000000000001',duration:'18.341252780000000000000001',state:i===0?'completed':'unfinished_at_run_end',outcome_id:i===0?'pass':null,unfinished_reason:i===0?null:'cutoff'}];
  });
  return {workspace,result};
}

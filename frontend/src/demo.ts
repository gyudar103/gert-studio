import type {Activity, Duration, Outcome, Workspace} from './types';
import {emptyWorkspace} from './model';
const done=(id:string,target:string,probability:string,produced_items:Record<string,string>={}):Outcome=>({id,label:id,probability,target_node:target,produced_items});
const act=(id:string,label:string,source_node:string,requirements:Record<string,string>,duration:Duration,outcomes:Outcome[]):Activity=>({id,label,source_node,requirements,duration,outcomes});
export function demoWorkspace():Workspace {
  const doc=emptyWorkspace();
  doc.model.project={id:'prototype-demo',name:'Prototype · build, integrate, test'};
  doc.model.item_types=['mechanical_request','software_request','mechanical_module','software_build','prototype','repair_request'].map(id=>({id,label:id.replaceAll('_',' ')}));
  doc.model.nodes=[
    {id:'start',label:'Project start',type:'start',initial_inventory:{mechanical_request:'1',software_request:'1'}},
    {id:'integration',label:'Integration ready',type:'state'},
    {id:'test',label:'Test ready',type:'state'},
    {id:'rework',label:'Rework ready',type:'state'},
    {id:'success',label:'Approved',type:'terminal',outcome_code:'success',outcome_label:'Prototype approved',outcome_category:'success'},
    {id:'failure',label:'Stopped',type:'terminal',outcome_code:'failure',outcome_label:'Prototype rejected',outcome_category:'failure'},
  ];
  doc.model.activities=[
    act('mechanical','Mechanical design','start',{mechanical_request:'1'},{type:'triangular',min:'2',mode:'3',max:'5'},[done('complete','integration','1',{mechanical_module:'1'})]),
    act('software','Software build','start',{software_request:'1'},{type:'uniform',min:'3',max:'6'},[done('complete','integration','1',{software_build:'1'})]),
    act('integrate','Integrate prototype','integration',{mechanical_module:'1',software_build:'1'},{type:'fixed',value:'1'},[done('complete','test','1',{prototype:'1'})]),
    act('test','Test prototype','test',{prototype:'1'},{type:'beta-PERT',min:'1',mode:'2',max:'4',lambda:'4'},[done('pass','success','0.8'),done('retry','rework','0.15',{repair_request:'1'}),done('reject','failure','0.05')]),
    act('repair','Repair prototype','rework',{repair_request:'1'},{type:'fixed',value:'2'},[done('repaired','test','1',{prototype:'1'})]),
  ];
  doc.layout.nodes=[{x:0,y:210},{x:520,y:210},{x:1020,y:210},{x:1280,y:560},{x:1520,y:60},{x:1520,y:360}];
  doc.layout.activities=[{x:260,y:90},{x:260,y:330},{x:770,y:210},{x:1280,y:210},{x:1020,y:560}];
  return doc;
}
// Explicit, visible demonstration settings; new blank projects have none.
export const demoSettings={realizations:'100',seed:'20260914',max_simulation_time:'100',max_activity_instances:'1000',max_activity_completions:'1000'};

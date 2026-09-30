import {MarkerType,type Edge,type Node} from '@xyflow/react';
import type {Selection,Workspace} from './types';
export type CardData={title:string; subtitle:string; kind:string; index:number; selectionKind:'node'|'activity'; incomplete?:boolean};
export function graphView(workspace:Workspace,selection:Selection):{nodes:Node<CardData>[];edges:Edge[]} {
  const {model,layout}=workspace;
  const nodes:Node<CardData>[]=[
    ...model.nodes.map((n,i)=>({id:`n:${i}`,type:'card',position:layout.nodes[i]||{x:0,y:i*150},selected:selection?.kind==='node'&&selection.index===i,data:{title:n.label||n.id,subtitle:n.id,kind:n.type,index:i,selectionKind:'node' as const}})),
    ...model.activities.map((a,i)=>({id:`a:${i}`,type:'card',position:layout.activities[i]||{x:250,y:i*150},selected:selection?.kind==='activity'&&selection.index===i,data:{title:a.label||a.id,subtitle:`${a.duration?.type??'Unknown duration'} · ${a.outcomes.length} outcome${a.outcomes.length===1?'':'s'}`,kind:'activity',index:i,selectionKind:'activity' as const,incomplete:a.duration===null || Object.values(a.duration).some(v=>v===null) || a.outcomes.some(o=>o.probability===null)}})),
  ];
  const edges:Edge[]=[];
  model.activities.forEach((a,ai)=>{
    const source=model.nodes.findIndex(n=>n.id===a.source_node);
    const selected=selection?.kind==='activity'&&selection.index===ai;
    const style={stroke:selected?'#d17b28':'#75968f',strokeWidth:selected?2.5:1.5};
    if(source>=0) edges.push({id:`input:${ai}`,source:`n:${source}`,target:`a:${ai}`,type:'smoothstep',style,data:{activity:ai}});
    a.outcomes.forEach((o,oi)=>{
      const target=model.nodes.findIndex(n=>n.id===o.target_node);
      if(target>=0) edges.push({id:`outcome:${ai}:${oi}`,source:`a:${ai}`,target:`n:${target}`,type:'smoothstep',label:`${o.label||o.id} · p=${o.probability||'?'}`,style,markerEnd:{type:MarkerType.ArrowClosed,color:style.stroke},labelStyle:{fontSize:11,fill:'#294741'},labelBgStyle:{fill:'#f6f8f5'},labelBgPadding:[5,3],data:{activity:ai,outcome:oi}});
    });
  });
  return {nodes,edges};
}

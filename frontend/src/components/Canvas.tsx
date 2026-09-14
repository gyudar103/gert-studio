import {useEffect,useMemo} from 'react';
import {Background,Controls,Handle,MiniMap,Position,ReactFlow,ReactFlowProvider,useReactFlow,type NodeProps,type Node,type Connection} from '@xyflow/react';
import type {Point,Selection,Workspace} from '../types';
import {graphView,type CardData} from '../graph';
function Card({data,selected}:NodeProps<Node<CardData>>) {
  return <div className={`graph-card ${data.kind} ${selected?'selected':''}`}>
    <Handle type="target" position={Position.Left}/><div className="card-kind">{data.kind==='activity'?'Activity':data.kind}</div><strong>{data.title}</strong><small>{data.subtitle}</small><Handle type="source" position={Position.Right}/>
  </div>;
}
const nodeTypes={card:Card};
interface Props {workspace:Workspace;selection:Selection;focus:number;select:(s:Selection)=>void;move:(kind:'nodes'|'activities',index:number,point:Point)=>void;connect:(source:string,target:string)=>void}
function Inner({workspace,selection,focus,select,move,connect}:Props) {
  const view=useMemo(()=>graphView(workspace,selection),[workspace,selection]);
  const flow=useReactFlow();
  useEffect(()=>{if(focus && selection && selection.kind!=='item') void flow.fitView({nodes:[{id:`${selection.kind==='node'?'n':'a'}:${selection.index}`}],padding:1,maxZoom:1,duration:250});},[focus]); // focus is a deliberate diagnostic navigation action
  function onConnect(connection:Connection) {
    // Visual activity cards are not mathematical nodes; use their outcome editor for branches.
    if(connection.source.startsWith('n:') && connection.target.startsWith('n:')) {
      connect(workspace.model.nodes[Number(connection.source.slice(2))].id,workspace.model.nodes[Number(connection.target.slice(2))].id);
    }
  }
  return <ReactFlow nodes={view.nodes} edges={view.edges} nodeTypes={nodeTypes} fitView minZoom={0.15} maxZoom={2}
    deleteKeyCode={null} onPaneClick={()=>select(null)} onNodeClick={(_,n)=>select({kind:n.data.selectionKind,index:n.data.index})}
    onEdgeClick={(_,e)=>select({kind:'activity',index:e.data!.activity as number,outcome:e.data!.outcome as number|undefined})}
    onNodesChange={changes=>{for(const c of changes) if(c.type==='position' && c.position) move(c.id.startsWith('n:')?'nodes':'activities',Number(c.id.slice(2)),c.position);}}
    onConnect={onConnect} isValidConnection={c=>c.source.startsWith('n:')&&c.target.startsWith('n:')}>
    <Background gap={24} size={1} color="#ccdad4"/><Controls showInteractive={false}/><MiniMap pannable zoomable nodeColor={n=>n.data.kind==='activity'?'#d6b995':'#82aaa0'}/>
  </ReactFlow>;
}
export default function Canvas(props:Props) {return <ReactFlowProvider><Inner {...props}/></ReactFlowProvider>;}

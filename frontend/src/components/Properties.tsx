import {useEffect} from 'react';
import type {Activity, Duration, GertNode, Item, Model, Selection} from '../types';
import {blankDuration,blankOutcome,freshId,probabilityTotal} from '../model';
import {adjustProbability} from '../probabilities';
import {Field,QuantityEditor,SelectField} from './Fields';
interface Props {model:Model; selection:Selection; updateNode:(index:number,node:GertNode)=>void; updateActivity:(index:number,activity:Activity)=>void; updateItem:(index:number,item:Item)=>void; remove:()=>void}
export default function Properties({model,selection,updateNode,updateActivity,updateItem,remove}:Props) {
  useEffect(()=>{if(selection?.outcome!==undefined) document.getElementById(`outcome-editor-${selection.outcome}`)?.scrollIntoView({block:'nearest'});},[selection]);
  if(!selection) return <aside className="properties"><div className="panel-heading">Properties</div><div className="empty-property"><span className="empty-symbol">↖</span><h2>Select an element</h2><p>Choose a node, activity, or item to edit its properties.</p><p>Connect two node handles to create an activity. Add alternative outcomes in its editor.</p></div></aside>;
  const {kind,index}=selection;
  const node=kind==='node'?model.nodes[index]:undefined;
  const activity=kind==='activity'?model.activities[index]:undefined;
  const item=kind==='item'?model.item_types[index]:undefined;
  return <aside className="properties" aria-label="Properties"><div className="panel-heading">{node?`${node.type} node`:kind==='activity'?'Activity':'Item type'}<span>Properties</span></div>
    <div className="property-body" key={`${kind}-${index}`}>
      <p className="hint">Fields marked * are required. Numeric inputs have no defaults.</p>
      {node && <>
        <Field label="Node ID" required value={node.id} onChange={id=>updateNode(index,{...node,id})}/>
        <Field label="Node label" value={node.label} onChange={label=>updateNode(index,{...node,label})}/>
        {node.type==='start' && <QuantityEditor title="Initial inventory" value={node.initial_inventory} items={model.item_types} onChange={initial_inventory=>updateNode(index,{...node,initial_inventory})}/>}
        {node.type==='terminal' && <>
          <Field label="Outcome code" required value={node.outcome_code} onChange={outcome_code=>updateNode(index,{...node,outcome_code})}/>
          <Field label="Outcome label" value={node.outcome_label} onChange={outcome_label=>updateNode(index,{...node,outcome_label})}/>
          <label className="field"><span>Outcome category *</span><input list="terminal-categories" value={node.outcome_category} onChange={e=>updateNode(index,{...node,outcome_category:e.target.value})}/><datalist id="terminal-categories">{['success','failure','neutral','custom'].map(c=><option key={c} value={c}/>)}</datalist></label>
        </>}
        <p className="hint">Deleting this node keeps activity references so validation can explain any missing connections.</p>
      </>}
      {item && <>
        <Field label="Item ID" required value={item.id} onChange={id=>updateItem(index,{...item,id})}/>
        <Field label="Item label" value={item.label} onChange={label=>updateItem(index,{...item,label})}/>
        <p className="hint">Renaming updates references. Deleting keeps inventory and requirements visible as missing items.</p>
      </>}
      {activity && <>
        <Field label="Activity ID" required value={activity.id} onChange={id=>updateActivity(index,{...activity,id})}/>
        <Field label="Activity label" value={activity.label} onChange={label=>updateActivity(index,{...activity,label})}/>
        <SelectField label="Source node" required value={activity.source_node} options={model.nodes} onChange={source_node=>updateActivity(index,{...activity,source_node})}/>
        <QuantityEditor title="Requirements" value={activity.requirements} items={model.item_types} onChange={requirements=>updateActivity(index,{...activity,requirements})}/>
        <small>At least one positive input is required. Items are consumed when an instance starts.</small>
        <fieldset><legend>Duration</legend><label className="field"><span>Distribution *</span><select value={activity.duration.type} onChange={e=>updateActivity(index,{...activity,duration:blankDuration(e.target.value as Duration['type'])})}>
          <option value="fixed">Fixed</option><option value="uniform">Uniform</option><option value="triangular">Triangular</option><option value="beta-PERT">Beta-PERT</option>
        </select></label>
          {Object.entries(activity.duration).filter(([key])=>key!=='type').map(([key,value])=><Field key={key} label={key} required value={value} onChange={next=>updateActivity(index,{...activity,duration:{...activity.duration,[key]:next} as Duration})} help={key==='lambda'?'Explicit shape parameter; must be finite and greater than zero.':undefined}/>)}
          <small>Changing distribution clears its parameters. Enter all required values.</small>
        </fieldset>
        <div className="section-heading"><h3>Outcomes</h3><span>{activity.outcomes.length} branches</span></div>
        <div className="probability-total" role="status">Probability total: <strong>{probabilityTotal(activity.outcomes)}</strong><small>Editing a probability proportionally adjusts other valid probabilities in this activity. A single outcome stays at 1. Correct incomplete or invalid values first. Backend validation is unchanged.</small></div>
        <p className="hint">One outcome is selected per completed execution of this activity.</p>
        {activity.outcomes.map((o,oi)=>{
          const change=(updated:typeof o)=>updateActivity(index,{...activity,outcomes:activity.outcomes.map((old,i)=>i===oi?updated:old)});
          return <fieldset className={selection.outcome===oi?'outcome focused':'outcome'} key={oi} id={`outcome-editor-${oi}`}><legend>Outcome {oi+1}</legend>
            <Field label="Outcome ID" required value={o.id} onChange={id=>change({...o,id})}/>
            <Field label="Branch label" value={o.label} onChange={label=>change({...o,label})}/>
            <Field label="Probability" required value={o.probability} onChange={probability=>updateActivity(index,{...activity,outcomes:adjustProbability(activity.outcomes,oi,probability)})}/>
            <SelectField label="Target node" required value={o.target_node} options={model.nodes} onChange={target_node=>change({...o,target_node})}/>
            <QuantityEditor title="Produced items" value={o.produced_items} items={model.item_types} onChange={produced_items=>change({...o,produced_items})}/>
            <button className="danger subtle" onClick={()=>updateActivity(index,{...activity,outcomes:activity.outcomes.filter((_,i)=>i!==oi)})}>Remove outcome {oi+1}</button>
          </fieldset>;
        })}
        <button className="subtle" onClick={()=>updateActivity(index,{...activity,outcomes:[...activity.outcomes,blankOutcome(freshId('outcome',activity.outcomes))]})}>+ Add outcome</button>
      </>}
      <button className="danger delete" onClick={remove}>Delete {kind}</button>
    </div></aside>;
}

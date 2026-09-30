import type {Documentation} from '../types';

export default function DocumentationEditor({title,value,onChange,node=false}:{title:string;value?:Documentation|null;onChange:(value:Documentation)=>void;node?:boolean}) {
  const fields:([keyof Documentation,string])[]=node
    ? [['comments','Comments'],['assumptions','Assumptions'],['certainty','Certainty level'],['explanation','Explanation']]
    : [['rationale','Rationale'],['assumptions','Assumptions'],['references','Sources / references'],['certainty','Certainty level']];
  return <details className="documentation"><summary>{title}</summary>
    <p className="hint">Optional notes. Certainty is your description; it does not affect probabilities, durations, or simulation.</p>
    {fields.map(([key,label])=><label className="field" key={key}><span>{label}</span>
      <textarea aria-label={`${title}: ${label}`} rows={key==='certainty'?1:3} value={value?.[key]??''} onChange={e=>onChange({...value,[key]:e.target.value})}/>
    </label>)}
  </details>;
}

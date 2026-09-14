import type {Item, Quantities} from '../types';
export function Field({label,value,onChange,required=false,help}:{label:string;value:string;onChange:(value:string)=>void;required?:boolean;help?:string}) {
  return <label className="field"><span>{label}{required && <span className="required"> *</span>}</span>
    <input value={value} onChange={e=>onChange(e.target.value)} required={required} aria-required={required} spellCheck={false}/>{help && <small>{help}</small>}</label>;
}
export function SelectField({label,value,onChange,options,required=false}:{label:string;value:string;onChange:(value:string)=>void;options:{id:string;label:string}[];required?:boolean}) {
  return <label className="field"><span>{label}{required && <span className="required"> *</span>}</span><select value={value} onChange={e=>onChange(e.target.value)} required={required}>
    <option value="">Choose…</option>{value && !options.some(o=>o.id===value) && <option value={value}>{value} (missing)</option>}
    {options.map((o,i)=><option key={i} value={o.id}>{o.label || o.id} · {o.id}</option>)}</select></label>;
}
export function QuantityEditor({title,value,items,onChange}:{title:string;value:Quantities;items:Item[];onChange:(value:Quantities)=>void}) {
  const unused=items.filter(item=>!Object.hasOwn(value,item.id));
  return <fieldset className="quantities"><legend>{title}</legend>
    {Object.entries(value).map(([item,quantity],index)=><div className="quantity-row" key={index}>
      <SelectField label={`${title} item ${index+1}`} value={item} options={items.filter(i=>i.id===item || !Object.hasOwn(value,i.id))} required onChange={next=>{
        if(!next) return;
        onChange(Object.fromEntries(Object.entries(value).map(([key,q])=>[key===item?next:key,q])));
      }}/>
      <Field label={`Quantity ${index+1}`} value={quantity} required onChange={q=>onChange({...value,[item]:q})}/>
      <button className="icon danger" aria-label={`Remove ${title} item ${index+1}`} onClick={()=>onChange(Object.fromEntries(Object.entries(value).filter(([key])=>key!==item)))}>×</button>
    </div>)}
    {!Object.keys(value).length && <p className="hint">No items assigned.</p>}
    <button className="subtle" disabled={!unused.length} onClick={()=>onChange({...value,[unused[0].id]:''})}>+ Add {title.toLowerCase()} item</button>
    {!items.length && <small>Create an item in the Model panel first.</small>}
  </fieldset>;
}

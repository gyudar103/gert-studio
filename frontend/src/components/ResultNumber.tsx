import {useState} from 'react';
import BigNumber from 'bignumber.js';

export function compactNumber(value:string|number|bigint):string {
  const number=new BigNumber(String(value));
  return number.isFinite()?number.precision(3,BigNumber.ROUND_HALF_UP).toString():String(value);
}
export default function ResultNumber({value}:{value:string|number|bigint}) {
  const [expanded,setExpanded]=useState(false);
  return <button type="button" className="result-number" aria-pressed={expanded}
    title={expanded?'Show 3 significant digits':'Show full precision'} onClick={()=>setExpanded(v=>!v)}>
    {expanded?String(value):compactNumber(value)}
  </button>;
}

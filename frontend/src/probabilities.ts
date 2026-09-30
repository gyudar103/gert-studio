import BigNumber from 'bignumber.js';
import type {Outcome} from './types';

const Decimal=BigNumber.clone({DECIMAL_PLACES:40,ROUNDING_MODE:BigNumber.ROUND_DOWN});
const valid=(s:string)=>/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s.trim()) && new Decimal(s).isFinite() && new Decimal(s).gte(0) && new Decimal(s).lte(1);

export function adjustProbability(outcomes:Outcome[],index:number,text:string):Outcome[] {
  const next=outcomes.map((o,i)=>i===index?{...o,probability:text.trim()===''?null:text}:o);
  // Preserve incomplete drafts for editing and authoritative validation.
  // Filling the last unknown is still a draft edit: do not rewrite supplied values.
  if(outcomes.some(o=>o.probability===null)) return next;
  if(!valid(text)) return next;
  if(next.length===1) return [{...next[0],probability:'1'}];
  const others=outcomes.map((o,i)=>({o,i})).filter(({i})=>i!==index);
  if(others.some(({o})=>!valid(o.probability!))) return next;
  const total=others.reduce((sum,{o})=>sum.plus(o.probability!),new Decimal(0));
  const remainder=new Decimal(1).minus(text);
  let remaining=remainder;
  others.forEach(({o,i},position)=>{
    const value=position===others.length-1?remaining:total.isZero()?remainder.div(others.length):remainder.times(o.probability!).div(total);
    next[i]={...o,probability:value.toFixed()};remaining=remaining.minus(value);
  });
  return next;
}

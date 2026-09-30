import {describe,it,expect} from 'vitest';
import {act,fireEvent,render,renderHook,screen} from '@testing-library/react';
import BigNumber from 'bignumber.js';
import {adjustProbability} from './probabilities';
import {blankOutcome,emptyWorkspace} from './model';
import {useWorkspaceHistory} from './useWorkspaceHistory';
import ResultNumber,{compactNumber} from './components/ResultNumber';

const outcomes=(values:string[])=>values.map((probability,i)=>({...blankOutcome(String(i)),probability}));
describe('probability editing',()=>{
  it.each(['0','1','0.6','0.123456789012345678901'])('closes the decimal total exactly for %s',value=>{
    const result=adjustProbability(outcomes(['0.5','0.3','0.2']),0,value);
    expect(result.reduce((s,o)=>s.plus(o.probability!),new BigNumber(0)).toFixed()).toBe('1');
    expect(result[0].probability).toBe(value);
  });
  it('preserves proportions',()=>expect(adjustProbability(outcomes(['0.5','0.3','0.2']),0,'0.6').map(o=>o.probability)).toEqual(['0.6','0.24','0.16']));
  it.each([0,1,2])('keeps outcome %s fixed and does not mutate the input group',index=>{
    const original=outcomes(['0.5','0.3','0.2']);
    const before=structuredClone(original);
    const result=adjustProbability(original,index,'0.4000');
    expect(result[index].probability).toBe('0.4000');
    expect(original).toEqual(before);
    expect(result.reduce((s,o)=>s.plus(o.probability!),new BigNumber(0)).toFixed()).toBe('1');
    const other=[0,1,2].filter(i=>i!==index);
    // Cross multiplication compares ratios without introducing division rounding.
    const difference=new BigNumber(result[other[0]].probability!).times(original[other[1]].probability)
      .minus(new BigNumber(result[other[1]].probability!).times(original[other[0]].probability));
    expect(difference.abs().lte('1e-39')).toBe(true);
  });
  it('handles both endpoints and preserves zero-weight siblings',()=>{
    expect(adjustProbability(outcomes(['0.5','0.3','0.2']),0,'1').map(o=>o.probability)).toEqual(['1','0','0']);
    expect(adjustProbability(outcomes(['0.5','0.3','0.2']),0,'0').map(o=>o.probability)).toEqual(['0','0.6','0.4']);
    expect(adjustProbability(outcomes(['0.5','0','0.5']),0,'0.2').map(o=>o.probability)).toEqual(['0.2','0','0.8']);
  });
  it('resumes adjustment after an incomplete draft is corrected',()=>{
    const draft=adjustProbability(outcomes(['0.5','0.3','0.2']),0,'1e');
    expect(adjustProbability(draft,0,'0.6').map(o=>o.probability)).toEqual(['0.6','0.24','0.16']);
  });
  it('keeps invalid siblings visible for correction rather than treating them as zero',()=>{
    expect(adjustProbability(outcomes(['0.5','','bad']),0,'0.6').map(o=>o.probability)).toEqual(['0.6','','bad']);
    expect(adjustProbability(outcomes(['1']),0,'').map(o=>o.probability)).toEqual([null]);
  });
  it('allocates zero siblings equally with exact residual closure',()=>{
    expect(adjustProbability(outcomes(['1','0','0']),0,'0.4').map(o=>o.probability)).toEqual(['0.4','0.3','0.3']);
    const thirds=adjustProbability(outcomes(['1','0','0','0']),0,'0');
    expect(thirds.reduce((s,o)=>s.plus(o.probability!),new BigNumber(0)).toFixed()).toBe('1');
  });
  it('keeps a single valid outcome at one',()=>expect(adjustProbability(outcomes(['1']),0,'0')[0].probability).toBe('1'));
  it.each(['','-','abc','1e','-0.1','1.1','Infinity'])('preserves invalid drafts without rewriting siblings: %s',value=>{
    expect(adjustProbability(outcomes(['0.5','0.5']),0,value).map(o=>o.probability)).toEqual([value===''?null:value,'0.5']);
  });
});
describe('result presentation',()=>{
  it.each([['18.34125278','18.3'],['1.234567','1.23'],['0.0123456','0.0123'],['0.0123756','0.0124'],['0','0'],['-123.567','-124'],['123456789','123000000'],['999.5','1000'],['0.000000000123456','1.23e-10']])('rounds %s to %s',(value,expected)=>expect(compactNumber(value)).toBe(expected));
  it('toggles each value independently without changing the original precision',()=>{
    const value='18.341252780000000000000001';
    const original={value};
    render(<><ResultNumber value={original.value}/><ResultNumber value="1.234567"/></>);
    const buttons=screen.getAllByRole('button');
    for(let i=0;i<4;i++) {
      fireEvent.click(buttons[0]);expect(buttons[0]).toHaveTextContent(value);expect(buttons[0]).toHaveAttribute('aria-pressed','true');
      fireEvent.click(buttons[0]);expect(buttons[0].textContent?.trim()).toBe('18.3');
    }
    expect(buttons[1]).toHaveTextContent('1.23');expect(original.value).toBe(value);
  });
  it('preserves integers beyond Number precision when expanded',()=>{
    const value=123456789012345678901234567890n;
    render(<ResultNumber value={value}/>);
    const button=screen.getByRole('button');
    expect(button).toHaveTextContent('1.23e+29');
    fireEvent.click(button);expect(button.textContent?.trim()).toBe(String(value));
    fireEvent.click(button);expect(button).toHaveTextContent('1.23e+29');
  });
});
it('groups a drag and restores the full preceding layout atomically',()=>{
  const initial=emptyWorkspace();initial.layout.nodes=[{x:0,y:0}];
  const {result}=renderHook(()=>useWorkspaceHistory(()=>initial));
  act(()=>result.current.begin());
  for(const x of [10,20,30]) act(()=>result.current.setWorkspace(w=>({...w,layout:{...w.layout,nodes:[{x,y:0}]}})));
  act(()=>result.current.end());
  expect(result.current.canUndo).toBe(true);
  act(()=>{result.current.undo();});
  expect(result.current.workspace).toEqual(initial);expect(result.current.canUndo).toBe(false);
});
it('does not record no-op changes or empty gestures and resets history for a replacement model',()=>{
  const {result}=renderHook(()=>useWorkspaceHistory(emptyWorkspace));
  act(()=>result.current.setWorkspace(w=>structuredClone(w)));
  act(()=>{result.current.begin();result.current.end();});
  expect(result.current.canUndo).toBe(false);
  act(()=>result.current.setWorkspace(w=>({...w,model:{...w.model,project:{...w.model.project,name:'Changed'}}})));
  expect(result.current.canUndo).toBe(true);
  act(()=>result.current.reset(emptyWorkspace()));
  expect(result.current.canUndo).toBe(false);
  act(()=>{expect(result.current.undo()).toBe(false);});
});

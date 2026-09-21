import {useRef,useState} from 'react';
import type {Workspace} from './types';

// Snapshots include the mathematical model and its matching layout. Rendering and
// selection changes never enter history. Transactions group a complete gesture.
export function useWorkspaceHistory(initial:()=>Workspace) {
  const [workspace,render]=useState(initial);
  const current=useRef(workspace);
  const history=useRef<Workspace[]>([]);
  const transaction=useRef<Workspace|null>(null);
  function setWorkspace(update:Workspace|((w:Workspace)=>Workspace),record=true) {
    const previous=current.current;
    const next=typeof update==='function'?update(previous):update;
    if(JSON.stringify(previous)===JSON.stringify(next)) return;
    if(record && !transaction.current) history.current.push(previous);
    current.current=next;render(next);
  }
  function begin() {transaction.current??=current.current;}
  function end() {
    const previous=transaction.current;transaction.current=null;
    if(previous && JSON.stringify(previous)!==JSON.stringify(current.current)) history.current.push(previous);
    render({...current.current});
  }
  function undo() {
    if(transaction.current) end();
    const previous=history.current.pop();
    if(!previous) return false;
    current.current=previous;render(previous);return true;
  }
  function reset(next:Workspace) {history.current=[];transaction.current=null;current.current=next;render(next);}
  return {workspace,setWorkspace,begin,end,undo,reset,canUndo:history.current.length>0};
}

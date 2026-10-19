import {lazy,Suspense,useRef,useState} from 'react';
import Editor from './Editor';
const Tutorial=lazy(()=>import('./tutorial/Tutorial'));

export default function App() {
  const [learning,setLearning]=useState(false);
  const [opened,setOpened]=useState(false);
  const entry=useRef<HTMLButtonElement>(null);
  function close() {setLearning(false);requestAnimationFrame(()=>entry.current?.focus());}
  return <>
    <div hidden={learning} inert={learning} aria-label="My project workspace">
      <Editor active={!learning} navigation={<button ref={entry} onClick={()=>{setOpened(true);setLearning(true);}}>Learn / Tutorial</button>}/>
    </div>
    {opened && <div hidden={!learning} inert={!learning}><Suspense fallback={<p role="status">Opening tutorial…</p>}><Tutorial active={learning} close={close}/></Suspense></div>}
  </>;
}

import {useEffect,useRef,useState} from 'react';
import type {Activity,Diagnostic,GertNode,Item,Model,Selection,SettingsForm,SimulationResult,ValidationReport} from './types';
import {apiModel,diagnosticSelection,emptySettings,emptyWorkspace,freshId,newActivity,newNode} from './model';
import {ApiError,runSimulation,validateModel} from './api';
import {demoSettings,demoWorkspace} from './demo';
import {downloadModel,importModel} from './files';
import {useWorkspaceHistory} from './useWorkspaceHistory';
import Canvas from './components/Canvas';
import Properties from './components/Properties';
import {Field} from './components/Fields';
import {Diagnostics,Results} from './components/Analysis';

export default function App() {
  const {workspace,setWorkspace,begin,end,undo:restore,reset,canUndo}=useWorkspaceHistory(emptyWorkspace);
  const [settings,setSettings]=useState<SettingsForm>(emptySettings);
  const [selection,setSelection]=useState<Selection>(null);
  const [report,setReport]=useState<ValidationReport>();
  const [result,setResult]=useState<SimulationResult>();
  const [error,setError]=useState('');
  const [busy,setBusy]=useState<'validate'|'simulate'|'import'|null>(null);
  const [importDiagnostics,setImportDiagnostics]=useState(false);
  const fileInput=useRef<HTMLInputElement>(null);
  const lock=useRef(false);
  const [tab,setTab]=useState<'validation'|'results'>('validation');
  const [canvasVersion,setCanvasVersion]=useState(0);
  const [focus,setFocus]=useState(0);
  const model=workspace.model;
  function undo() {
    if(lock.current || !restore()) return;
    setSelection(null);setReport(undefined);setResult(undefined);setError('');setImportDiagnostics(false);
  }
  useEffect(()=>{
    const listener=(event:KeyboardEvent)=>{
      const target=event.target;
      if(target instanceof Element && target.closest('.settings')) return;
      if(event.defaultPrevented || event.altKey || event.shiftKey || !(event.ctrlKey||event.metaKey) || event.key.toLowerCase()!=='z' || lock.current || !canUndo) return;
      event.preventDefault();undo();
    };
    window.addEventListener('keydown',listener);return ()=>window.removeEventListener('keydown',listener);
  });
  function changeModel(update:(m:Model)=>Model) {
    setImportDiagnostics(false);
    setWorkspace(w=>({...w,model:update(w.model)}));setReport(undefined);setResult(undefined);setError('');
  }
  function addNode(type:GertNode['type']) {
    const id=freshId(type,model.nodes), index=model.nodes.length;
    changeModel(m=>({...m,nodes:[...m.nodes,newNode(type,id)]}));
    setWorkspace(w=>({...w,layout:{...w.layout,nodes:[...w.layout.nodes,{x:80+(index%3)*320,y:100+Math.floor(index/3)*190}]}}),false);setSelection({kind:'node',index});
  }
  function addActivity(source='',target='') {
    if(lock.current) return;
    const index=model.activities.length;
    changeModel(m=>({...m,activities:[...m.activities,newActivity(freshId('activity',m.activities),source,target)]}));
    const sourceIndex=model.nodes.findIndex(n=>n.id===source),point=workspace.layout.nodes[sourceIndex]||{x:0,y:index*160};
    setWorkspace(w=>({...w,layout:{...w.layout,activities:[...w.layout.activities,{x:point.x+230,y:point.y+90}]}}),false);setSelection({kind:'activity',index});
  }
  function updateNode(index:number,node:GertNode) {
    const old=model.nodes[index].id;
    if(node.id!==old && model.nodes.some((n,i)=>i!==index&&n.id===node.id)) {setError('That node ID is already used. Choose a unique ID.');return;}
    changeModel(m=>({...m,nodes:m.nodes.map((n,i)=>i===index?node:n),activities:m.activities.map(a=>({...a,source_node:a.source_node===old?node.id:a.source_node,outcomes:a.outcomes.map(o=>({...o,target_node:o.target_node===old?node.id:o.target_node}))}))}));
  }
  function updateActivity(index:number,activity:Activity) {changeModel(m=>({...m,activities:m.activities.map((a,i)=>i===index?activity:a)}));}
  function updateItem(index:number,item:Item) {
    const old=model.item_types[index].id;
    if(old!==item.id && (model.item_types.some((r,i)=>i!==index&&r.id===item.id) || model.nodes.some(n=>n.type==='start'&&Object.hasOwn(n.initial_inventory,item.id)) || model.activities.some(a=>Object.hasOwn(a.requirements,item.id)||a.outcomes.some(o=>Object.hasOwn(o.produced_items,item.id))))) {setError('That item ID is already used or referenced. Choose a different ID to avoid overwriting quantities.');return;}
    const rename=(q:Record<string,string>)=>Object.fromEntries(Object.entries(q).map(([key,value])=>[key===old?item.id:key,value]));
    changeModel(m=>({...m,item_types:m.item_types.map((r,i)=>i===index?item:r),nodes:m.nodes.map(n=>n.type==='start'?{...n,initial_inventory:rename(n.initial_inventory)}:n),activities:m.activities.map(a=>({...a,requirements:rename(a.requirements),outcomes:a.outcomes.map(o=>({...o,produced_items:rename(o.produced_items)}))}))}));
  }
  function remove() {
    if(!selection) return;
    const {kind,index}=selection;
    changeModel(m=>({...m,nodes:kind==='node'?m.nodes.filter((_,i)=>i!==index):m.nodes,activities:kind==='activity'?m.activities.filter((_,i)=>i!==index):m.activities,item_types:kind==='item'?m.item_types.filter((_,i)=>i!==index):m.item_types}));
    if(kind!=='item') setWorkspace(w=>({...w,layout:{...w.layout,[kind==='node'?'nodes':'activities']:w.layout[kind==='node'?'nodes':'activities'].filter((_,i)=>i!==index)}}),false);
    setSelection(null);
  }
  function replace(demo:boolean) {
    if((model.nodes.length||model.activities.length||model.item_types.length) && !window.confirm('Replace the current network? Unsaved edits will be lost.')) return;
    reset(demo?demoWorkspace():emptyWorkspace());setSettings(demo?{...demoSettings}:emptySettings());setSelection(null);setReport(undefined);setResult(undefined);setError('');setImportDiagnostics(false);setCanvasVersion(v=>v+1);
  }
  async function submit(kind:'validate'|'simulate') {
    if(lock.current) return;
    lock.current=true;setBusy(kind);setError('');setResult(undefined);setReport(undefined);setImportDiagnostics(false);
    try {
      if(kind==='validate') {setReport(await validateModel(apiModel(workspace)));setTab('validation');}
      else {const response=await runSimulation(apiModel(workspace),settings);setReport(response.validation);setResult(response);setTab('results');}
    } catch(e) {setError(e instanceof Error?e.message:'Request failed. Please retry.');if(e instanceof ApiError && e.diagnostics) setReport(e.diagnostics);setTab('validation');}
    finally {lock.current=false;setBusy(null);}
  }
  async function loadFile(file:File) {
    if(lock.current) return;
    lock.current=true;setBusy('import');setError('');
    try {
      const imported=await importModel(await file.text());
      if((model.nodes.length||model.activities.length||model.item_types.length) && !window.confirm('Replace the current network with this validated file? Export first to keep your edits.')) return;
      reset(imported.workspace);setSelection(null);setResult(undefined);
      setReport(imported.report);setImportDiagnostics(false);setTab('validation');setCanvasVersion(v=>v+1);
    } catch(e) {
      setError(e instanceof Error?e.message:'Could not read the file. Your current model is unchanged.');
      if(e instanceof ApiError && e.diagnostics) {setReport(e.diagnostics);setImportDiagnostics(true);setTab('validation');}
    } finally {lock.current=false;setBusy(null);}
  }
  function selectDiagnostic(d:Diagnostic) {const selected=diagnosticSelection(model,d.path,d.element_id);if(selected){setSelection(selected);setFocus(f=>f+1);}}
  return <div className="app">
    <header className="topbar"><div className="brand"><span className="brand-mark">G</span><div><h1>GERT Studio</h1><span>Model uncertainty. Understand outcomes.</span></div></div><div className="top-actions"><button disabled={!!busy||!canUndo} onClick={undo} title="Undo (Ctrl+Z / Cmd+Z)">Undo</button><span className="version">v0.1 · Modeling workspace</span><button disabled={!!busy} onClick={()=>void submit('validate')}>{busy==='validate'?'Validating…':'Validate'}</button><button className="primary" disabled={!!busy} onClick={()=>void submit('simulate')}>{busy==='simulate'?'Running simulation…':'Run Simulation'}</button></div></header>
    {error && <div role="alert" className="error-banner">{error}<button aria-label="Dismiss message" onClick={()=>setError('')}>×</button></div>}
    <main className="workspace">
      <fieldset className="editor-shell" disabled={!!busy}><aside className="sidebar" aria-label="Model and items">
        <div className="panel-heading">Model <span>01</span></div><div className="sidebar-content">
          <Field label="Project name" value={model.project.name} onChange={name=>changeModel(m=>({...m,project:{...m.project,name}}))}/>
          <details><summary>Project identity</summary><Field label="Project ID" required value={model.project.id} onChange={id=>changeModel(m=>({...m,project:{...m.project,id}}))}/></details>
          <div className="project-actions"><button onClick={()=>replace(false)}>New blank</button><button onClick={()=>replace(true)}>Load demo</button></div>
          <div className="project-actions"><button onClick={()=>fileInput.current?.click()}>Import JSON</button><button onClick={()=>downloadModel(workspace)}>Export JSON</button></div>
          <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Import model JSON" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file) void loadFile(file);}}/>
          <p className="hint">JSON saves the mathematical model. Layout is regenerated on import; run settings stay separate. Import requires backend validation. Export can also save unfinished edits.</p>
          <p className="hint">Demo: parallel build, integration, stochastic test and rework. Loading it supplies visible example values.</p>
          <div className="section-heading"><h2>Items</h2><button className="subtle" onClick={()=>{const index=model.item_types.length;changeModel(m=>({...m,item_types:[...m.item_types,{id:freshId('item',m.item_types),label:'New item'}]}));setSelection({kind:'item',index});}}>+ Item</button></div>
          {!model.item_types.length && <p className="hint">Add the things your activities consume and produce.</p>}
          <nav aria-label="Items">{model.item_types.map((r,i)=><button key={i} className={`list-entry ${selection?.kind==='item'&&selection.index===i?'active':''}`} onClick={()=>setSelection({kind:'item',index:i})}><span className="item-dot"/>{r.label||r.id}<small>{r.id}</small></button>)}</nav>
          <details open><summary>Network outline <span>{model.nodes.length} nodes · {model.activities.length} activities</span></summary><nav aria-label="Network outline">
            {model.nodes.map((n,i)=><button key={`n${i}`} className={`list-entry ${selection?.kind==='node'&&selection.index===i?'active':''}`} onClick={()=>{setSelection({kind:'node',index:i});setFocus(f=>f+1);}}><span className={`type-dot ${n.type}`}/>{n.label||n.id}<small>{n.type}</small></button>)}
            {model.activities.map((a,i)=><button key={`a${i}`} className={`list-entry ${selection?.kind==='activity'&&selection.index===i?'active':''}`} onClick={()=>{setSelection({kind:'activity',index:i});setFocus(f=>f+1);}}><span className="activity-dot"/>{a.label||a.id}<small>activity · {a.outcomes.length} outcomes</small></button>)}
          </nav></details>
          <details open className="settings"><summary>Simulation settings</summary><p className="hint">Separate from the model. All limits are required; the seed is optional.</p>
            {([['realizations','Realizations'],['seed','Seed (optional)'],['max_simulation_time','Max simulation time'],['max_activity_instances','Max activity instances'],['max_activity_completions','Max activity completions']] as const).map(([key,label])=><Field key={key} label={label} required={key!=='seed'} value={settings[key]} onChange={value=>{setSettings(s=>({...s,[key]:value}));setResult(undefined);setError('');}} help={key==='seed'?'Leave empty to generate a seed. The actual seed is returned with results.':undefined}/>)}
          </details>
        </div></aside></fieldset>
      <section className="canvas-panel" aria-label="Network canvas"><div className="canvas-toolbar"><div><strong>{model.project.name||'Untitled network'}</strong><small>Connect node handles to create activities</small></div><div className="creation-actions"><button disabled={!!busy} onClick={()=>addNode('start')}>+ Start</button><button disabled={!!busy} onClick={()=>addNode('state')}>+ State</button><button disabled={!!busy} onClick={()=>addNode('terminal')}>+ Terminal</button><button disabled={!!busy} onClick={()=>addActivity(selection?.kind==='node'?model.nodes[selection.index].id:'')}>+ Activity</button></div></div>
        <div className="canvas-area"><Canvas key={canvasVersion} workspace={workspace} selection={selection} focus={focus} select={setSelection} connect={addActivity} beginMove={begin} endMove={end} move={(kind,index,point)=>setWorkspace(w=>({...w,layout:{...w.layout,[kind]:w.layout[kind].map((p,i)=>i===index?point:p)}}))}/>
          {!model.nodes.length && <div className="canvas-empty"><span>YOUR NEXT PROJECT</span><h2>A network of possibilities.</h2><p>Add a Start node and define its items.<br/>Connect activities, then explore what happens.</p><button onClick={()=>replace(true)}>Explore the prototype demo →</button></div>}
          {busy && <div className="busy-overlay" role="status">{busy==='simulate'?'Simulating… results will appear when all realizations finish.':'Validating with the backend…'}</div>}
        </div><div className="canvas-legend"><span>● Start</span><span>■ State</span><span>◎ Terminal</span><span>▰ Activity → outcome branches</span><span>Drag to arrange · Scroll to zoom</span></div>
      </section>
      <fieldset className="editor-shell" disabled={!!busy}><Properties model={model} selection={selection} updateNode={updateNode} updateActivity={updateActivity} updateItem={updateItem} remove={remove}/></fieldset>
    </main>
    <section className="analysis-panel" aria-label="Analysis"><div className="analysis-heading"><div role="tablist" aria-label="Analysis views"><button role="tab" aria-selected={tab==='validation'} onClick={()=>setTab('validation')}>Validation {report?`· ${report.diagnostics.length}`:''}</button><button role="tab" aria-selected={tab==='results'} onClick={()=>setTab('results')}>Simulation results</button></div><small>Backend semantics · Exact decimal inputs</small></div>
      <div className="analysis-content">{tab==='validation'?(report?<>{importDiagnostics && <p className="analysis-empty">These diagnostics refer to the rejected import file. Your current network is unchanged.</p>}<Diagnostics report={report} onSelect={importDiagnostics?()=>{}:selectDiagnostic}/></>:<div className="analysis-empty"><strong>Ready when your model is.</strong><p>Validate to check connections, quantities and probabilities. Warnings will remain visible.</p></div>):result?<Results result={result} model={model}/>:<div className="analysis-empty"><strong>No simulation results yet.</strong><p>Enter simulation settings and choose Run Simulation. Model or settings edits clear previous results.</p></div>}</div>
    </section><footer>GERT Studio <span>Local workspace · Export JSON to keep your model before refreshing</span></footer>
  </div>;
}

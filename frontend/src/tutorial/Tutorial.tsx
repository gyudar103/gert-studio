import {createElement,useCallback,useEffect,useRef,useState} from 'react';
import type {KeyboardEvent} from 'react';
import Editor from '../Editor';
import {exactJSON} from '../api';
import {checkExercise,exercises,mathematicalInputs,practice,targetModel} from './exercises';
import type {EditorObservation,ExerciseId} from './exercises';
import {lessons} from './lessons';
import type {LessonNode} from './lessons';
import {readProgress,saveProgress} from './progress';
import './tutorial.css';

const lessonExercises:Partial<Record<number,ExerciseId>>={5:'deterministic',6:'deterministic',7:'snapshot',8:'pass-fail',9:'duration',10:'rework',11:'uncertainty',12:'replay',13:'concurrency',14:'synchronization',17:'demo',18:'documentation',19:'draft'};
const controlNames:Record<string,string>={'activity-inspection':'Select Inspection','node-ready':'Select Uninspected component','node-start':'Select Project start','activity-integrate':'Select Integrate',duration:'Distribution and parameters',probabilities:'Outcome probabilities',validate:'Validate',simulate:'Run Simulation',settings:'Simulation settings',export:'Export JSON',import:'Import JSON',analysis:'Results and validation',properties:'Properties','node-documentation':'Node documentation','duration-documentation':'Duration documentation','outcome-documentation':'Outcome documentation'};
// Render a fixed semantic tree. Arbitrary HTML/attributes from files never execute.
function Content({nodes}:{nodes:LessonNode[]}) {
  return <>{nodes.map((node,i)=>typeof node==='string'?node:createElement(node.tag,{key:i,...(node.tag==='a'&&node.href?{href:node.href,target:'_blank',rel:'noopener noreferrer'}:{} )},<Content nodes={node.children}/>))}</>;
}
export default function Tutorial({active,close}:{active:boolean;close:()=>void}) {
  const [index,setIndex]=useState(0);
  const [completed,setCompleted]=useState(readProgress);
  const [preset,setPreset]=useState<{id:ExerciseId;revision:number;data:ReturnType<typeof practice>}>();
  const [observation,setObservation]=useState<EditorObservation>();
  const [message,setMessage]=useState('');
  const [expanded,setExpanded]=useState(true);
  const [cutoff,setCutoff]=useState(false);
  const article=useRef<HTMLElement>(null);
  const title=useRef<HTMLHeadingElement>(null);
  const practiceRoot=useRef<HTMLDivElement>(null);
  const highlight=useRef<HTMLElement|null>(null);
  const nav=useRef<HTMLElement>(null);
  const lesson=lessons[index],exerciseId=index===10&&cutoff?'cutoff':lessonExercises[index],exercise=exerciseId?exercises[exerciseId]:undefined;
  const evidence=useRef<{lastResult?:EditorObservation['result']; signature?:string; replayVerified:boolean; singletonSeen:boolean}>({replayVerified:false,singletonSeen:false});
  const observe=useCallback((state:EditorObservation)=>{
    const e=evidence.current;
    if(state.result && state.result!==e.lastResult) {
      const signature=mathematicalInputs(state.workspace.model)+'\n'+exactJSON.stringify(state.result);
      e.replayVerified=!state.importedResult && e.signature===signature;
      e.signature=signature;
      const t=state.result.summary.terminal_duration;
      if(!state.importedResult && mathematicalInputs(state.workspace.model)===mathematicalInputs(targetModel('uncertainty')) && String(t.sample_size)==='1' && t.mean==='2' && t.standard_deviation==='0' && t.sample_standard_deviation===null && t.mean_standard_error===null && t.mean_confidence_interval===null) e.singletonSeen=true;
    }
    e.lastResult=state.result;
    setObservation({...state,replayVerified:!!state.result&&e.replayVerified,singletonSeen:e.singletonSeen});
  },[]);
  useEffect(()=>{saveProgress(completed);},[completed]);
  useEffect(()=>{if(active) title.current?.focus();},[active]);
  useEffect(()=>()=>{highlight.current?.classList.remove('tutorial-highlight');},[]);
  function choose(next:number,focusArticle=true) {
    setIndex(next);setMessage('');setExpanded(lessonExercises[next]===undefined);setCutoff(false);
    if(focusArticle) requestAnimationFrame(()=>article.current?.focus());
  }
  function navigate(event:KeyboardEvent<HTMLElement>) {
    const keys:Record<string,number>={ArrowDown:Math.min(lessons.length-1,index+1),ArrowRight:Math.min(lessons.length-1,index+1),ArrowUp:Math.max(0,index-1),ArrowLeft:Math.max(0,index-1),Home:0,End:lessons.length-1};
    if(!(event.key in keys)) return;
    event.preventDefault();const next=keys[event.key];choose(next,false);
    (nav.current?.querySelectorAll('button')[next] as HTMLButtonElement|undefined)?.focus();
  }
  function mark(id:string,done:boolean) {setCompleted(old=>done?[...new Set([...old,id])]:old.filter(v=>v!==id));}
  function load() {
    if(!exerciseId || observation?.busy) return;
    if(preset && !window.confirm('Replace only the tutorial practice network? Export JSON first to keep your practice edits. Your project is safe.')) return;
    highlight.current?.classList.remove('tutorial-highlight');setObservation(undefined);setMessage('');
    evidence.current={replayVerified:false,singletonSeen:false};
    setPreset(old=>({id:exerciseId,revision:(old?.revision??0)+1,data:practice(exerciseId)}));
  }
  function guide(control:string) {
    const root=practiceRoot.current;
    // Select through the existing editor so Properties is the actual selected element.
    const select=(id:string)=>root?.querySelector<HTMLButtonElement>(`[data-control="${id}"]`)?.click();
    if(control==='node-documentation') select('node-ready');
    if(['duration','probabilities','duration-documentation','outcome-documentation'].includes(control)) select('activity-inspection');
    requestAnimationFrame(()=>{
      highlight.current?.classList.remove('tutorial-highlight');
      const element=root?.querySelector<HTMLElement>(`[data-control="${control}"]`);
      if(!element) {setMessage('Load the practice starting point, or select the matching element in Network outline first.');return;}
      let parent:HTMLElement|null=element;
      while(parent && parent!==root) {if(parent instanceof HTMLDetailsElement) parent.open=true;parent=parent.parentElement;}
      element.scrollIntoView({block:'center',behavior:'instant'});
      element.classList.add('tutorial-highlight');highlight.current=element;
      const focusable=element.matches('button,input,select')?element:element.querySelector<HTMLElement>('summary,button,input,select,textarea');
      if(focusable) focusable.focus({preventScroll:true});else {element.tabIndex=-1;element.focus({preventScroll:true});}
      setMessage(`Highlighted: ${controlNames[control]||control}.`);
    });
  }
  return <div className="tutorial-page">
    <header className="tutorial-header"><div><h1 ref={title} tabIndex={-1}>Learn GERT Studio</h1><p>Your project stays in memory. Practice here uses its own network; export before refreshing.</p></div><button onClick={close}>Return to my project</button></header>
    <section className="tutorial-guide" aria-label="Interactive tutorial">
      <aside className="lesson-sidebar"><label htmlFor="lesson-progress">{completed.length} of {lessons.length} lessons completed</label><progress id="lesson-progress" value={completed.length} max={lessons.length}/>
        <nav ref={nav} aria-label="Tutorial lessons" onKeyDown={navigate}>{lessons.map((l,i)=><button key={l.id} aria-current={index===i?'step':undefined} onClick={()=>choose(i)}><span aria-hidden="true">{completed.includes(l.id)?'✓':'○'}</span> {l.title}{completed.includes(l.id)&&<span className="sr-only"> · Completed</span>}</button>)}</nav>
        <button onClick={()=>{if(window.confirm('Reset tutorial completion records? Your project and practice network will stay in memory.')) {setCompleted([]);setMessage('Tutorial progress reset.');}}}>Reset tutorial progress</button>
      </aside>
      <article ref={article} tabIndex={-1} aria-label={lesson.title} className="lesson-body">
        <h2>{lesson.title}</h2>
        <div className="lesson-reference"><button aria-expanded={expanded} aria-controls="tutorial-lesson-text" onClick={()=>setExpanded(v=>!v)}>{expanded?'Hide lesson text':'Show lesson text'}</button><div id="tutorial-lesson-text" className="lesson-text" hidden={!expanded}><Content nodes={lesson.content}/></div></div>
        {exercise?<section aria-label="Guided exercise" className="tutorial-exercise"><h3>{exercise.title}</h3>{index===10&&<button aria-pressed={cutoff} onClick={()=>{setCutoff(v=>!v);setMessage('');}}>{cutoff?'Practice rework with horizon 100':'Practice horizon 7 cutoff experiment'}</button>}<p>{exercise.instruction}</p><p className="hint">{preset?`Current practice: ${exercises[preset.id].title}. Lesson navigation keeps it intact.`:'Load a starting point to open the real editor below.'} Starting points contain visible teaching examples.</p>
          <div className="lesson-actions"><button disabled={observation?.busy} onClick={load}>Load practice starting point</button><button disabled={!preset||observation?.busy} className="primary" onClick={()=>{const check=checkExercise(exercise.id,observation);setMessage(check.message);if(check.complete) mark(lesson.id,true);}}>Check exercise</button></div>
          <div className="control-guides" role="group" aria-label="Find a real editor control">{exercise.controls.map(control=><button key={control} disabled={!preset} onClick={()=>guide(control)}>Find control: {controlNames[control]||control}</button>)}</div>
          <p className="hint">A checkpoint checks current inputs against validation and simulation results. Completion records an accomplishment; later edits can change the model. Export keeps models and snapshots; tutorial progress stores neither.</p>
        </section>:<><p>Read this lesson, then record your progress. Practical lessons use the real editor below.</p><label className="reading-complete"><input type="checkbox" checked={completed.includes(lesson.id)} onChange={e=>mark(lesson.id,e.target.checked)}/> Mark reading complete</label></>}
        <p role="status" className="tutorial-status">{message|| (completed.includes(lesson.id)?'Lesson completed.':'')}</p>
        <div className="lesson-actions"><button disabled={index===0} onClick={()=>choose(index-1)}>Previous lesson</button><button disabled={index===lessons.length-1} onClick={()=>choose(index+1)}>Next lesson</button></div>
      </article>
    </section>
    <div className="practice-heading"><h2>Tutorial practice workspace</h2><p>Export JSON to keep practice edits. Return to my project preserves your original work.</p></div>
    <div ref={practiceRoot} className="tutorial-practice">{preset?<Editor key={preset.revision} active={active} tutorial initialWorkspace={()=>preset.data.workspace} initialSettings={()=>preset.data.settings} observe={observe} navigation={<button onClick={()=>{article.current?.scrollIntoView({block:'start'});article.current?.focus();}}>Back to lesson</button>}/>:<p className="practice-placeholder">Choose a practical lesson and load its starting point. Your project is waiting when you return.</p>}</div>
  </div>;
}

import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {CSSProperties} from 'react';

export const LAYOUT_KEY='gert-studio:panel-layout:v1';
export const DEFAULT_PANELS={sidebar:245,properties:350,analysis:260};
export type Panel=keyof typeof DEFAULT_PANELS;
type Sizes=typeof DEFAULT_PANELS;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(value,max));
function validSizes(saved:unknown):saved is Sizes & {version:1} {
  if(!saved || typeof saved!=='object') return false;
  const value=saved as Record<string,unknown>;
  return value.version===1 && Object.keys(DEFAULT_PANELS).every(key=>typeof value[key]==='number' && Number.isFinite(value[key]) && value[key]>0);
}

function readSizes():Sizes {
  try {
    const saved=JSON.parse(localStorage.getItem(LAYOUT_KEY)||'null');
    if(validSizes(saved)) {
      return {sidebar:saved.sidebar,properties:saved.properties,analysis:saved.analysis};
    }
  } catch { /* Storage can be unavailable or contain an obsolete preference. */ }
  return {...DEFAULT_PANELS};
}

export function constrainPanels(sizes:Sizes,width:number,height:number):Sizes {
  const sidebar=clamp(sizes.sidebar,180,Math.max(180,width-260-360-16));
  const properties=clamp(sizes.properties,260,Math.max(260,width-sidebar-360-16));
  return {sidebar,properties,analysis:clamp(sizes.analysis,180,Math.max(180,height-440-8))};
}

// These preferences deliberately live outside Workspace and its model Undo history.
export function useResizableLayout() {
  const ref=useRef<HTMLDivElement>(null);
  const [preferences,setPreferences]=useState(readSizes);
  const edited=useRef(false);
  const latest=useRef(preferences);
  latest.current=preferences;
  const persistNative=useRef<((value:Sizes)=>void)|null>(null);
  useEffect(()=>{
    // Only the portable host advertises this endpoint. Ordinary browser builds
    // retain localStorage without probing unrelated API routes.
    if(!document.querySelector('meta[name="gert-panel-preferences"][content="native-v1"]')) return;
    const endpoint='/api/ui-preferences/panel-layout';
    let active=true,ready=false,saving=false,pending:Sizes|null=null;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const flush=async()=>{
      if(!ready || saving || !pending) return;
      saving=true;
      const value=pending;pending=null;
      try {
        await fetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:1,...value}),keepalive:true});
      } catch { /* Native persistence is best effort; local preferences still work. */ }
      finally {saving=false;if(pending) void flush();}
    };
    const queue=(value:Sizes)=>{
      pending=value;
      clearTimeout(timer);
      timer=setTimeout(()=>void flush(),150);
    };
    persistNative.current=queue;
    void (async()=>{
      try {
        const response=await fetch(endpoint,{cache:'no-store'});
        if(!response.ok || !active) return;
        const body=await response.json() as {layout:unknown};
        if(!active) return;
        ready=true;
        if(!edited.current && validSizes(body.layout)) {
          pending=null;
          setPreferences({sidebar:body.layout.sidebar,properties:body.layout.properties,analysis:body.layout.analysis});
        } else queue(latest.current);
      } catch { /* Missing/unavailable native storage never blocks the editor. */ }
    })();
    const finish=()=>{clearTimeout(timer);if(edited.current) pending=latest.current;void flush();};
    window.addEventListener('pagehide',finish);
    return ()=>{active=false;persistNative.current=null;window.removeEventListener('pagehide',finish);finish();};
  },[]);
  const [bounds,setBounds]=useState({width:window.innerWidth,height:Math.max(720,window.innerHeight-126)});
  useLayoutEffect(()=>{
    const measure=()=>{
      const rect=ref.current?.getBoundingClientRect();
      setBounds({width:rect?.width||window.innerWidth,height:Math.max(720,window.innerHeight-(rect?.top||86)-40)});
    };
    measure();
    window.addEventListener('resize',measure);
    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(measure);
    if(ref.current) observer?.observe(ref.current);
    return ()=>{window.removeEventListener('resize',measure);observer?.disconnect();};
  },[]);
  useEffect(()=>{
    try { localStorage.setItem(LAYOUT_KEY,JSON.stringify({version:1,...preferences})); }
    catch { /* Resizing remains available when browser storage is blocked/full. */ }
    persistNative.current?.(preferences);
  },[preferences]);
  const sizes=constrainPanels(preferences,bounds.width,bounds.height);
  const limits={sidebar:{min:180,max:Math.max(180,bounds.width-sizes.properties-360-16)},properties:{min:260,max:Math.max(260,bounds.width-sizes.sidebar-360-16)},analysis:{min:180,max:bounds.height-448}};
  const resize=(panel:Panel,value:number)=>{edited.current=true;setPreferences({...sizes,[panel]:clamp(value,limits[panel].min,limits[panel].max)});};
  const reset=()=>{edited.current=true;setPreferences({...DEFAULT_PANELS});};
  const style={'--sidebar-width':`${sizes.sidebar}px`,'--properties-width':`${sizes.properties}px`,'--analysis-height':`${sizes.analysis}px`,'--modeling-height':`${bounds.height-sizes.analysis-8}px`} as CSSProperties;
  return {ref,style,sizes,limits,resize,reset,desktop:bounds.width>900};
}

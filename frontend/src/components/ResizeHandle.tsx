import {useRef} from 'react';

type Props={label:string;orientation:'vertical'|'horizontal';value:number;min:number;max:number;reverse?:boolean;controls:string;onResize:(value:number)=>void};

export default function ResizeHandle({label,orientation,value,min,max,reverse=false,controls,onResize}:Props) {
  const drag=useRef<{id:number;origin:number;value:number}|null>(null);
  const direction=reverse?-1:1;
  return <div className={`resize-handle ${orientation}`} role="separator" tabIndex={0}
    aria-label={label} aria-orientation={orientation} aria-controls={controls}
    aria-valuemin={Math.round(min)} aria-valuemax={Math.round(max)} aria-valuenow={Math.round(value)} aria-valuetext={`${Math.round(value)} pixels`}
    onPointerDown={event=>{
      if(event.button!==0 || !event.isPrimary) return;
      event.preventDefault();event.stopPropagation();event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current={id:event.pointerId,origin:orientation==='vertical'?event.clientX:event.clientY,value};
    }}
    onPointerMove={event=>{
      if(drag.current?.id!==event.pointerId) return;
      event.preventDefault();
      onResize(drag.current.value+direction*((orientation==='vertical'?event.clientX:event.clientY)-drag.current.origin));
    }}
    onPointerUp={event=>{
      if(drag.current?.id!==event.pointerId) return;
      drag.current=null;
      if(event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={()=>{drag.current=null;}}
    onLostPointerCapture={()=>{drag.current=null;}}
    onKeyDown={event=>{
      if(event.ctrlKey||event.metaKey||event.altKey) return;
      const increase=orientation==='vertical'?'ArrowRight':'ArrowDown';
      const decrease=orientation==='vertical'?'ArrowLeft':'ArrowUp';
      let next:number;
      if(event.key==='Home') next=min;
      else if(event.key==='End') next=max;
      else if(event.key===increase||event.key===decrease) next=value+(event.key===increase?1:-1)*direction*(event.shiftKey?40:10);
      else return;
      event.preventDefault();event.stopPropagation();onResize(Math.max(min,Math.min(next,max)));
    }}/ >;
}

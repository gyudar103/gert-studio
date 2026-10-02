import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {act,fireEvent,render,renderHook,screen,waitFor} from '@testing-library/react';
import App from './App';
import {constrainPanels,DEFAULT_PANELS,LAYOUT_KEY,useResizableLayout} from './useResizableLayout';

vi.mock('./components/Canvas',()=>({default:()=> <div>Canvas projection</div>}));
const handle=(name:string)=>screen.getByRole('separator',{name});
beforeEach(()=>{
  localStorage.clear();
  vi.spyOn(window,'confirm').mockReturnValue(true);
  vi.stubGlobal('innerWidth',1440);vi.stubGlobal('innerHeight',1000);
});
afterEach(()=>{document.querySelector('meta[name="gert-panel-preferences"]')?.remove();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});

function nativeHost() {
  const marker=document.createElement('meta');marker.name='gert-panel-preferences';marker.content='native-v1';document.head.append(marker);
}

describe('Studio panel preferences',()=>{
  it('uses browser storage without probing the native API in ordinary builds',async()=>{
    vi.useFakeTimers();const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
    const {result,unmount}=renderHook(()=>useResizableLayout());
    act(()=>result.current.resize('sidebar',280));
    await act(async()=>vi.advanceTimersByTimeAsync(1000));
    expect(JSON.parse(localStorage.getItem(LAYOUT_KEY)!)).toEqual({version:1,...DEFAULT_PANELS,sidebar:280});
    act(()=>result.current.reset());unmount();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('keeps reset performed while native JSON hydration is delayed',async()=>{
    nativeHost();vi.useFakeTimers();let hydrate!:(body:unknown)=>void;
    const fetchMock=vi.fn().mockResolvedValueOnce({ok:true,json:()=>new Promise(resolve=>{hydrate=resolve;})}).mockResolvedValue({ok:true});
    vi.stubGlobal('fetch',fetchMock);
    localStorage.setItem(LAYOUT_KEY,JSON.stringify({version:1,sidebar:280,properties:420,analysis:300}));
    const {result,unmount}=renderHook(()=>useResizableLayout());
    await act(async()=>{});
    act(()=>result.current.reset());
    await act(async()=>hydrate({layout:{version:1,sidebar:500,properties:450,analysis:350}}));
    expect(result.current.sizes).toEqual(DEFAULT_PANELS);
    await act(async()=>vi.advanceTimersByTimeAsync(150));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({version:1,...DEFAULT_PANELS});
    unmount();
  });
  it('coalesces resize and reset behind one outstanding native write',async()=>{
    nativeHost();vi.useFakeTimers();let finishSave!:(response:unknown)=>void;
    const fetchMock=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({layout:null})})
      .mockImplementationOnce(()=>new Promise(resolve=>{finishSave=resolve;})).mockResolvedValue({ok:true});
    vi.stubGlobal('fetch',fetchMock);
    const {result,unmount}=renderHook(()=>useResizableLayout());
    await act(async()=>{});
    act(()=>result.current.resize('sidebar',280));
    await act(async()=>vi.advanceTimersByTimeAsync(150));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).sidebar).toBe(280);
    act(()=>result.current.resize('sidebar',300));
    act(()=>result.current.resize('properties',400));
    act(()=>result.current.reset());
    await act(async()=>vi.advanceTimersByTimeAsync(500));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async()=>finishSave({ok:true}));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({version:1,...DEFAULT_PANELS});
    await act(async()=>vi.advanceTimersByTimeAsync(500));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    unmount();
  });
  it('provides three accessible bounded keyboard splitters and reset',()=>{
    render(<App/>);
    expect(screen.getAllByRole('separator')).toHaveLength(3);
    const sidebar=handle('Resize model sidebar'),properties=handle('Resize properties panel'),analysis=handle('Resize analysis panel');
    expect(sidebar).toHaveAttribute('aria-orientation','vertical');
    expect(analysis).toHaveAttribute('aria-orientation','horizontal');
    expect(sidebar).toHaveAttribute('tabindex','0');
    fireEvent.keyDown(sidebar,{key:'ArrowRight'});expect(sidebar).toHaveAttribute('aria-valuenow','255');
    fireEvent.keyDown(properties,{key:'ArrowLeft',shiftKey:true});expect(properties).toHaveAttribute('aria-valuenow','390');
    fireEvent.keyDown(analysis,{key:'ArrowUp'});expect(analysis).toHaveAttribute('aria-valuenow','270');
    fireEvent.keyDown(sidebar,{key:'Home'});expect(sidebar).toHaveAttribute('aria-valuenow','180');
    fireEvent.keyDown(sidebar,{key:'ArrowLeft'});expect(sidebar).toHaveAttribute('aria-valuenow','180');
    fireEvent.keyDown(analysis,{key:'End'});expect(analysis.getAttribute('aria-valuenow')).toBe(analysis.getAttribute('aria-valuemax'));
    fireEvent.click(screen.getByRole('button',{name:'Reset layout'}));
    expect(sidebar).toHaveAttribute('aria-valuenow','245');expect(properties).toHaveAttribute('aria-valuenow','350');expect(analysis).toHaveAttribute('aria-valuenow','260');
  });
  it('persists across mounts and does not enter model undo',()=>{
    const first=render(<App/>);
    fireEvent.click(screen.getByRole('button',{name:'+ State'}));
    fireEvent.keyDown(handle('Resize model sidebar'),{key:'ArrowRight'});
    fireEvent.keyDown(handle('Resize properties panel'),{key:'ArrowLeft'});
    fireEvent.keyDown(handle('Resize analysis panel'),{key:'ArrowUp'});
    fireEvent.keyDown(handle('Resize model sidebar'),{key:'z',ctrlKey:true});
    expect(screen.getByRole('button',{name:'Undo'})).toBeDisabled();
    expect(screen.getByRole('navigation',{name:'Network outline'})).toBeEmptyDOMElement();
    expect(handle('Resize model sidebar')).toHaveAttribute('aria-valuenow','255');
    first.unmount();render(<App/>);
    expect(handle('Resize model sidebar')).toHaveAttribute('aria-valuenow','255');
    expect(handle('Resize properties panel')).toHaveAttribute('aria-valuenow','360');
    expect(handle('Resize analysis panel')).toHaveAttribute('aria-valuenow','270');
  });
  it.each(['{','null','{"version":2,"sidebar":999}', '{"version":1,"sidebar":"260","properties":350,"analysis":260}', '{"version":1,"sidebar":-10,"properties":350,"analysis":260}'])('ignores malformed or obsolete persisted preferences: %s',saved=>{
    localStorage.setItem(LAYOUT_KEY,saved);render(<App/>);
    expect(handle('Resize model sidebar')).toHaveAttribute('aria-valuenow','245');
  });
  it('clamps oversized saved values and window changes and disables splitters when stacked',()=>{
    localStorage.setItem(LAYOUT_KEY,JSON.stringify({version:1,sidebar:1e6,properties:1e6,analysis:1e6}));
    render(<App/>);
    vi.stubGlobal('innerWidth',920);vi.stubGlobal('innerHeight',600);fireEvent(window,new Event('resize'));
    const sidebar=handle('Resize model sidebar'),properties=handle('Resize properties panel'),analysis=handle('Resize analysis panel');
    expect(Number(sidebar.getAttribute('aria-valuenow'))+Number(properties.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(920-376);
    expect(analysis).toHaveAttribute('aria-valuenow','272');
    vi.stubGlobal('innerWidth',500);fireEvent(window,new Event('resize'));expect(screen.queryAllByRole('separator')).toHaveLength(0);
    vi.stubGlobal('innerWidth',1440);fireEvent(window,new Event('resize'));expect(screen.getAllByRole('separator')).toHaveLength(3);
    expect(constrainPanels(DEFAULT_PANELS,920,720)).toEqual({sidebar:245,properties:299,analysis:260});
  });
  it('works when storage reads and writes throw',()=>{
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('denied');});
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('full');});
    render(<App/>);fireEvent.keyDown(handle('Resize model sidebar'),{key:'ArrowRight'});
    expect(handle('Resize model sidebar')).toHaveAttribute('aria-valuenow','255');
  });
  it('hydrates native preferences even when the new origin has empty browser storage',async()=>{
    nativeHost();const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({layout:{version:1,sidebar:280,properties:420,analysis:300}})});vi.stubGlobal('fetch',fetchMock);
    render(<App/>);
    await waitFor(()=>expect(handle('Resize model sidebar')).toHaveAttribute('aria-valuenow','280'));
    expect(handle('Resize properties panel')).toHaveAttribute('aria-valuenow','420');
    expect(handle('Resize analysis panel')).toHaveAttribute('aria-valuenow','300');
    await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({version:1,sidebar:280,properties:420,analysis:300});
  });
  it('keeps edits made during hydration and serializes coalesced native saves',async()=>{
    nativeHost();let hydrate!:(response:unknown)=>void,finishSave!:(response:unknown)=>void;
    const fetchMock=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{hydrate=resolve;})).mockImplementationOnce(()=>new Promise(resolve=>{finishSave=resolve;})).mockResolvedValue({ok:true});vi.stubGlobal('fetch',fetchMock);
    render(<App/>);fireEvent.keyDown(handle('Resize model sidebar'),{key:'ArrowRight'});
    await act(async()=>hydrate({ok:true,json:async()=>({layout:{version:1,sidebar:500,properties:350,analysis:260}})}));
    expect(handle('Resize model sidebar')).toHaveAttribute('aria-valuenow','255');
    await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.keyDown(handle('Resize model sidebar'),{key:'ArrowRight'});
    fireEvent.keyDown(handle('Resize model sidebar'),{key:'ArrowRight'});
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async()=>finishSave({ok:true}));
    await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).sidebar).toBe(275);
  });
  it.each([404,503])('retains local resizing if the native bridge returns %s',async status=>{
    nativeHost();const fetchMock=vi.fn().mockResolvedValue({ok:false,status});vi.stubGlobal('fetch',fetchMock);
    render(<App/>);await act(async()=>{});
    fireEvent.keyDown(handle('Resize model sidebar'),{key:'ArrowRight'});
    expect(handle('Resize model sidebar')).toHaveAttribute('aria-valuenow','255');expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

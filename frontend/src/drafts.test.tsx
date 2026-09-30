import {beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,within} from '@testing-library/react';
import App from './App';
import {demoWorkspace} from './demo';
import {adjustProbability} from './probabilities';
import {blankDuration,blankOutcome,missingInputs,newActivity} from './model';
import {exportModel,importModel} from './files';
import {graphView} from './graph';

vi.mock('./components/Canvas',()=>({default:()=> <div>Canvas projection</div>}));
const fetchMock=vi.fn();
beforeEach(()=>{
  vi.stubGlobal('fetch',fetchMock);fetchMock.mockReset();
  fetchMock.mockResolvedValue({ok:true,status:200,text:async()=>'{"valid":true,"draft_valid":true,"simulation_ready":false,"diagnostics":[]}'});
  vi.spyOn(window,'confirm').mockReturnValue(true);
});
const click=(name:string)=>fireEvent.click(screen.getByRole('button',{name}));
const change=(label:string,value:string)=>fireEvent.change(screen.getByLabelText(label),{target:{value}});
const select=(name:RegExp)=>fireEvent.click(within(screen.getByRole('navigation',{name:'Network outline'})).getByRole('button',{name}));

it('preserves nulls on partial probability edits including the last unknown',()=>{
  const values=['0.7',null,null].map((probability,i)=>({...blankOutcome(String(i)),probability}));
  expect(adjustProbability(values,0,'0.6').map(o=>o.probability)).toEqual(['0.6',null,null]);
  const two=adjustProbability(values,1,'0.2');
  expect(two.map(o=>o.probability)).toEqual(['0.7','0.2',null]);
  const full=adjustProbability(two,2,'0.3');
  expect(full.map(o=>o.probability)).toEqual(['0.7','0.2','0.3']); // supplied invalid total stays visible
  expect(adjustProbability(full,0,'0.5').map(o=>o.probability)).toEqual(['0.5','0.2','0.3']);
  expect(adjustProbability(full,1,'').map(o=>o.probability)).toEqual(['0.7',null,'0.3']);
  expect(adjustProbability([blankOutcome('single')],0,'0.4')[0].probability).toBe('0.4');
  expect(values.map(o=>o.probability)).toEqual(['0.7',null,null]);
});

it('round trips documentation, null distribution, partial parameters and probability through import/export',async()=>{
  const w=demoWorkspace();
  const notes={comments:'Review 0.1',assumptions:'One request',certainty:'Low',explanation:'Trial pending',rationale:'Workshop',references:'Report 12'};
  w.model.nodes[0].documentation=notes;
  w.model.activities[0].duration=null;
  w.model.activities[0].duration_documentation=notes;
  w.model.activities[0].outcomes[0].probability=null;
  w.model.activities[0].outcomes[0].documentation=notes;
  w.model.activities[1].duration={...blankDuration('beta-PERT'),min:'0.000000000000000000001'} as typeof w.model.activities[1]['duration'];
  const text=exportModel(w);
  expect(text).toContain('"duration": null');
  const loaded=await importModel(text);
  expect(loaded.workspace.model).toEqual(w.model);
  expect(exportModel(loaded.workspace)).toBe(text);
  expect(loaded.report.simulation_ready).toBe(false);
});

it('graph projection shows unknowns and excludes long documentation',()=>{
  const w=demoWorkspace();
  w.model.nodes[0].documentation={comments:'Private lengthy review notes'};
  w.model.activities[0].duration=null;
  w.model.activities[0].outcomes[0].probability=null;
  const view=graphView(w,null);
  expect(view.nodes.find(n=>n.id==='a:0')?.data).toMatchObject({incomplete:true,subtitle:'Unknown duration · 1 outcome'});
  expect(view.edges.find(e=>e.id==='outcome:0:0')?.label).toContain('p=?');
  expect(JSON.stringify(view)).not.toContain('Private lengthy review notes');
  expect(newActivity('a').duration).toBeNull();
  expect(missingInputs(w.model).map(d=>d.path)).toContainEqual(['activities',0,'duration']);
});

it('edits node documentation, navigates to activity notes, retains them, and undoes notes',()=>{
  render(<App/>);click('Load demo');select(/Project start/);
  fireEvent.click(screen.getByText('Node documentation',{exact:true}));
  change('Node documentation: Comments','Request review');
  change('Node documentation: Certainty level','Unverified');
  click('Activity: Mechanical design');
  fireEvent.click(screen.getByText('Duration documentation',{exact:true}));
  change('Duration documentation: Rationale','Trial estimate');
  change('Duration documentation: Sources / references','Trial report');
  fireEvent.click(screen.getByText('Outcome 1 documentation',{exact:true}));
  change('Outcome 1 documentation: Assumptions','No rework');
  select(/Project start/);
  expect(screen.getByLabelText('Node documentation: Comments')).toHaveValue('Request review');
  expect(screen.getByLabelText('Node documentation: Certainty level')).toHaveValue('Unverified');
  click('Activity: Mechanical design');
  expect(screen.getByLabelText('Duration documentation: Rationale')).toHaveValue('Trial estimate');
  expect(screen.getByLabelText('Outcome 1 documentation: Assumptions')).toHaveValue('No rework');
  click('Undo');select(/Mechanical design/);
  expect(screen.getByLabelText('Outcome 1 documentation: Assumptions')).toHaveValue('');
  expect(screen.getByLabelText('Duration documentation: Sources / references')).toHaveValue('Trial report');
});

it('unknown parameters block simulation and undo restores readiness and exact zero',()=>{
  render(<App/>);click('Load demo');select(/Mechanical design/);
  fireEvent.change(screen.getByLabelText(/Distribution/),{target:{value:'fixed'}});
  expect(screen.getByRole('button',{name:'Run Simulation'})).toBeDisabled();
  expect(screen.getByText('Activity mechanical: enter duration value')).toBeVisible();
  fireEvent.change(screen.getByLabelText(/^value/),{target:{value:'0'}});
  expect(screen.getByRole('button',{name:'Run Simulation'})).toBeEnabled();
  fireEvent.change(screen.getByLabelText(/^value/),{target:{value:''}});
  expect(screen.getByRole('button',{name:'Run Simulation'})).toBeDisabled();
  click('Undo');select(/Mechanical design/);
  expect(screen.getByLabelText(/^value/)).toHaveValue('0');
  expect(screen.getByRole('button',{name:'Run Simulation'})).toBeEnabled();
  fireEvent.change(screen.getByLabelText(/Distribution/),{target:{value:''}});
  expect(screen.queryByLabelText(/^value/)).not.toBeInTheDocument();
  expect(screen.getByText('Activity mechanical: choose a duration distribution')).toBeVisible();
  click('Undo');select(/Mechanical design/);
  expect(screen.getByLabelText(/^value/)).toHaveValue('0');
  fireEvent.change(screen.getByLabelText(/^Probability/),{target:{value:''}});
  expect(screen.getByRole('button',{name:'Run Simulation'})).toBeDisabled();
  click('Undo');select(/Mechanical design/);
  expect(screen.getByLabelText(/^Probability/)).toHaveValue('1');
  expect(fetchMock).not.toHaveBeenCalled();
});

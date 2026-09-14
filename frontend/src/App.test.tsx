import {beforeEach,describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen,within,waitFor} from '@testing-library/react';
import App from './App';
import {Results} from './components/Analysis';
import {demoWorkspace} from './demo';
import type {SimulationResult} from './types';
vi.mock('./components/Canvas',()=>({default:()=> <div>Canvas projection</div>})); // Real canvas exercised in browser integration tests.
const fetchMock=vi.fn();
beforeEach(()=>{vi.stubGlobal('fetch',fetchMock);fetchMock.mockReset();vi.spyOn(window,'confirm').mockReturnValue(true);});
const click=(name:string)=>fireEvent.click(screen.getByRole('button',{name}));
function demo(){render(<App/>);click('Load demo');}
describe('modeling workspace',()=>{
  it('renders a blank workspace with explicit simulation settings',()=>{
    render(<App/>);expect(screen.getByRole('heading',{name:'GERT Studio'})).toBeVisible();expect(screen.getByLabelText(/Max simulation time/)).toHaveValue('');
  });
  it('creates and selects nodes and allows an invalid second Start',()=>{
    render(<App/>);click('+ Start');expect(screen.getByLabelText(/Node ID/)).toHaveValue('start_1');click('+ State');expect(screen.getByLabelText(/Node ID/)).toHaveValue('state_1');
    fireEvent.click(within(screen.getByRole('navigation',{name:'Network outline'})).getByRole('button',{name:/start_1/}));expect(screen.getByLabelText(/Node ID/)).toHaveValue('start_1');click('+ Start');expect(screen.getByLabelText(/Node ID/)).toHaveValue('start_2');
  });
  it('creates an item and edits its readable label',()=>{
    render(<App/>);click('+ Item');fireEvent.change(screen.getByLabelText('Item label'),{target:{value:'Prototype'}});expect(within(screen.getByRole('navigation',{name:'Items'})).getByText('Prototype')).toBeVisible();
  });
  it('creates one activity and switches exact distribution fields without defaults',()=>{
    render(<App/>);click('+ Start');click('+ State');click('+ Activity');expect(screen.getByLabelText(/Activity ID/)).toHaveValue('activity_1');
    expect(screen.getByLabelText(/Source node/)).toHaveValue('state_1');
    fireEvent.change(screen.getByLabelText(/Distribution/),{target:{value:'beta-PERT'}});
    expect(screen.getByLabelText(/lambda/)).toBeRequired();expect(screen.getByLabelText(/lambda/)).toHaveValue('');expect(screen.queryByLabelText(/^value/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Distribution/),{target:{value:'uniform'}});expect(screen.queryByLabelText(/lambda/)).not.toBeInTheDocument();expect(screen.getByLabelText(/^min/)).toHaveValue('');
  });
  it('shows exact probability totals and does not normalize edits',()=>{
    demo();fireEvent.click(within(screen.getByRole('navigation',{name:'Network outline'})).getByRole('button',{name:/Test prototype/}));
    fireEvent.change(screen.getAllByLabelText(/Probability/)[0],{target:{value:'0.7'}});
    expect(screen.getByText('0.9',{exact:true})).toBeVisible();expect(screen.getAllByLabelText(/Probability/).map(e=>(e as HTMLInputElement).value)).toEqual(['0.7','0.15','0.05']);
  });
  it('renders server errors/warnings/info and navigates the affected property',async()=>{
    fetchMock.mockResolvedValue({ok:true,status:200,text:async()=>JSON.stringify({valid:false,diagnostics:[{severity:'error',code:'probability_sum',message:'Probabilities do not total one',path:['activities',3,'outcomes']},{severity:'warning',code:'possible_cycle',message:'Cycle may repeat',path:['nodes',3]},{severity:'info',code:'note',message:'Model note',path:[]}]})});
    demo();click('Validate');expect(await screen.findByText('Model needs attention')).toBeVisible();expect(screen.getByText('Cycle may repeat')).toBeVisible();expect(screen.getByText('Model note')).toBeVisible();click('Probabilities do not total one activities › 3 › outcomes · probability_sum');expect(screen.getByLabelText(/Activity ID/)).toHaveValue('test');
  });
  it('surfaces HTTP 422 diagnostics including missing lambda',async()=>{
    fetchMock.mockResolvedValue({ok:false,status:422,text:async()=>JSON.stringify({valid:false,diagnostics:[{severity:'error',code:'schema',message:'lambda is required',path:['activities',3,'duration','lambda']}]})});
    demo();click('Run Simulation');expect(await screen.findByText('lambda is required')).toBeVisible();expect(screen.getByRole('alert')).toHaveTextContent('invalid model or simulation settings');
  });
  it('handles backend unavailable and prevents duplicate requests',async()=>{
    let reject!:(reason:Error)=>void;fetchMock.mockReturnValue(new Promise((_,r)=>{reject=r;}));
    demo();click('Run Simulation');expect(screen.getByRole('button',{name:'Running simulation…'})).toBeDisabled();expect(fetchMock).toHaveBeenCalledTimes(1);reject(new Error('network'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the backend');
  });
  it('sends edited decimal strings to the backend',async()=>{
    fetchMock.mockResolvedValue({ok:true,status:200,text:async()=>' {"valid":true,"diagnostics":[]}'});
    demo();fireEvent.click(within(screen.getByRole('navigation',{name:'Network outline'})).getByRole('button',{name:/Mechanical design/}));
    fireEvent.change(screen.getByLabelText(/^min/),{target:{value:'0.1000000000000000000001'}});click('Validate');
    await waitFor(()=>expect(fetchMock).toHaveBeenCalled());expect(fetchMock.mock.calls[0][1].body).toContain('"min":"0.1000000000000000000001"');
  });
  it('deletes an activity without deleting its target nodes',()=>{
    demo();fireEvent.click(within(screen.getByRole('navigation',{name:'Network outline'})).getByRole('button',{name:/Test prototype/}));click('Delete activity');
    expect(within(screen.getByRole('navigation',{name:'Network outline'})).queryByRole('button',{name:/Test prototype/})).not.toBeInTheDocument();expect(within(screen.getByRole('navigation',{name:'Network outline'})).getByRole('button',{name:/Approved/})).toBeVisible();
  });
});
it('renders conditioned results, separate statuses, lifecycle and the exact returned seed',()=>{
  const f={count:1,denominator:2,probability:'0.5'};
  const result:SimulationResult={root_seed:340282366920938463463374607431768211455n,engine_version:'0.1.0',reproducibility_version:'test',validation:{valid:true,diagnostics:[]},runs:[],summary:{realizations:2,statuses:{terminal:f,cutoff_time:f},terminal_outcomes:{success:{...f,outcome_code:'success'}},terminal_duration:{sample_size:1,conditioning:'terminal only',mean:'3',median:'3',p50:'3',p80:'3',p90:'3',p95:'3',min:'3',max:'3'},activities:{test:{mean_starts:'1',probability_at_least_one_start:'1',started:2,completed:1,cancelled:0,unfinished_at_run_end:1,unfinished_at_cutoff:1,unfinished_at_ambiguity:0,unfinished_at_invalid_runtime:0}}}};
    render(<Results result={result} model={demoWorkspace().model}/>);expect(screen.getByText(/Completion time · terminal runs only/)).toBeVisible();expect(screen.getByText('Time cutoff')).toBeVisible();expect(screen.getByText('340282366920938463463374607431768211455')).toBeVisible();expect(screen.getByRole('columnheader',{name:'Unfinished'})).toBeVisible();
});

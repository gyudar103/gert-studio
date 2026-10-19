import {beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,within,waitFor} from '@testing-library/react';
import App from '../App';
import {PROGRESS_KEY} from './progress';
vi.mock('../components/Canvas',()=>({default:()=> <div>Real canvas tested in browser</div>}));
beforeEach(()=>{localStorage.clear();vi.spyOn(window,'confirm').mockReturnValue(true);});
const click=(name:string)=>fireEvent.click(screen.getByRole('button',{name}));
async function open() {click('Learn / Tutorial');await screen.findByRole('heading',{name:'Learn GERT Studio'});}
function lesson(name:RegExp) {fireEvent.click(within(screen.getByRole('navigation',{name:'Tutorial lessons'})).getByRole('button',{name}));}
it('keeps project edits, settings and undo history isolated from tutorial shortcuts',async()=>{
  const {container}=render(<App/>);
  fireEvent.change(screen.getByLabelText('Project name'),{target:{value:'Unsaved user project'}});
  fireEvent.change(screen.getByLabelText(/Seed/),{target:{value:'987654321'}});click('+ Start');
  await open();lesson(/2\. Build/);click('Load practice starting point');
  const practice=container.querySelector('.tutorial-practice')!;
  expect(within(practice as HTMLElement).getByLabelText('Project name')).toHaveValue('Quality-control tutorial');
  fireEvent.keyDown(window,{key:'z',ctrlKey:true});
  click('Return to my project');
  const original=within(container.querySelector('[aria-label="My project workspace"]')! as HTMLElement);
  expect(original.getByLabelText('Project name')).toHaveValue('Unsaved user project');
  expect(original.getByLabelText(/Seed/)).toHaveValue('987654321');expect(original.getByLabelText(/Node ID/)).toHaveValue('start_1');
  click('Undo');expect(screen.getByText('0 nodes · 0 activities')).toBeVisible();
});
it('supports reading progress, keyboard lesson navigation and reset without network persistence',async()=>{
  render(<App/>);await open();fireEvent.click(screen.getByLabelText('Mark reading complete'));
  await waitFor(()=>expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!)).toEqual({version:1,completed:['lesson-0']}));
  const nav=screen.getByRole('navigation',{name:'Tutorial lessons'});
  fireEvent.keyDown(nav,{key:'ArrowDown'});expect(within(nav).getByRole('button',{name:/What changed/})).toHaveAttribute('aria-current','step');
  fireEvent.keyDown(nav,{key:'End'});expect(within(nav).getByRole('button',{name:/References/})).toHaveAttribute('aria-current','step');
  fireEvent.keyDown(nav,{key:'Home'});expect(within(nav).getByRole('button',{name:/Start here/})).toHaveAttribute('aria-current','step');
  click('Reset tutorial progress');expect(screen.getByLabelText('Mark reading complete')).not.toBeChecked();
});
it('does not let a checkbox bypass a practical checkpoint, and confirms practice replacement',async()=>{
  render(<App/>);await open();lesson(/16\. Keep unknown/);
  expect(screen.queryByLabelText('Mark reading complete')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Check exercise'})).toBeDisabled();
  click('Load practice starting point');click('Check exercise');expect(screen.getByText(/Validate the current practice model/)).toBeVisible();
  const startingName=screen.getAllByLabelText('Project name').at(-1)!;
  fireEvent.change(startingName,{target:{value:'My practice notes'}});
  lesson(/7\. Add the quality/);vi.mocked(window.confirm).mockReturnValue(false);click('Load practice starting point');
  expect(startingName).toHaveValue('My practice notes');
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('tutorial practice network'));
});
it('guides the actual selected element and opens its documentation in Properties',async()=>{
  const {container}=render(<App/>);await open();lesson(/15\. Write documentation/);click('Load practice starting point');
  click('Find control: Node documentation');
  const practice=within(container.querySelector('.tutorial-practice')! as HTMLElement);
  expect(await practice.findByLabelText('Node documentation: Comments')).toBeVisible();
  expect(practice.getByLabelText(/Node ID/)).toHaveValue('ready');
  click('Find control: Duration documentation');
  await waitFor(()=>expect(practice.getByLabelText(/Activity ID/)).toHaveValue('inspection'));
  await waitFor(()=>expect(practice.getByLabelText('Duration documentation: Certainty level')).toBeVisible());
  const ids=[...container.querySelectorAll('[id]')].map(el=>el.id);expect(new Set(ids).size).toBe(ids.length);
});
it('opens reference links separately so they cannot navigate away from unsaved work',async()=>{
  render(<App/>);fireEvent.change(screen.getByLabelText('Project name'),{target:{value:'Keep this unsaved network'}});
  await open();lesson(/0\. Get GERT Studio/);
  const links=within(screen.getByRole('article',{name:'0. Get GERT Studio'})).getAllByRole('link');
  expect(links.length).toBeGreaterThan(0);
  for(const link of links) {expect(link).toHaveAttribute('target','_blank');expect(link).toHaveAttribute('rel','noopener noreferrer');}
  click('Return to my project');
  expect(screen.getByLabelText('Project name')).toHaveValue('Keep this unsaved network');
});

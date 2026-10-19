import {beforeEach,describe,expect,it,vi} from 'vitest';
import {checkExercise,mathematicalInputs,practice,targetModel,tutorialSettings} from './exercises';
import type {EditorObservation,ExerciseId} from './exercises';
import {resultsFixture} from '../test/resultsFixture';
import {PROGRESS_KEY,readProgress,saveProgress} from './progress';
import {LAYOUT_KEY} from '../useResizableLayout';
import {lessons} from './lessons';

function state(id:ExerciseId):EditorObservation {
  const starting=practice(id);starting.workspace.model=targetModel(id);
  return {...starting,report:{valid:true,simulation_ready:true,draft_valid:true,diagnostics:[]},importedResult:false,busy:false};
}
function deterministicResult() {
  const r=resultsFixture();r.summary.terminal_duration.mean='2';r.runs.forEach(run=>{run.status='terminal';run.last_processed_time='2';});return r;
}
describe('exercise evidence',()=>{
  it('requires backend validation and a fresh simulation of the matching model',()=>{
    const s=state('deterministic');
    expect(checkExercise('deterministic',s).complete).toBe(false);
    s.result=deterministicResult();expect(checkExercise('deterministic',s).complete).toBe(true);
    s.report=undefined;expect(checkExercise('deterministic',s).complete).toBe(false);
    s.report={valid:false,diagnostics:[]};expect(checkExercise('deterministic',s).complete).toBe(false);
    s.report={valid:true,diagnostics:[]};s.importedResult=true;expect(checkExercise('deterministic',s).complete).toBe(false);
  });
  it('rejects changed mathematics or wrong backend outcomes',()=>{
    const s=state('deterministic');s.result=deterministicResult();
    s.result.runs[0].last_processed_time='0';expect(checkExercise('deterministic',s).complete).toBe(false);
    s.result=deterministicResult();s.workspace.model.activities[1].requirements.component='2';
    expect(checkExercise('deterministic',s).complete).toBe(false);
  });
  it('ignores labels, notes, serialized order and equivalent decimal spellings',()=>{
    const original=targetModel('rework'),edited=structuredClone(original);
    edited.nodes.reverse();edited.activities.reverse();edited.activities.forEach(a=>a.outcomes.reverse());
    edited.activities[0].label='A readable name';edited.activities[0].duration_documentation={certainty:'Low — no measured data'};
    edited.activities[0].requirements.component='1.00';edited.project.name='My own practice';
    expect(mathematicalInputs(edited)).toBe(mathematicalInputs(original));
    edited.activities[0].id='different';expect(mathematicalInputs(edited)).not.toBe(mathematicalInputs(original));
  });
  it('preserves explicit unknowns and positive inputs in the starting points',()=>{
    for(const id of ['deterministic','rework','draft'] as const) {
      const {workspace}=practice(id),a=workspace.model.activities[1];
      expect(a.duration).toBeNull();expect(a.outcomes.every(o=>o.probability===null)).toBe(true);
      expect(a.requirements.component).toBe('1');
    }
    const duration=practice('duration').workspace.model.activities[1].duration;
    expect(duration).toEqual({type:'beta-PERT',min:null,mode:null,max:null,lambda:null});
  });
  it('requires a valid non-executable draft, rationale and an actual import',()=>{
    const s=state('draft');s.report={valid:true,draft_valid:true,simulation_ready:false,diagnostics:[]};
    expect(checkExercise('draft',s).complete).toBe(false);
    s.workspace.model.activities[1].duration_documentation={rationale:'Awaiting measured evidence'};
    expect(checkExercise('draft',s).complete).toBe(false);
    s.lastImport=JSON.stringify(s.workspace.model);expect(checkExercise('draft',s).complete).toBe(true);
    s.workspace.model.activities[1].duration={type:'fixed',value:'0'};
    expect(checkExercise('draft',s).complete).toBe(false);
  });
  it('checks all documentation fields and imported note preservation',()=>{
    const s=state('documentation'),a=s.workspace.model.activities[1];
    s.workspace.model.nodes[1].documentation={comments:'Buffer',assumptions:'Returns here',certainty:'High — stated process',explanation:'Start cannot receive input'};
    a.duration_documentation={rationale:'Teaching value',assumptions:'No queue',references:'Tutorial',certainty:'Low for prediction'};
    a.outcomes[0].documentation={rationale:'Teaching assumption'};
    expect(checkExercise('documentation',s).complete).toBe(false);
    s.lastImport=JSON.stringify(s.workspace.model);expect(checkExercise('documentation',s).complete).toBe(true);
    delete a.duration_documentation.references;expect(checkExercise('documentation',s).complete).toBe(false);
  });
  it('requires imported results specifically for the snapshot lesson',()=>{
    const s=state('snapshot');s.result=deterministicResult();
    expect(checkExercise('snapshot',s).complete).toBe(false);
    s.importedResult=true;expect(checkExercise('snapshot',s).complete).toBe(true);
    s.result=undefined;expect(checkExercise('snapshot',s).complete).toBe(false);
  });
  it('does not mark a seeded run as a verified replay without matching reports',()=>{
    const s=state('replay');s.result=deterministicResult();s.result.root_seed=BigInt(s.settings.seed);
    expect(checkExercise('replay',s).complete).toBe(false);
    s.replayVerified=true;expect(checkExercise('replay',s).complete).toBe(true);
    s.settings.seed='';expect(checkExercise('replay',s).complete).toBe(false);
  });
  it('requires singleton evidence before the ten-observation uncertainty checkpoint',()=>{
    const s=state('uncertainty');s.result=deterministicResult();
    Object.assign(s.result.summary.terminal_duration,{sample_size:10,mean:'2',sample_standard_deviation:'0',mean_standard_error:'0',mean_confidence_interval:{lower:'2',upper:'2'}});
    expect(checkExercise('uncertainty',s).complete).toBe(false);
    s.singletonSeen=true;expect(checkExercise('uncertainty',s).complete).toBe(true);
  });
  it('compares rework settings with the exercise without requiring exact Monte Carlo fractions',()=>{
    const s=state('cutoff');s.result=deterministicResult();
    expect(checkExercise('cutoff',s).complete).toBe(false);
    s.settings.max_simulation_time='7';expect(checkExercise('cutoff',s)).toMatchObject({complete:true,message:expect.stringContaining('Theoretical acceptance 0.96')});
    s.busy=true;expect(checkExercise('cutoff',s).complete).toBe(false);
  });
});
describe('progress storage and static content',()=>{
  beforeEach(()=>localStorage.clear());
  it('saves only versioned lesson IDs and preserves unrelated storage',()=>{
    localStorage.setItem(LAYOUT_KEY,'panel preference');saveProgress(['lesson-0','lesson-19']);
    expect(readProgress()).toEqual(['lesson-0','lesson-19']);
    expect(localStorage.getItem(LAYOUT_KEY)).toBe('panel preference');
    expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!)).toEqual({version:1,completed:['lesson-0','lesson-19']});
  });
  it('ignores malformed, obsolete and unknown completion records',()=>{
    localStorage.setItem(PROGRESS_KEY,'not json');expect(readProgress()).toEqual([]);
    localStorage.setItem(PROGRESS_KEY,JSON.stringify({version:2,completed:['lesson-1']}));expect(readProgress()).toEqual([]);
    localStorage.setItem(PROGRESS_KEY,JSON.stringify({version:1,completed:['lesson-1','lesson-1','lesson-22',{},'workspace']}));expect(readProgress()).toEqual(['lesson-1']);
  });
  it('works when storage is denied',()=>{
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked');});
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('full');});
    expect(readProgress()).toEqual([]);expect(()=>saveProgress(['lesson-0'])).not.toThrow();vi.restoreAllMocks();
  });
  it('retains the entire lesson route and the real current run-setting labels',()=>{
    expect(lessons).toHaveLength(22);
    const text=JSON.stringify(lessons);
    for(const term of ['Max activity instances','Max activity completions','Realizations','Wilson','Student-t','ddof=0','ddof=1','3.25','0.96','Sources / references','Certainty level']) expect(text).toContain(term);
    expect(text).not.toContain('<script');expect(text).not.toContain('"tag":"script"');
  });
  it('does not reuse a mutated starting point',()=>{
    const first=practice('draft');first.workspace.model.nodes.length=0;first.settings.seed='wrong';
    expect(practice('draft').workspace.model.nodes.length).toBeGreaterThan(0);expect(practice('draft').settings).toEqual(tutorialSettings());
  });
});

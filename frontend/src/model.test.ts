import {describe,it,expect} from 'vitest';
import {apiModel,blankDuration,probabilityTotal,newActivity,diagnosticSelection} from './model';
import {demoWorkspace,demoSettings} from './demo';
import {exactJSON,simulationBody} from './api';
import {graphView} from './graph';
describe('canonical model and transport',()=>{
  it('preserves decimal strings and large integer seed exactly',()=>{
    const w=demoWorkspace();w.model.activities[0].requirements.mechanical_request='0.10000000000000000000000001';
    w.model.activities[0].duration={type:'fixed',value:'0.1'};
    const body=simulationBody(apiModel(w),{...demoSettings,max_simulation_time:'0.30000000000000000001',seed:'340282366920938463463374607431768211455'});
    expect(body).toContain('"value":"0.1"');expect(body).toContain('"mechanical_request":"0.10000000000000000000000001"');expect(body).toContain('"max_simulation_time":"0.30000000000000000001"');expect(body).toContain('"seed":340282366920938463463374607431768211455');
    expect(String(exactJSON.parse(body).settings.seed)).toBe('340282366920938463463374607431768211455');
  });
  it('does not include layout or settings in mathematical model; dragging changes no model bytes',()=>{
    const w=demoWorkspace(),before=JSON.stringify(apiModel(w));w.layout.nodes[0]={x:987,y:123};
    expect(JSON.stringify(apiModel(w))).toBe(before);expect(apiModel(w)).not.toHaveProperty('layout');expect(apiModel(w)).not.toHaveProperty('settings');
  });
  it('keeps one activity with three alternative outcome edges',()=>{
    const w=demoWorkspace(),g=graphView(w,null);
    expect(g.nodes.filter(n=>n.data.kind==='activity')).toHaveLength(w.model.activities.length);
    expect(g.edges.filter(e=>e.source==='a:3')).toHaveLength(3);
  });
  it('represents rework cycles without a DAG constraint',()=>{
    const g=graphView(demoWorkspace(),null);
    expect(g.edges).toEqual(expect.arrayContaining([expect.objectContaining({source:'n:2',target:'a:3'}),expect.objectContaining({source:'a:3',target:'n:3'}),expect.objectContaining({source:'n:3',target:'a:4'}),expect.objectContaining({source:'a:4',target:'n:2'})]));
  });
  it('leaves all new numeric parameters blank, including lambda and probability',()=>{
    expect(blankDuration('beta-PERT')).toEqual({type:'beta-PERT',min:'',mode:'',max:'',lambda:''});
    expect(newActivity('a').outcomes[0].probability).toBe('');
  });
  it('displays an exact sum without changing declared probabilities',()=>{
    const outcomes=demoWorkspace().model.activities[3].outcomes;
    outcomes[0].probability='0.700000000000000000001';
    const before=JSON.stringify(outcomes);
    expect(probabilityTotal(outcomes)).toBe('0.900000000000000000001');expect(JSON.stringify(outcomes)).toBe(before);
    outcomes[0].probability='';expect(probabilityTotal(outcomes)).toBe('Incomplete');
  });
  it('navigates scoped outcomes and item diagnostics',()=>{
    const m=demoWorkspace().model;
    expect(diagnosticSelection(m,['activities',3,'outcomes',1,'probability'])).toEqual({kind:'activity',index:3,outcome:1});
    expect(diagnosticSelection(m,['item_types',2,'id'])).toMatchObject({kind:'item',index:2});
  });
  it('omits blank seed and rejects incomplete integer settings without defaults',()=>{
    expect(exactJSON.parse(simulationBody(demoWorkspace().model,{...demoSettings,seed:''})).settings).not.toHaveProperty('seed');
    expect(()=>simulationBody(demoWorkspace().model,{...demoSettings,realizations:''})).toThrow('Realizations');
  });
});

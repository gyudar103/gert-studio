import ResultNumber from './ResultNumber';
import type {Diagnostic,Model,SimulationResult,ValidationReport} from '../types';
export function Diagnostics({report,onSelect}:{report:ValidationReport;onSelect:(d:Diagnostic)=>void}) {
  return <div className="diagnostics"><p className={report.valid?'valid':'invalid'} role="status">{report.valid?'Model valid':'Model needs attention'}</p>
    {(['error','warning','info'] as const).map(severity=>{
      const entries=report.diagnostics.filter(d=>d.severity===severity);
      return <section key={severity}><h3>{severity==='info'?'Information':`${severity[0].toUpperCase()}${severity.slice(1)}s`} <span className="count">{entries.length}</span></h3>
        {entries.map((d,i)=><button key={i} className={`diagnostic ${severity}`} onClick={()=>onSelect(d)}><strong>{d.message}</strong><small>{d.element_id || d.path.join(' › ') || 'Model'} · {d.code}</small></button>)}
      </section>;
    })}</div>;
}
const statusLabels:Record<string,string>={terminal:'Reached a terminal',deadlock:'Deadlock',ambiguous_resource_competition:'Resource competition ambiguity',ambiguous_terminal:'Ambiguous terminals',cutoff_time:'Time cutoff',cutoff_activity_count:'Completion-count cutoff',cutoff_instance_count:'Instance-count cutoff',invalid_runtime_state:'Invalid runtime state'};
export function Results({result,model}:{result:SimulationResult;model:Model}) {
  const {summary}=result;
  const duration=summary.terminal_duration;
  return <div className="results" aria-label="Simulation results">
    <div className="run-meta"><strong><ResultNumber value={summary.realizations}/> realizations</strong><span>Actual seed: <code>{String(result.root_seed)}</code></span><span>Engine {result.engine_version} · {result.reproducibility_version}</span></div>
    <div className="result-columns"><section><h3>Terminal outcomes</h3><p className="hint">Probabilities use all <ResultNumber value={summary.realizations}/> requested realizations.</p>
      <table><thead><tr><th>Terminal</th><th>Count / N</th><th>Probability</th></tr></thead><tbody>{Object.entries(summary.terminal_outcomes).map(([id,value])=><tr key={id}><td>{model.nodes.find(n=>n.id===id)?.label || id}<small>{id} · {value.outcome_code}</small></td><td><ResultNumber value={value.count}/> / <ResultNumber value={value.denominator}/></td><td><ResultNumber value={value.probability}/></td></tr>)}</tbody></table>
    </section><section><h3>Run statuses</h3><table><thead><tr><th>Status</th><th>Count / N</th><th>Probability</th></tr></thead><tbody>{Object.entries(summary.statuses).map(([status,value])=><tr key={status}><td>{statusLabels[status]||status}</td><td><ResultNumber value={value.count}/> / <ResultNumber value={value.denominator}/></td><td><ResultNumber value={value.probability}/></td></tr>)}</tbody></table></section>
    <section><h3>Completion time · terminal runs only</h3><p className="hint">Conditional on reaching a terminal within the configured limits. Sample size: <ResultNumber value={duration.sample_size}/>.</p>
      <dl className="metrics">{(['mean','median','p80','p90','p95','min','max'] as const).map(k=><div key={k}><dt>{k==='median'?'Median / P50':k.toUpperCase()}</dt><dd>{duration[k]===null?'Unavailable':<ResultNumber key={duration[k]} value={duration[k]}/>}</dd></div>)}</dl>
    </section></div>
    <section className="activity-results"><h3>Activity starts & lifecycle</h3><p className="hint">Means and start frequencies use all realizations. Cutoff observations are truncated; unfinished work is not cancelled.</p>
      <div className="table-scroll"><table><thead><tr><th>Activity</th><th>Mean starts</th><th>P(at least one start)</th><th>Started</th><th>Completed</th><th>Cancelled</th><th>Unfinished</th><th>Cutoff / ambiguity / invalid</th></tr></thead><tbody>{Object.entries(summary.activities).map(([id,a])=><tr key={id}><td>{model.activities.find(x=>x.id===id)?.label||id}<small>{id}</small></td><td><ResultNumber value={a.mean_starts}/></td><td><ResultNumber value={a.probability_at_least_one_start}/></td><td><ResultNumber value={a.started}/></td><td><ResultNumber value={a.completed}/></td><td><ResultNumber value={a.cancelled}/></td><td><ResultNumber value={a.unfinished_at_run_end}/></td><td><ResultNumber value={a.unfinished_at_cutoff}/> / <ResultNumber value={a.unfinished_at_ambiguity}/> / <ResultNumber value={a.unfinished_at_invalid_runtime}/></td></tr>)}</tbody></table></div>
    </section>
    {result.runs.some(r=>r.error) && <details><summary>Runtime explanations</summary>{result.runs.filter(r=>r.error).map(r=><p key={String(r.realization_index)}>Realization {String(r.realization_index)}: {r.error}</p>)}</details>}
  </div>;
}

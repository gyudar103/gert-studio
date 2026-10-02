import ResultNumber from './ResultNumber';
import type {Diagnostic,Model,Percentile,SimulationResult,StudentTInterval,ValidationReport,WilsonInterval} from '../types';
export function Diagnostics({report,onSelect}:{report:ValidationReport;onSelect:(d:Diagnostic)=>void}) {
  return <div className="diagnostics"><p className={report.valid?'valid':'invalid'} role="status">{report.valid?(report.simulation_ready===false?'Draft valid · Complete missing inputs before simulation':'Model valid'):'Model needs attention'}</p>
    {(['error','warning','info'] as const).map(severity=>{
      const entries=report.diagnostics.filter(d=>d.severity===severity);
      return <section key={severity}><h3>{severity==='info'?'Information':`${severity[0].toUpperCase()}${severity.slice(1)}s`} <span className="count">{entries.length}</span></h3>
        {entries.map((d,i)=><button key={i} className={`diagnostic ${severity}`} onClick={()=>onSelect(d)}><strong>{d.message}</strong><small>{d.element_id || d.path.join(' › ') || 'Model'} · {d.code}</small></button>)}
      </section>;
    })}</div>;
}
const statusLabels:Record<string,string>={terminal:'Reached a terminal',deadlock:'Deadlock',ambiguous_resource_competition:'Resource competition ambiguity',ambiguous_terminal:'Ambiguous terminals',cutoff_time:'Time cutoff',cutoff_activity_count:'Completion-count cutoff',cutoff_instance_count:'Instance-count cutoff',invalid_runtime_state:'Invalid runtime state'};
const percentiles:Percentile[]=['p5','p10','p20','p30','p50','p70','p80','p90','p95'];
const percentileLabel=(key:Percentile)=>key==='p50'?'Median / P50':key.toUpperCase();
function NumberOrUnavailable({value}:{value:string|null}) {
  return value===null?<>Unavailable</>:<ResultNumber key={value} value={value}/>;
}
function Interval({lower,upper}:{lower:string|null;upper:string|null}) {
  return <span className="ci-range"><span aria-label="Lower bound"><NumberOrUnavailable value={lower}/></span> to <span aria-label="Upper bound"><NumberOrUnavailable value={upper}/></span></span>;
}
function MeanUncertainty({sampleSD,standardError,interval}:{sampleSD:string|null;standardError:string|null;interval:StudentTInterval|null}) {
  return <><dt>Sample SD (ddof=1)</dt><dd><NumberOrUnavailable value={sampleSD}/></dd><dt>SE of mean</dt><dd><NumberOrUnavailable value={standardError}/></dd>
    <dt>95% Student-t CI</dt><dd>{interval?<><Interval {...interval}/>{interval.lower_clipped && <small>Support-clipped: the mathematical lower bound was negative and is shown as zero.</small>}</>:<>Unavailable — at least two observations are required.</>}</dd></>;
}
function ProbabilityUncertainty({label,standardError,interval}:{label:string;standardError:string;interval:WilsonInterval}) {
  return <details className="result-uncertainty"><summary aria-label={`${label} probability uncertainty`}>Uncertainty</summary><dl className="uncertainty-metrics">
    <dt>SE of probability</dt><dd><ResultNumber value={standardError}/></dd><dt>95% Wilson CI</dt><dd><Interval {...interval}/></dd>
  </dl></details>;
}
export function Results({result,model,imported=false}:{result:SimulationResult;model:Model;imported?:boolean}) {
  const {summary}=result;
  const duration=summary.terminal_duration;
  return <div className="results" aria-label="Simulation results">
    {imported && <p role="status">Imported saved results · No simulation was rerun.</p>}
    <div className="run-meta"><strong><ResultNumber value={summary.realizations}/> realizations</strong><span>Actual seed: <code>{String(result.root_seed)}</code></span><span>Engine {result.engine_version} · {result.reproducibility_version}</span></div>
    <p className="hint uncertainty-help">SD describes the spread of observations (population SD, ddof=0). Sample SD (ddof=1) is used for inference and requires at least two observations. SE measures Monte Carlo uncertainty in an estimate. A 95% CI gives a confidence interval for that estimate. Expand Uncertainty for SEs and intervals; click a number to toggle full precision.</p>
    <div className="result-columns"><section><h3>Terminal outcomes</h3><p className="hint">Probabilities use all <ResultNumber value={summary.realizations}/> requested realizations.</p>
      <table><thead><tr><th>Terminal</th><th>Count / N</th><th>Probability</th></tr></thead><tbody>{Object.entries(summary.terminal_outcomes).map(([id,value])=><tr key={id}><td>{model.nodes.find(n=>n.id===id)?.label || id}<small>{id} · {value.outcome_code}</small></td><td><ResultNumber value={value.count}/> / <ResultNumber value={value.denominator}/></td><td><ResultNumber value={value.probability}/><ProbabilityUncertainty label={`Terminal ${id}`} standardError={value.standard_error} interval={value.confidence_interval}/></td></tr>)}</tbody></table>
    </section><section><h3>Run statuses</h3><p className="hint">Probabilities use all requested realizations, including nonterminal runs.</p><table><thead><tr><th>Status</th><th>Count / N</th><th>Probability</th></tr></thead><tbody>{Object.entries(summary.statuses).map(([status,value])=><tr key={status}><td>{statusLabels[status]||status}</td><td><ResultNumber value={value.count}/> / <ResultNumber value={value.denominator}/></td><td><ResultNumber value={value.probability}/><ProbabilityUncertainty label={statusLabels[status]||status} standardError={value.standard_error} interval={value.confidence_interval}/></td></tr>)}</tbody></table></section>
    <section className="completion-results"><h3>Completion time · terminal runs only</h3><p className="hint">Conditional on reaching a terminal within the configured limits. Sample size: <ResultNumber value={duration.sample_size}/>. Cutoffs, deadlocks, ambiguities, and invalid-runtime runs are excluded.</p>
      <dl className="metrics"><div><dt>Mean</dt><dd><NumberOrUnavailable value={duration.mean}/></dd></div><div><dt>SD</dt><dd><NumberOrUnavailable value={duration.standard_deviation}/></dd></div>
        {percentiles.map(k=><div key={k}><dt>{percentileLabel(k)}</dt><dd><NumberOrUnavailable value={duration[k]}/></dd></div>)}
        {(['min','max'] as const).map(k=><div key={k}><dt>{k==='min'?'Min':'Max'}</dt><dd><NumberOrUnavailable value={duration[k]}/></dd></div>)}
      </dl>
      <details className="result-uncertainty"><summary>Completion-time uncertainty</summary>
        <p className="hint">The mean SE and interval use sample variance from terminal runs only.</p>
        <dl className="uncertainty-metrics"><MeanUncertainty sampleSD={duration.sample_standard_deviation} standardError={duration.mean_standard_error} interval={duration.mean_confidence_interval}/></dl>
        <h4>95% nonparametric quantile CI</h4><p className="hint">Binomial/order-statistic intervals use observed ranks. Percentile estimates use Type-7 interpolation. An unavailable bound means the terminal sample is too small for a finite two-sided 95% interval at that percentile.</p>
        <dl className="uncertainty-metrics">{percentiles.map(k=><div key={k}><dt>{percentileLabel(k)}</dt><dd><Interval {...duration.quantile_confidence_intervals[k]}/></dd></div>)}</dl>
      </details>
    </section></div>
    <section className="activity-results"><h3>Activity starts & lifecycle</h3><p className="hint">Means, SDs, and start frequencies use all requested realizations, including zero-start and nonterminal runs. Cutoff observations are truncated; unfinished work is not cancelled.</p>
      <div className="table-scroll"><table><thead><tr><th>Activity</th><th>Mean starts</th><th>P(at least one start)</th><th>Started</th><th>Completed</th><th>Cancelled</th><th>Unfinished</th><th>Cutoff / ambiguity / invalid</th></tr></thead><tbody>{Object.entries(summary.activities).map(([id,a])=><tr key={id}><td>{model.activities.find(x=>x.id===id)?.label||id}<small>{id}</small></td><td><ResultNumber value={a.mean_starts}/><details className="result-uncertainty"><summary aria-label={`${id} starts spread and uncertainty`}>SD & uncertainty</summary><dl className="uncertainty-metrics"><dt>SD starts</dt><dd><ResultNumber value={a.standard_deviation_starts}/></dd><MeanUncertainty sampleSD={a.sample_standard_deviation_starts} standardError={a.mean_starts_standard_error} interval={a.mean_starts_confidence_interval}/></dl></details></td><td><ResultNumber value={a.probability_at_least_one_start}/><ProbabilityUncertainty label={`${id} at least one start`} standardError={a.probability_at_least_one_start_standard_error} interval={a.probability_at_least_one_start_confidence_interval}/></td><td><ResultNumber value={a.started}/></td><td><ResultNumber value={a.completed}/></td><td><ResultNumber value={a.cancelled}/></td><td><ResultNumber value={a.unfinished_at_run_end}/></td><td><ResultNumber value={a.unfinished_at_cutoff}/> / <ResultNumber value={a.unfinished_at_ambiguity}/> / <ResultNumber value={a.unfinished_at_invalid_runtime}/></td></tr>)}</tbody></table></div>
    </section>
    {result.runs.some(r=>r.error) && <details><summary>Runtime explanations</summary>{result.runs.filter(r=>r.error).map(r=><p key={String(r.realization_index)}>Realization {String(r.realization_index)}: {r.error}</p>)}</details>}
  </div>;
}

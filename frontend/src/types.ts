// Mirrors backend/app/schemas/model.py. Decimal text may be incomplete while editing.
export type Quantities = Record<string, string>;
export interface Documentation {comments?:string|null; assumptions?:string|null; certainty?:string|null; explanation?:string|null; rationale?:string|null; references?:string|null}
export type Duration = {type:'fixed'; value:string|null} | {type:'uniform'; min:string|null; max:string|null} |
  {type:'triangular'; min:string|null; mode:string|null; max:string|null} | {type:'beta-PERT'; min:string|null; mode:string|null; max:string|null; lambda:string|null};
export type GertNode = {id:string; label:string; documentation?:Documentation|null} & ({type:'start'; initial_inventory:Quantities} |
  {type:'state'} | {type:'terminal'; outcome_code:string; outcome_label:string; outcome_category:string});
export interface Item {id:string; label:string}
export interface Outcome {id:string; label:string; probability:string|null; target_node:string; produced_items:Quantities; documentation?:Documentation|null}
export interface Activity {id:string; label:string; source_node:string; requirements:Quantities; duration:Duration|null; outcomes:Outcome[]; duration_documentation?:Documentation|null}
export interface Model {schema_version:'0.1'; project:{id:string; name:string}; item_types:Item[]; nodes:GertNode[]; activities:Activity[]}
export interface Point {x:number; y:number}
export interface Workspace {model:Model; layout:{nodes:Point[]; activities:Point[]}}
export type Selection = {kind:'node'|'activity'|'item'; index:number; outcome?:number} | null;
export interface SettingsForm {realizations:string; seed:string; max_simulation_time:string; max_activity_instances:string; max_activity_completions:string}
export type Integer = number | bigint;
export interface SimulationSettings {realizations:Integer; seed:Integer; max_simulation_time:string; max_activity_instances:Integer; max_activity_completions:Integer}
export interface Diagnostic {severity:'error'|'warning'|'info'; code:string; message:string; path:(string|number)[]; element_id?:string|null}
export interface ValidationReport {valid:boolean; draft_valid?:boolean; simulation_ready?:boolean; diagnostics:Diagnostic[]}
export interface WilsonInterval {level:'0.95'; method:'wilson'; lower:string; upper:string}
export interface StudentTInterval {level:'0.95'; method:'student_t'; lower:string; upper:string; lower_clipped:boolean; degrees_of_freedom:Integer}
export interface QuantileInterval {level:'0.95'; method:'binomial_order_statistic'; lower:string|null; upper:string|null; lower_rank:Integer|null; upper_rank:Integer|null}
export type Percentile = 'p5'|'p10'|'p20'|'p30'|'p50'|'p70'|'p80'|'p90'|'p95';
export interface Frequency {count:Integer; denominator:Integer; probability:string; standard_error:string; confidence_interval:WilsonInterval}
export interface ActivitySummary {
  denominator:Integer;
  mean_starts:string; standard_deviation_starts:string; sample_standard_deviation_starts:string|null; mean_starts_standard_error:string|null; mean_starts_confidence_interval:StudentTInterval|null;
  probability_at_least_one_start:string; probability_at_least_one_start_standard_error:string; probability_at_least_one_start_confidence_interval:WilsonInterval;
  started:Integer; completed:Integer; cancelled:Integer; unfinished_at_run_end:Integer; unfinished_at_cutoff:Integer; unfinished_at_ambiguity:Integer; unfinished_at_invalid_runtime:Integer;
}
export interface TerminalDuration extends Record<Percentile,string|null> {
  sample_size:Integer; conditioning:string; mean:string|null; median:string|null; min:string|null; max:string|null;
  standard_deviation:string|null; sample_standard_deviation:string|null; mean_standard_error:string|null; mean_confidence_interval:StudentTInterval|null;
  quantile_confidence_intervals:Record<Percentile,QuantileInterval>;
}
export interface SimulationRun {
  realization_index:Integer; status:string; error:string|null; last_processed_time:string; terminal_node_id:string|null;
  inventory:Record<string,Quantities>;
  activities:Record<string,Pick<ActivitySummary,'started'|'completed'|'cancelled'|'unfinished_at_run_end'|'unfinished_at_cutoff'|'unfinished_at_ambiguity'|'unfinished_at_invalid_runtime'>>;
  instances:{activity_id:string;ordinal:Integer;start:string;scheduled_finish:string;duration:string;state:'completed'|'cancelled'|'unfinished_at_run_end';outcome_id:string|null;unfinished_reason:string|null}[];
}
export interface SimulationResult {
  settings:SimulationSettings;
  root_seed:Integer; engine_version:string; reproducibility_version:string; validation:ValidationReport;
  summary:{realizations:Integer; statuses:Record<string,Frequency>; terminal_outcomes:Record<string,Frequency & {outcome_code:string}>;
    cutoff_observations_are_truncated:boolean;
    terminal_duration:TerminalDuration;
    activities:Record<string,ActivitySummary>};
  runs:SimulationRun[];
}

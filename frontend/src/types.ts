// Mirrors backend/app/schemas/model.py. Decimal text may be incomplete while editing.
export type Quantities = Record<string, string>;
export type Duration = {type:'fixed'; value:string} | {type:'uniform'; min:string; max:string} |
  {type:'triangular'; min:string; mode:string; max:string} | {type:'beta-PERT'; min:string; mode:string; max:string; lambda:string};
export type GertNode = {id:string; label:string} & ({type:'start'; initial_inventory:Quantities} |
  {type:'state'} | {type:'terminal'; outcome_code:string; outcome_label:string; outcome_category:string});
export interface Item {id:string; label:string}
export interface Outcome {id:string; label:string; probability:string; target_node:string; produced_items:Quantities}
export interface Activity {id:string; label:string; source_node:string; requirements:Quantities; duration:Duration; outcomes:Outcome[]}
export interface Model {schema_version:'0.1'; project:{id:string; name:string}; item_types:Item[]; nodes:GertNode[]; activities:Activity[]}
export interface Point {x:number; y:number}
export interface Workspace {model:Model; layout:{nodes:Point[]; activities:Point[]}}
export type Selection = {kind:'node'|'activity'|'item'; index:number; outcome?:number} | null;
export interface SettingsForm {realizations:string; seed:string; max_simulation_time:string; max_activity_instances:string; max_activity_completions:string}
export type Integer = number | bigint;
export interface Diagnostic {severity:'error'|'warning'|'info'; code:string; message:string; path:(string|number)[]; element_id?:string|null}
export interface ValidationReport {valid:boolean; diagnostics:Diagnostic[]}
export interface Frequency {count:Integer; denominator:Integer; probability:string}
export interface ActivitySummary {mean_starts:string; probability_at_least_one_start:string; started:Integer; completed:Integer; cancelled:Integer; unfinished_at_run_end:Integer; unfinished_at_cutoff:Integer; unfinished_at_ambiguity:Integer; unfinished_at_invalid_runtime:Integer}
export interface SimulationResult {
  root_seed:Integer; engine_version:string; reproducibility_version:string; validation:ValidationReport;
  summary:{realizations:Integer; statuses:Record<string,Frequency>; terminal_outcomes:Record<string,Frequency & {outcome_code:string}>;
    terminal_duration:{sample_size:Integer; conditioning:string; mean:string|null; median:string|null; p50:string|null; p80:string|null; p90:string|null; p95:string|null; min:string|null; max:string|null};
    activities:Record<string,ActivitySummary>};
  runs:{realization_index:Integer; status:string; error:string|null}[];
}

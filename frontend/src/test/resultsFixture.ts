import type {Percentile,QuantileInterval,SimulationResult,WilsonInterval} from '../types';

export function resultsFixture():SimulationResult {
  const wilson:WilsonInterval={level:'0.95',method:'wilson',lower:'0.0945312057342307',upper:'0.9054687942657693'};
  const frequency={count:1,denominator:2,probability:'0.5',standard_error:'0.3535533905932737622',confidence_interval:wilson};
  const quantiles=Object.fromEntries((['p5','p10','p20','p30','p50','p70','p80','p90','p95'] as Percentile[]).map(key=>[key,{
    level:'0.95',method:'binomial_order_statistic',lower:null,upper:null,lower_rank:null,upper_rank:null,
  }])) as Record<Percentile,QuantileInterval>;
  return {settings:{realizations:2,seed:340282366920938463463374607431768211455n,max_simulation_time:'100',max_activity_instances:100,max_activity_completions:100},root_seed:340282366920938463463374607431768211455n,engine_version:'0.1.0',reproducibility_version:'test',validation:{valid:true,diagnostics:[]},runs:[0,1].map(realization_index=>({realization_index,status:realization_index===0?'terminal':'cutoff_time',error:null,last_processed_time:'0',terminal_node_id:null,inventory:{},activities:{},instances:[]})),summary:{
    cutoff_observations_are_truncated:true,
    realizations:2,statuses:{...Object.fromEntries(['deadlock','cutoff_activity_count','cutoff_instance_count','invalid_runtime_state','ambiguous_resource_competition','ambiguous_terminal'].map(s=>[s,{...frequency,count:0,probability:'0'}])),terminal:frequency,cutoff_time:frequency},terminal_outcomes:{success:{...frequency,outcome_code:'success'}},
    terminal_duration:{sample_size:1,conditioning:'terminal only',mean:'18.341252780000000000000001',standard_deviation:'0',sample_standard_deviation:null,mean_standard_error:null,mean_confidence_interval:null,
      median:'18.341252780000000000000001',p5:'18.341252780000000000000001',p10:'18.341252780000000000000001',p20:'18.341252780000000000000001',p30:'18.341252780000000000000001',p50:'18.341252780000000000000001',p70:'18.341252780000000000000001',p80:'18.341252780000000000000001',p90:'18.341252780000000000000001',p95:'18.341252780000000000000001',min:'18.341252780000000000000001',max:'18.341252780000000000000001',quantile_confidence_intervals:quantiles},
    activities:{test:{denominator:2,mean_starts:'1',standard_deviation_starts:'0',sample_standard_deviation_starts:'0',mean_starts_standard_error:'0',mean_starts_confidence_interval:{level:'0.95',method:'student_t',lower:'1',upper:'1',lower_clipped:false,degrees_of_freedom:1},
      probability_at_least_one_start:'1',probability_at_least_one_start_standard_error:'0',probability_at_least_one_start_confidence_interval:{...wilson,lower:'0.3423802275066531',upper:'1'},
      started:2,completed:1,cancelled:0,unfinished_at_run_end:1,unfinished_at_cutoff:1,unfinished_at_ambiguity:0,unfinished_at_invalid_runtime:0}},
  }};
}

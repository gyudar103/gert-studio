import {describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen,within} from '@testing-library/react';
import {Results} from './components/Analysis';
import {demoWorkspace} from './demo';
import {resultsFixture} from './test/resultsFixture';

const show=(label:string)=>{const disclosure=screen.getByText(label).closest('details')!;fireEvent.click(disclosure.querySelector('summary')!);return within(disclosure);};
describe('statistical results',()=>{
  it('shows the full percentile family and distinct population definitions',()=>{
    render(<Results result={resultsFixture()} model={demoWorkspace().model}/>);
    const completion=screen.getByRole('heading',{name:'Completion time · terminal runs only'}).closest('section')!;
    for(const label of ['P5','P10','P20','P30','Median / P50','P70','P80','P90','P95','SD','Mean','Min','Max']) expect(within(completion).getAllByText(label)[0]).toBeVisible();
    expect(screen.getByText(/including zero-start and nonterminal runs/)).toBeVisible();
    expect(screen.getByText(/Cutoffs, deadlocks, ambiguities, and invalid-runtime runs are excluded/)).toBeVisible();
    expect(screen.getByText(/SD describes the spread/)).toHaveTextContent('SE measures Monte Carlo uncertainty');
  });
  it('discloses unavailable mean and quantile uncertainty with a small-sample explanation',()=>{
    render(<Results result={resultsFixture()} model={demoWorkspace().model}/>);
    const details=show('Completion-time uncertainty');
    expect(details.getByText('SE of mean')).toBeVisible();
    expect(details.getByText('95% Student-t CI')).toBeVisible();
    expect(details.getByText(/at least two observations are required/)).toBeVisible();
    expect(details.getByText(/sample is too small/)).toBeVisible();
    expect(details.getAllByText('Unavailable')).toHaveLength(20);
    expect(details.queryByRole('button')).not.toBeInTheDocument();
  });
  it('shows partial quantile bounds and lets each exact endpoint toggle independently without requests or mutation',()=>{
    const result=resultsFixture();const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    result.summary.terminal_duration.quantile_confidence_intervals.p5={level:'0.95',method:'binomial_order_statistic',lower:null,upper:'18.341252780000000000000007',lower_rank:null,upper_rank:3};
    result.summary.terminal_duration.mean_standard_error='0.01234567890123456789';
    result.summary.terminal_duration.mean_confidence_interval={level:'0.95',method:'student_t',lower:'0',upper:'123.456789012345678901',lower_clipped:true,degrees_of_freedom:1};
    const before=structuredClone(result);Object.freeze(result.summary.terminal_duration);
    render(<Results result={result} model={demoWorkspace().model}/>);
    const details=show('Completion-time uncertainty');
    expect(details.getByText(/Support-clipped/)).toBeVisible();
    const upper=details.getByRole('button',{name:'123'});const quantile=details.getByRole('button',{name:'18.3'});
    fireEvent.click(upper);expect(upper).toHaveTextContent('123.456789012345678901');expect(quantile).toHaveTextContent('18.3');
    fireEvent.click(quantile);expect(quantile).toHaveTextContent('18.341252780000000000000007');
    fireEvent.click(upper);expect(upper.textContent).toBe('123');
    expect(result).toEqual(before);expect(fetch).not.toHaveBeenCalled();vi.unstubAllGlobals();
  });
  it('exposes Wilson uncertainty for terminal, status and activity probabilities, including zero SE',()=>{
    render(<Results result={resultsFixture()} model={demoWorkspace().model}/>);
    for(const label of ['Terminal success probability uncertainty','Reached a terminal probability uncertainty','Time cutoff probability uncertainty','test at least one start probability uncertainty']) {
      const summary=screen.getByLabelText(label);fireEvent.click(summary);
      const details=within(summary.closest('details')!);
      expect(details.getByText('SE of probability')).toBeVisible();expect(details.getByText('95% Wilson CI')).toBeVisible();
    }
    const activity=within(screen.getByLabelText('test at least one start probability uncertainty').closest('details')!);
    expect(activity.getByRole('button',{name:'0'})).toBeVisible();expect(activity.getByRole('button',{name:'0.342'})).toBeVisible();
    const terminal=within(screen.getByLabelText('Terminal success probability uncertainty').closest('details')!);
    const lower=terminal.getByRole('button',{name:'0.0945'});fireEvent.click(lower);expect(lower).toHaveTextContent('0.0945312057342307');
  });
  it('keeps lifecycle counts separate and discloses SD, mean SE and Student-t uncertainty for activity starts',()=>{
    const result=resultsFixture();result.summary.activities.test.sample_standard_deviation_starts=null;result.summary.activities.test.mean_starts_standard_error=null;result.summary.activities.test.mean_starts_confidence_interval=null;
    render(<Results result={result} model={demoWorkspace().model}/>);
    const summary=screen.getByLabelText('test starts spread and uncertainty');fireEvent.click(summary);
    const details=within(summary.closest('details')!);
    expect(details.getByText('SD starts')).toBeVisible();expect(details.getByRole('button',{name:'0'})).toBeVisible();
    expect(details.getAllByText('Unavailable')).toHaveLength(2);expect(details.getByText('Sample SD (ddof=1)')).toBeVisible();expect(details.getByText(/at least two observations/)).toBeVisible();
    for(const name of ['Started','Completed','Cancelled','Unfinished','Cutoff / ambiguity / invalid']) expect(screen.getByRole('columnheader',{name})).toBeVisible();
  });
  it('shows no terminal observations as unavailable point estimates without replacing them with zero',()=>{
    const result=resultsFixture();const duration=result.summary.terminal_duration;duration.sample_size=0;
    for(const key of ['mean','standard_deviation','min','max','median','p5','p10','p20','p30','p50','p70','p80','p90','p95'] as const) duration[key]=null;
    render(<Results result={result} model={demoWorkspace().model}/>);
    const metrics=screen.getByRole('heading',{name:'Completion time · terminal runs only'}).closest('section')!.querySelector('.metrics')!;
    expect(within(metrics as HTMLElement).getAllByText('Unavailable')).toHaveLength(13);expect(within(metrics as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });
});

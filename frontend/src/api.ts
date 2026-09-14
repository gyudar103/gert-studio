import JSONbigFactory from 'json-bigint';
import type {Model, SettingsForm, SimulationResult, ValidationReport} from './types';
export const exactJSON=JSONbigFactory({useNativeBigInt:true, strict:true, protoAction:'error', constructorAction:'error'});
export class ApiError extends Error { constructor(message:string, public diagnostics?:ValidationReport) {super(message);} }
function integer(text:string,label:string) {
  if(!/^[+-]?\d+$/.test(text)) throw new ApiError(`${label}: enter a whole number.`);
  return BigInt(text); // serialize as an integer token, including seeds outside Number's safe range
}
export function simulationBody(model:Model,form:SettingsForm) {
  return exactJSON.stringify({model,settings:{realizations:integer(form.realizations,'Realizations'),
    max_activity_instances:integer(form.max_activity_instances,'Max activity instances'),
    max_activity_completions:integer(form.max_activity_completions,'Max activity completions'),
    max_simulation_time:form.max_simulation_time,
    ...(form.seed===''?{}:{seed:integer(form.seed,'Seed')})}});
}
async function post<T>(path:string,body:string):Promise<T> {
  let response:Response;
  try {response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body});}
  catch {throw new ApiError('Cannot reach the backend. Check that Docker services are running, then retry.');}
  let data;
  try {data=exactJSON.parse(await response.text());}
  catch {throw new ApiError(`The backend returned an unreadable response (HTTP ${response.status}). Please retry or check service logs.`);}
  if(!response.ok) throw new ApiError(response.status===422?'The backend found invalid model or simulation settings. Review the diagnostics.':`Simulation service error (HTTP ${response.status}). Please retry.`, Array.isArray(data?.diagnostics)?data:undefined);
  return data as T;
}
export const validateModel=(model:Model)=>post<ValidationReport>('/api/models/validate',exactJSON.stringify(model));
export const runSimulation=(model:Model,settings:SettingsForm)=>post<SimulationResult>('/api/simulate',simulationBody(model,settings));

import {ApiError, exactJSON, validateModelJSON} from './api';
import type {Model, Workspace,SimulationResult} from './types';
import {rawModel,snapshotEnvelope,validateSnapshot,validateSnapshotModel} from './snapshot';

// Validate the original JSON types with the server before creating editable state.
// Numeric tokens stay as lossless lexemes until decimal fields become form strings.
export async function importModel(text:string) {
  let parsed:unknown;
  let saved:ReturnType<typeof validateSnapshot>|undefined;
  try {
    const quoteNumbers=(source:string)=>source.replace(/"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
      token=>token.startsWith('"')?token:JSON.stringify(token));
    const original=exactJSON.parse(quoteNumbers(text));
    if(original && typeof original==='object' && ('file_type' in original || 'file_version' in original || 'simulation_result' in original)) {
      saved=validateSnapshot(snapshotEnvelope(text));
      text=rawModel(text);
    }
    // Match complete JSON strings first, leaving their contents untouched. Quote
    // only numeric tokens so the existing strict parser never converts a model
    // number to binary64. The backend validates the ORIGINAL text and types.
    parsed=exactJSON.parse(quoteNumbers(text));
  }
  catch (error) { throw new ApiError(`Cannot import JSON: ${error instanceof Error ? error.message : 'invalid JSON'}`); }
  const report=await validateModelJSON(text);
  if(!report.valid) throw new ApiError('Import not loaded. Correct the file errors and retry; your current model is unchanged.',report);
  const {ui_metadata: _metadata,...fields}=parsed as Record<string,unknown>;
  const model=fields as unknown as Model;
  if(saved) validateSnapshotModel(saved.result,model);
  const workspace:Workspace={model,layout:{
    nodes:model.nodes.map((_,i)=>({x:(i%3)*500,y:Math.floor(i/3)*300})),
    activities:model.activities.map((a,i)=>{
      const source=model.nodes.findIndex(n=>n.id===a.source_node);
      return {x:(source%3)*500+240,y:Math.floor(source/3)*300+110+(i%2)*100};
    }),
  }};
  return {workspace,report,...saved};
}

export function exportModel(workspace:Workspace,result?:SimulationResult):string {
  if(result) return exactJSON.stringify({file_type:'gert-studio-simulation-snapshot',file_version:'0.1',model:workspace.model,simulation_settings:result.settings,simulation_result:result},null,2)+'\n';
  return JSON.stringify(workspace.model,null,2)+'\n';
}

export function downloadModel(workspace:Workspace,result?:SimulationResult) {
  const url=URL.createObjectURL(new Blob([exportModel(workspace,result)],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;
  link.download=(workspace.model.project.id.replace(/[^a-zA-Z0-9_-]/g,'_')||'gert-model')+'.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

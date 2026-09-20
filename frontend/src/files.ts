import {ApiError, exactJSON, validateModelJSON} from './api';
import type {Model, Workspace} from './types';

// Validate the original JSON types with the server before creating editable state.
// Numeric tokens stay as lossless lexemes until decimal fields become form strings.
export async function importModel(text:string) {
  let parsed:unknown;
  try {
    // Match complete JSON strings first, leaving their contents untouched. Quote
    // only numeric tokens so the existing strict parser never converts a model
    // number to binary64. The backend validates the ORIGINAL text and types.
    const decimalStrings=text.replace(/"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
      token=>token.startsWith('"')?token:JSON.stringify(token));
    parsed=exactJSON.parse(decimalStrings);
  }
  catch (error) { throw new ApiError(`Cannot import JSON: ${error instanceof Error ? error.message : 'invalid JSON'}`); }
  const report=await validateModelJSON(text);
  if(!report.valid) throw new ApiError('Import not loaded. Correct the file errors and retry; your current model is unchanged.',report);
  const {ui_metadata: _metadata,...fields}=parsed as Record<string,unknown>;
  const model=fields as unknown as Model;
  const workspace:Workspace={model,layout:{
    nodes:model.nodes.map((_,i)=>({x:(i%3)*500,y:Math.floor(i/3)*300})),
    activities:model.activities.map((a,i)=>{
      const source=model.nodes.findIndex(n=>n.id===a.source_node);
      return {x:(source%3)*500+240,y:Math.floor(source/3)*300+110+(i%2)*100};
    }),
  }};
  return {workspace,report};
}

export function exportModel(workspace:Workspace):string {
  return JSON.stringify(workspace.model,null,2)+'\n';
}

export function downloadModel(workspace:Workspace) {
  const url=URL.createObjectURL(new Blob([exportModel(workspace)],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;
  link.download=(workspace.model.project.id.replace(/[^a-zA-Z0-9_-]/g,'_')||'gert-model')+'.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

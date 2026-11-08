import Papa from 'papaparse';
import type { SurveyDataset, SurveyFieldSummary } from '../types';

export interface SurveyImportResult {
  rowCount:number;
  fields:SurveyFieldSummary[];
}

export async function summarizeSurveyCsv(file:File):Promise<SurveyImportResult> {
  const text=await file.text();
  const parsed=Papa.parse<Record<string,string>>(text,{header:true,skipEmptyLines:true,transformHeader:(h)=>h.trim()});
  if (parsed.errors.length>0 && parsed.data.length===0) throw new Error(parsed.errors[0]?.message ?? 'Could not parse this CSV.');
  const rows=parsed.data.filter(row=>Object.values(row).some(value=>String(value ?? '').trim() !== ''));
  if (rows.length===0 || !parsed.meta.fields?.length) throw new Error('This CSV does not contain response rows and column headers.');
  const fields:SurveyFieldSummary[]=parsed.meta.fields.map(field=>{
    const counts=new Map<string,number>();
    let validCount=0;
    for(const row of rows){
      const value=String(row[field] ?? '').trim();
      if(!value) continue;
      validCount++;
      counts.set(value,(counts.get(value) ?? 0)+1);
    }
    return {field,validCount,categories:Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([label,count])=>({label,count}))};
  }).filter(field=>field.validCount>0);
  return {rowCount:rows.length,fields};
}

export function createSurveyDataset(projectId:string,title:string,summary:SurveyImportResult):SurveyDataset {
  return {id:crypto.randomUUID(),projectId,title,rowCount:summary.rowCount,importedAt:new Date().toISOString(),fields:summary.fields,note:'Generated locally from a CSV upload. Only aggregate category counts are retained by this app; raw response rows are not saved.'};
}

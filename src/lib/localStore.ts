import type {AppUser,Blockage,Building,DecisionGate,EvidenceItem,Pathway,Project,RetrofitMeasure,RoadmapItem,SurveyDataset} from '../types';

const PREFIX='reclaim-platform-v2';
const PREVIOUS_PREFIX='reclaim-platform-v1';
function read<T>(key:string,fallback:T):T{
  try{
    const current=window.localStorage.getItem(`${PREFIX}:${key}`);
    if(current)return JSON.parse(current) as T;
    const previous=window.localStorage.getItem(`${PREVIOUS_PREFIX}:${key}`);
    if(previous){window.localStorage.setItem(`${PREFIX}:${key}`,previous);return JSON.parse(previous) as T;}
  }catch{return fallback;}
  return fallback;
}
function write<T>(key:string,value:T):void{window.localStorage.setItem(`${PREFIX}:${key}`,JSON.stringify(value));}
function withArray<T>(items:T[],key:string):T[]{return items.map(item=>{const record=item as Record<string,unknown>;return{...record,[key]:Array.isArray(record[key])?record[key]:[]} as T;});}

export const localStore={
  readProjects:(fallback:Project[])=>read<Project[]>('projects',fallback).map(project=>({...project,assumptions:Array.isArray(project.assumptions)?project.assumptions:[]})),
  writeProjects:(value:Project[])=>write('projects',value),
  readBuildings:(fallback:Building[])=>read<Building[]>('buildings',fallback).map(item=>({...item,documentedFacts:Array.isArray(item.documentedFacts)?item.documentedFacts:[],unknowns:Array.isArray(item.unknowns)?item.unknowns:[],evidenceTitles:Array.isArray(item.evidenceTitles)?item.evidenceTitles:[]})),
  writeBuildings:(value:Building[])=>write('buildings',value),
  readEvidence:(fallback:EvidenceItem[])=>read<EvidenceItem[]>('evidence',fallback),
  writeEvidence:(value:EvidenceItem[])=>write('evidence',value),
  readDatasets:(fallback:SurveyDataset[])=>read<SurveyDataset[]>('survey-datasets',fallback),
  writeDatasets:(value:SurveyDataset[])=>write('survey-datasets',value),
  readPathways:(fallback:Pathway[])=>withArray(read<Pathway[]>('pathways',fallback),'evidenceTitles'),
  writePathways:(value:Pathway[])=>write('pathways',value),
  readBlockages:(fallback:Blockage[])=>withArray(read<Blockage[]>('blockages',fallback),'relatedEvidenceTitles'),
  writeBlockages:(value:Blockage[])=>write('blockages',value),
  readRetrofitMeasures:(fallback:RetrofitMeasure[])=>withArray(read<RetrofitMeasure[]>('retrofit-measures',fallback),'evidenceTitles'),
  writeRetrofitMeasures:(value:RetrofitMeasure[])=>write('retrofit-measures',value),
  readDecisionGates:(fallback:DecisionGate[])=>withArray(read<DecisionGate[]>('decision-gates',fallback),'evidenceTitles'),
  writeDecisionGates:(value:DecisionGate[])=>write('decision-gates',value),
  readRoadmap:(fallback:RoadmapItem[])=>read<RoadmapItem[]>('roadmap',fallback),
  writeRoadmap:(value:RoadmapItem[])=>write('roadmap',value),
  readUser:()=>read<AppUser|null>('demo-user',null),
  writeUser:(value:AppUser|null)=>write('demo-user',value),
  clearUser:()=>{window.localStorage.removeItem(`${PREFIX}:demo-user`);window.localStorage.removeItem(`${PREVIOUS_PREFIX}:demo-user`);},
};

import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import type {AccessRequestStatus,Blockage,Building,DecisionGate,EvidenceItem,Pathway,Project,ProjectAccessRequest,ProjectActivity,ProjectMember,ProjectRole,RetrofitMeasure,RoadmapItem,SurveyDataset} from '../types';
import {demoBlockages,demoBuildings,demoDecisionGates,demoEvidence,demoPathways,demoProject,demoRoadmap,demoRetrofitMeasures,demoSurveySummary,genericDecisionGateTemplate,genericRetrofitTemplate} from '../data/seed';
import {localStore} from '../lib/localStore';
import {supabase} from '../lib/supabase';
import {useAuth} from './AuthContext';

interface ProjectDraft{name:string;description:string;country:string;region:string;}
interface BuildingDraft extends Omit<Building,'id'>{}
interface EvidenceDraft extends Omit<EvidenceItem,'id'|'addedBy'|'date'>{}
type BlockageDraft=Omit<Blockage,'id'>;
type PathwayDraft=Omit<Pathway,'id'>;
type MeasureDraft=Omit<RetrofitMeasure,'id'>;
type GateDraft=Omit<DecisionGate,'id'>;
type RoadmapDraft=Omit<RoadmapItem,'id'>;

interface WorkspaceContextValue{
  projects:Project[];buildings:Building[];evidence:EvidenceItem[];datasets:SurveyDataset[];blockages:Blockage[];pathways:Pathway[];measures:RetrofitMeasure[];gates:DecisionGate[];roadmap:RoadmapItem[];
  loading:boolean;syncMessage:string;isRemote:boolean;
  createProject:(draft:ProjectDraft)=>Promise<Project>;updateProject:(project:Project)=>Promise<void>;addBuilding:(draft:BuildingDraft)=>Promise<Building>;updateBuilding:(item:Building)=>Promise<void>;addEvidence:(draft:EvidenceDraft)=>Promise<EvidenceItem>;addSurveyDataset:(dataset:SurveyDataset)=>Promise<void>;
  addBlockage:(draft:BlockageDraft)=>Promise<void>;updateBlockage:(item:Blockage)=>Promise<void>;addPathway:(draft:PathwayDraft)=>Promise<void>;updatePathway:(item:Pathway)=>Promise<void>;addMeasure:(draft:MeasureDraft)=>Promise<void>;updateMeasure:(item:RetrofitMeasure)=>Promise<void>;addGate:(draft:GateDraft)=>Promise<void>;updateGate:(item:DecisionGate)=>Promise<void>;addRoadmapItem:(item:RoadmapDraft)=>Promise<void>;updateRoadmapItem:(item:RoadmapItem)=>Promise<void>;
  listProjectMembers:(projectId:string)=>Promise<ProjectMember[]>;addProjectMember:(projectId:string,email:string,role:ProjectRole)=>Promise<void>;updateProjectMemberRole:(projectId:string,userId:string,role:ProjectRole)=>Promise<void>;removeProjectMember:(projectId:string,userId:string)=>Promise<void>;isPlatformOperator:()=>Promise<boolean>;listAccessRequests:(projectId:string)=>Promise<ProjectAccessRequest[]>;requestProjectAccess:(projectId:string,requesterName:string,requesterEmail:string,role:Exclude<ProjectRole,'owner'>,message:string)=>Promise<void>;decideAccessRequest:(requestId:string,decision:Extract<AccessRequestStatus,'approved'|'rejected'>,note?:string)=>Promise<void>;listProjectActivity:(projectId:string)=>Promise<ProjectActivity[]>;
  loadDakotaCase:()=>Promise<void>;refresh:()=>Promise<void>;
}
const WorkspaceContext=createContext<WorkspaceContextValue|null>(null);
const makeSlug=(value:string)=>value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||`project-${Date.now()}`;
const isRemoteMode=(mode:string|undefined)=>Boolean(supabase&&mode==='supabase');
const strings=(value:unknown):string[]=>Array.isArray(value)?value.map(String):[];

function mapProject(row:any):Project{
  return {
    id:String(row.id),
    slug:String(row.slug??''),
    name:String(row.name??''),
    description:String(row.description??''),
    country:String(row.country??''),
    region:String(row.region??''),
    status:row.status??'In research',
    ownerId:row.owner_id,
    createdAt:String(row.created_at??''),
    isCaseStudy:Boolean(row.is_case_study),
    visibility:row.visibility==='public'?'public':'private',
    locationLabel:String(row.location_label??''),
    latitude:row.latitude==null?null:Number(row.latitude),
    longitude:row.longitude==null?null:Number(row.longitude),
    publicLatitude:row.public_latitude==null?null:Number(row.public_latitude),
    publicLongitude:row.public_longitude==null?null:Number(row.public_longitude),
    locationPrecision:row.location_precision??'hidden',
    publicGalleryEnabled:Boolean(row.public_gallery_enabled),
    assumptions:strings(row.assumptions)
  };
}

function mapBuilding(row:any):Building{return{id:String(row.id),projectId:String(row.project_id),name:String(row.name??''),address:String(row.address??''),buildingType:String(row.building_type??''),currentUse:String(row.current_use??''),yearBuilt:String(row.year_built??''),approximateArea:String(row.approximate_area??''),condition:row.condition??'Needs verification',notes:String(row.notes??''),documentedFacts:strings(row.documented_facts),unknowns:strings(row.unknowns),evidenceTitles:strings(row.evidence_titles)};}
function mapEvidence(row:any):EvidenceItem{return{id:String(row.id),projectId:String(row.project_id),title:String(row.title??''),kind:row.kind??'Other',status:row.status??'Needs verification',source:String(row.source??''),sourceUrl:String(row.source_url??''),summary:String(row.summary??''),addedBy:String(row.added_by??''),date:String(row.evidence_date??row.created_at??'')};}
function mapDataset(row:any):SurveyDataset{return{id:String(row.id),projectId:String(row.project_id),title:String(row.title??''),rowCount:Number(row.row_count??0),importedAt:String(row.created_at??''),fields:Array.isArray(row.aggregate_fields)?row.aggregate_fields:[],note:String(row.note??'')};}
function blockageStatusFromDb(value:string):Blockage['status']{if(value==='validating')return'Evidence linked';if(value==='confirmed')return'Under review';if(value==='resolved')return'Resolved';if(value==='deferred')return'Deferred';return'Needs verification';}
function blockageStatusToDb(value:Blockage['status']):string{return value==='Evidence linked'?'validating':value==='Under review'?'confirmed':value==='Resolved'?'resolved':value==='Deferred'?'deferred':'identified';}
function measureStatusFromDb(value:string):RetrofitMeasure['status']{const map:Record<string,RetrofitMeasure['status']>={proposed:'Proposed',assessing:'Assessing',selected:'Selected',in_progress:'In progress',complete:'Complete',deferred:'Deferred',rejected:'Rejected'};return map[value]??'Proposed';}
function measureStatusToDb(value:RetrofitMeasure['status']):string{return value==='In progress'?'in_progress':value.toLowerCase();}
function gateStatusFromDb(value:string):DecisionGate['status']{const map:Record<string,DecisionGate['status']>={pending:'Open',ready:'Evidence linked',blocked:'Blocked',deferred:'Deferred',approved:'Approved',rejected:'Rejected'};return map[value]??'Open';}
function gateStatusToDb(value:DecisionGate['status']):string{return value==='Evidence linked'?'ready':value==='Open'?'pending':value.toLowerCase();}
function mapBlockage(row:any):Blockage{return{id:String(row.id),projectId:String(row.project_id),buildingId:row.building_id?String(row.building_id):undefined,category:String(row.category??''),title:String(row.title??''),summary:String(row.summary??''),impact:String(row.impact??''),confidence:row.confidence??'Unknown',status:blockageStatusFromDb(String(row.status??'identified')),possibleResponses:strings(row.response_ideas),prerequisites:strings(row.prerequisites),evidenceNeeded:strings(row.evidence_needed),relatedEvidenceTitles:strings(row.related_evidence_titles)};}
function mapPathway(row:any):Pathway{return{id:String(row.id),projectId:String(row.project_id),title:String(row.title??''),summary:String(row.summary??''),status:row.status??'Research candidate',audience:String(row.audience??''),opportunity:String(row.opportunity??''),requirements:strings(row.requirements),supportingSignals:strings(row.supporting_signals),tradeoffs:strings(row.tradeoffs),evidenceNeeded:strings(row.evidence_needed),evidenceTitles:strings(row.evidence_titles)};}
function mapMeasure(row:any):RetrofitMeasure{return{id:String(row.id),projectId:String(row.project_id),orderIndex:Number(row.order_index??0),stage:String(row.category??''),title:String(row.title??''),intent:String(row.summary??''),prerequisites:strings(row.prerequisites),watchouts:strings(row.watchouts),evidenceNeeded:strings(row.evidence_needed),evidenceTitles:strings(row.evidence_titles),status:measureStatusFromDb(String(row.status??'proposed'))};}
function mapGate(row:any):DecisionGate{return{id:String(row.id),projectId:String(row.project_id),orderIndex:Number(row.order_index??0),title:String(row.title??''),question:strings(row.questions)[0]??'',reason:String(row.summary??''),requirements:strings(row.checks),evidenceTitles:strings(row.evidence_titles),status:gateStatusFromDb(String(row.status??'pending'))};}
function mapRoadmap(row:any):RoadmapItem{return{id:String(row.id),projectId:String(row.project_id),phase:String(row.phase??''),title:String(row.title??''),description:String(row.description??''),status:row.status??'Not started',owner:String(row.owner??'')};}
function mapAccessRequest(row:any):ProjectAccessRequest{return{id:String(row.id),projectId:String(row.project_id),requesterId:row.requester_id?String(row.requester_id):undefined,requesterName:String(row.requester_name??''),requesterEmail:String(row.requester_email??''),requestedRole:row.requested_role??'viewer',message:String(row.message??''),status:row.status??'pending',decisionNote:String(row.decision_note??''),createdAt:String(row.created_at??''),decidedAt:row.decided_at?String(row.decided_at):undefined};}
function mapActivity(row:any):ProjectActivity{return{id:String(row.id),projectId:String(row.project_id),actorId:row.actor_id?String(row.actor_id):undefined,entityType:String(row.entity_type??''),entityId:row.entity_id?String(row.entity_id):undefined,action:String(row.action??''),summary:String(row.summary??''),metadata:row.metadata&&typeof row.metadata==='object'?row.metadata:{},createdAt:String(row.created_at??'')};}

function genericRoadmap(projectId:string):Omit<RoadmapItem,'id'>[]{return[
  {projectId,phase:'01',title:'Confirm the building record',description:'Verify current use, owner, condition, services and available plans.',status:'Not started'},
  {projectId,phase:'02',title:'Understand local needs',description:'Gather site-specific input and record who has and has not been heard.',status:'Not started'},
  {projectId,phase:'03',title:'Compare future uses and retrofit routes',description:'Use cited evidence, clear trade-offs and explicit prerequisites.',status:'Not started'},
  {projectId,phase:'04',title:'Resolve decision gates',description:'Identify specialist, permission, operating and cost reviews before a recommendation.',status:'Not started'},
];}
function defaultMeasureRows(projectId:string,userId:string){return genericRetrofitTemplate.map(item=>({project_id:projectId,order_index:item.orderIndex,category:item.stage,title:item.title,summary:item.intent,requirements:[],prerequisites:item.prerequisites,tradeoffs:[],signals:[],watchouts:item.watchouts,evidence_needed:item.evidenceNeeded,evidence_titles:item.evidenceTitles,status:measureStatusToDb(item.status),created_by:userId}));}
function defaultGateRows(projectId:string,userId:string){return genericDecisionGateTemplate.map(item=>({project_id:projectId,order_index:item.orderIndex,title:item.title,category:item.title,summary:item.reason,questions:[item.question],checks:item.requirements,response_ideas:[],prerequisites:item.requirements,watchouts:[],evidence_titles:item.evidenceTitles,status:gateStatusToDb(item.status),created_by:userId}));}
function gateRow(item:GateDraft,createdBy?:string){return{project_id:item.projectId,order_index:item.orderIndex,title:item.title,category:item.title,summary:item.reason,questions:[item.question],checks:item.requirements,response_ideas:[],prerequisites:item.requirements,watchouts:[],evidence_titles:item.evidenceTitles,status:gateStatusToDb(item.status),...(createdBy?{created_by:createdBy}:{})};}

export function WorkspaceProvider({children}:{children:ReactNode}){
  const{user}=useAuth();const isRemote=isRemoteMode(user?.mode);
  const[projects,setProjects]=useState<Project[]>(()=>localStore.readProjects([demoProject]));
  const[buildings,setBuildings]=useState<Building[]>(()=>localStore.readBuildings(demoBuildings));
  const[evidence,setEvidence]=useState<EvidenceItem[]>(()=>localStore.readEvidence(demoEvidence));
  const[datasets,setDatasets]=useState<SurveyDataset[]>(()=>localStore.readDatasets([demoSurveySummary]));
  const[blockages,setBlockages]=useState<Blockage[]>(()=>localStore.readBlockages(demoBlockages));
  const[pathways,setPathways]=useState<Pathway[]>(()=>localStore.readPathways(demoPathways));
  const[measures,setMeasures]=useState<RetrofitMeasure[]>(()=>localStore.readRetrofitMeasures(demoRetrofitMeasures));
  const[gates,setGates]=useState<DecisionGate[]>(()=>localStore.readDecisionGates(demoDecisionGates));
  const[roadmap,setRoadmap]=useState<RoadmapItem[]>(()=>localStore.readRoadmap(demoRoadmap));
  const[loading,setLoading]=useState(false);const[syncMessage,setSyncMessage]=useState('');

  const refresh=useCallback(async()=>{
    if(!supabase||user?.mode!=='supabase')return;
    setLoading(true);setSyncMessage('Connecting…');
    const results=await Promise.all([
      supabase.from('projects').select('*').order('created_at',{ascending:false}),
      supabase.from('buildings').select('*'),
      supabase.from('evidence_items').select('*').order('created_at',{ascending:false}),
      supabase.from('survey_datasets').select('*').order('created_at',{ascending:false}),
      supabase.from('blockages').select('*').order('created_at',{ascending:true}),
      supabase.from('pathways').select('*').order('created_at',{ascending:true}),
      supabase.from('retrofit_measures').select('*').order('order_index',{ascending:true}),
      supabase.from('decision_gates').select('*').order('order_index',{ascending:true}),
      supabase.from('roadmap_items').select('*').order('created_at',{ascending:true}),
    ]);
    const error=results.find(result=>result.error)?.error;
    if(error){setProjects([]);setBuildings([]);setEvidence([]);setDatasets([]);setBlockages([]);setPathways([]);setMeasures([]);setGates([]);setRoadmap([]);const missing=/relation .* does not exist|column .* does not exist|blockages|retrofit_measures|decision_gates|evidence_titles|audience|supporting_signals/i.test(error.message);setSyncMessage(missing?`Supabase schema is missing or outdated. Apply the initial migration or fresh schema setup, then refresh. ${error.message}`:`Could not load Supabase records: ${error.message}. Check the project URL, public key and RLS policies.`);setLoading(false);return;}
    const[p,b,e,d,bl,pa,m,g,r]=results;
    setProjects((p.data??[]).map(mapProject));setBuildings((b.data??[]).map(mapBuilding));setEvidence((e.data??[]).map(mapEvidence));setDatasets((d.data??[]).map(mapDataset));setBlockages((bl.data??[]).map(mapBlockage));setPathways((pa.data??[]).map(mapPathway));setMeasures((m.data??[]).map(mapMeasure));setGates((g.data??[]).map(mapGate));setRoadmap((r.data??[]).map(mapRoadmap));setSyncMessage('Connected to your Supabase project.');setLoading(false);
  },[user?.id,user?.mode]);

  useEffect(()=>{if(isRemote){void refresh();return;}setProjects(localStore.readProjects([demoProject]));setBuildings(localStore.readBuildings(demoBuildings));setEvidence(localStore.readEvidence(demoEvidence));setDatasets(localStore.readDatasets([demoSurveySummary]));setBlockages(localStore.readBlockages(demoBlockages));setPathways(localStore.readPathways(demoPathways));setMeasures(localStore.readRetrofitMeasures(demoRetrofitMeasures));setGates(localStore.readDecisionGates(demoDecisionGates));setRoadmap(localStore.readRoadmap(demoRoadmap));setSyncMessage('Local demo. Changes stay in this browser.');},[user?.id,user?.mode,isRemote,refresh]);
  useEffect(()=>{if(isRemote)return;localStore.writeProjects(projects);localStore.writeBuildings(buildings);localStore.writeEvidence(evidence);localStore.writeDatasets(datasets);localStore.writeBlockages(blockages);localStore.writePathways(pathways);localStore.writeRetrofitMeasures(measures);localStore.writeDecisionGates(gates);localStore.writeRoadmap(roadmap);},[isRemote,projects,buildings,evidence,datasets,blockages,pathways,measures,gates,roadmap]);

  const createProject=useCallback(async(draft:ProjectDraft)=>{
    if(isRemote&&supabase&&user){
      const{data,error}=await supabase.from('projects').insert({owner_id:user.id,slug:`${makeSlug(draft.name)}-${Date.now().toString(36)}`,name:draft.name,description:draft.description,country:draft.country,region:draft.region,status:'In research',assumptions:[]}).select().single();if(error)throw error;const project=mapProject(data);
      const results=await Promise.all([supabase.from('retrofit_measures').insert(defaultMeasureRows(project.id,user.id)),supabase.from('decision_gates').insert(defaultGateRows(project.id,user.id)),supabase.from('roadmap_items').insert(genericRoadmap(project.id).map(item=>({...item,created_by:user.id})))]);
      const failure=results.find(result=>result.error)?.error;if(failure){await supabase.from('projects').delete().eq('id',project.id);throw new Error(`Project setup was rolled back because starter records did not save: ${failure.message}`);}await refresh();return project;
    }
    const project:Project={id:crypto.randomUUID(),slug:makeSlug(draft.name),name:draft.name,description:draft.description,country:draft.country,region:draft.region,status:'In research',createdAt:new Date().toISOString(),ownerId:user?.id,assumptions:[]};
    setProjects(current=>[project,...current]);setMeasures(current=>[...genericRetrofitTemplate.map(item=>({...item,projectId:project.id,id:crypto.randomUUID()})),...current]);setGates(current=>[...genericDecisionGateTemplate.map(item=>({...item,projectId:project.id,id:crypto.randomUUID()})),...current]);setRoadmap(current=>[...genericRoadmap(project.id).map(item=>({...item,id:crypto.randomUUID()})),...current]);return project;
  },[isRemote,user,refresh]);

  const updateProject=useCallback(async(project:Project)=>{
  if(isRemote&&supabase){
    const{error}=await supabase
      .from('projects')
      .update({
        name:project.name,
        description:project.description,
        country:project.country,
        region:project.region,
        status:project.status,
        visibility:project.visibility==='public'?'public':'private',
        location_label:project.locationLabel??'',
        latitude:project.latitude??null,
        longitude:project.longitude??null,
        public_latitude:project.publicLatitude??null,
        public_longitude:project.publicLongitude??null,
        location_precision:project.locationPrecision??'hidden',
        public_gallery_enabled:Boolean(project.publicGalleryEnabled),
        assumptions:project.assumptions??[],
        updated_at:new Date().toISOString()
      })
      .eq('id',project.id);

    if(error)throw error;

    if(user){
      await supabase.from('project_activity').insert({
        project_id:project.id,
        actor_id:user.id,
        entity_type:'project',
        entity_id:project.id,
        action:'updated',
        summary:project.visibility==='public'
          ?'Project published publicly'
          :'Project made private',
        metadata:{
          status:project.status,
          visibility:project.visibility,
          location_precision:project.locationPrecision??'hidden',
          public_gallery_enabled:Boolean(project.publicGalleryEnabled)
        }
      });
    }
  }

  setProjects(current=>current.map(item=>item.id===project.id?project:item));
},[isRemote,user]);

  const addBuilding=useCallback(async(draft:BuildingDraft)=>{if(isRemote&&supabase&&user){const{data,error}=await supabase.from('buildings').insert({project_id:draft.projectId,name:draft.name,address:draft.address,building_type:draft.buildingType,current_use:draft.currentUse,year_built:draft.yearBuilt,approximate_area:draft.approximateArea,condition:draft.condition,notes:draft.notes,documented_facts:draft.documentedFacts,unknowns:draft.unknowns,evidence_titles:draft.evidenceTitles,created_by:user.id}).select().single();if(error)throw error;const item=mapBuilding(data);setBuildings(current=>[...current,item]);return item;}const item={...draft,id:crypto.randomUUID()};setBuildings(current=>[...current,item]);return item;},[isRemote,user]);
  const updateBuilding=useCallback(async(item:Building)=>{if(isRemote&&supabase){const{error}=await supabase.from('buildings').update({name:item.name,address:item.address,building_type:item.buildingType,current_use:item.currentUse,year_built:item.yearBuilt,approximate_area:item.approximateArea,condition:item.condition,notes:item.notes,documented_facts:item.documentedFacts,unknowns:item.unknowns,evidence_titles:item.evidenceTitles}).eq('id',item.id);if(error)throw error;}setBuildings(current=>current.map(row=>row.id===item.id?item:row));},[isRemote]);
  const addEvidence=useCallback(async(draft:EvidenceDraft)=>{if(isRemote&&supabase&&user){const{data,error}=await supabase.from('evidence_items').insert({project_id:draft.projectId,title:draft.title,kind:draft.kind,status:draft.status,source:draft.source,source_url:draft.sourceUrl,summary:draft.summary,added_by:user.name,created_by:user.id,evidence_date:new Date().toISOString().slice(0,10)}).select().single();if(error)throw error;const item=mapEvidence(data);setEvidence(current=>[item,...current]);return item;}const item:EvidenceItem={...draft,id:crypto.randomUUID(),addedBy:user?.name??'Researcher',date:new Date().toISOString().slice(0,10)};setEvidence(current=>[item,...current]);return item;},[isRemote,user]);
  const addSurveyDataset=useCallback(async(dataset:SurveyDataset)=>{if(isRemote&&supabase&&user){const{data,error}=await supabase.from('survey_datasets').insert({project_id:dataset.projectId,title:dataset.title,row_count:dataset.rowCount,aggregate_fields:dataset.fields,note:dataset.note,uploaded_by:user.id}).select().single();if(error)throw error;setDatasets(current=>[mapDataset(data),...current]);return;}setDatasets(current=>[dataset,...current]);},[isRemote,user]);

  const addBlockage=useCallback(async(draft:BlockageDraft)=>{if(isRemote&&supabase&&user){const{data,error}=await supabase.from('blockages').insert({project_id:draft.projectId,building_id:draft.buildingId||null,category:draft.category,title:draft.title,summary:draft.summary,impact:draft.impact,confidence:draft.confidence,status:blockageStatusToDb(draft.status),response_ideas:draft.possibleResponses,prerequisites:draft.prerequisites,evidence_needed:draft.evidenceNeeded,related_evidence_titles:draft.relatedEvidenceTitles,created_by:user.id}).select().single();if(error)throw error;setBlockages(current=>[mapBlockage(data),...current]);return;}setBlockages(current=>[{...draft,id:crypto.randomUUID()},...current]);},[isRemote,user]);
  const updateBlockage=useCallback(async(item:Blockage)=>{if(isRemote&&supabase){const{error}=await supabase.from('blockages').update({building_id:item.buildingId||null,category:item.category,title:item.title,summary:item.summary,impact:item.impact,confidence:item.confidence,status:blockageStatusToDb(item.status),response_ideas:item.possibleResponses,prerequisites:item.prerequisites,evidence_needed:item.evidenceNeeded,related_evidence_titles:item.relatedEvidenceTitles}).eq('id',item.id);if(error)throw error;}setBlockages(current=>current.map(row=>row.id===item.id?item:row));},[isRemote]);

  const addPathway=useCallback(async(draft:PathwayDraft)=>{if(isRemote&&supabase&&user){const{data,error}=await supabase.from('pathways').insert({project_id:draft.projectId,title:draft.title,summary:draft.summary,status:draft.status,audience:draft.audience,opportunity:draft.opportunity,requirements:draft.requirements,supporting_signals:draft.supportingSignals,tradeoffs:draft.tradeoffs,evidence_needed:draft.evidenceNeeded,evidence_titles:draft.evidenceTitles,created_by:user.id}).select().single();if(error)throw error;setPathways(current=>[mapPathway(data),...current]);return;}setPathways(current=>[{...draft,id:crypto.randomUUID()},...current]);},[isRemote,user]);
  const updatePathway=useCallback(async(item:Pathway)=>{if(isRemote&&supabase){const{error}=await supabase.from('pathways').update({title:item.title,summary:item.summary,status:item.status,audience:item.audience,opportunity:item.opportunity,requirements:item.requirements,supporting_signals:item.supportingSignals,tradeoffs:item.tradeoffs,evidence_needed:item.evidenceNeeded,evidence_titles:item.evidenceTitles}).eq('id',item.id);if(error)throw error;}setPathways(current=>current.map(row=>row.id===item.id?item:row));},[isRemote]);

  const addMeasure=useCallback(async(draft:MeasureDraft)=>{if(isRemote&&supabase&&user){const{data,error}=await supabase.from('retrofit_measures').insert({project_id:draft.projectId,order_index:draft.orderIndex,category:draft.stage,title:draft.title,summary:draft.intent,requirements:[],prerequisites:draft.prerequisites,tradeoffs:[],signals:[],watchouts:draft.watchouts,evidence_needed:draft.evidenceNeeded,evidence_titles:draft.evidenceTitles,status:measureStatusToDb(draft.status),created_by:user.id}).select().single();if(error)throw error;setMeasures(current=>[...current,mapMeasure(data)].sort((a,b)=>a.orderIndex-b.orderIndex));return;}setMeasures(current=>[...current,{...draft,id:crypto.randomUUID()}].sort((a,b)=>a.orderIndex-b.orderIndex));},[isRemote,user]);
  const updateMeasure=useCallback(async(item:RetrofitMeasure)=>{if(isRemote&&supabase){const{error}=await supabase.from('retrofit_measures').update({order_index:item.orderIndex,category:item.stage,title:item.title,summary:item.intent,prerequisites:item.prerequisites,watchouts:item.watchouts,evidence_needed:item.evidenceNeeded,evidence_titles:item.evidenceTitles,status:measureStatusToDb(item.status)}).eq('id',item.id);if(error)throw error;}setMeasures(current=>current.map(row=>row.id===item.id?item:row).sort((a,b)=>a.orderIndex-b.orderIndex));},[isRemote]);

  const addGate=useCallback(async(draft:GateDraft)=>{if(isRemote&&supabase&&user){const{data,error}=await supabase.from('decision_gates').insert(gateRow(draft,user.id)).select().single();if(error)throw error;setGates(current=>[...current,mapGate(data)].sort((a,b)=>a.orderIndex-b.orderIndex));return;}setGates(current=>[...current,{...draft,id:crypto.randomUUID()}].sort((a,b)=>a.orderIndex-b.orderIndex));},[isRemote,user]);
  const updateGate=useCallback(async(item:DecisionGate)=>{if(isRemote&&supabase){const{error}=await supabase.from('decision_gates').update({order_index:item.orderIndex,title:item.title,category:item.title,summary:item.reason,questions:[item.question],checks:item.requirements,prerequisites:item.requirements,evidence_titles:item.evidenceTitles,status:gateStatusToDb(item.status)}).eq('id',item.id);if(error)throw error;}setGates(current=>current.map(row=>row.id===item.id?item:row).sort((a,b)=>a.orderIndex-b.orderIndex));},[isRemote]);
  const addRoadmapItem=useCallback(async(item:RoadmapDraft)=>{if(isRemote&&supabase&&user){const{data,error}=await supabase.from('roadmap_items').insert({project_id:item.projectId,phase:item.phase,title:item.title,description:item.description,status:item.status,owner:item.owner??'',created_by:user.id}).select().single();if(error)throw error;setRoadmap(current=>[...current,mapRoadmap(data)]);return;}setRoadmap(current=>[...current,{...item,id:crypto.randomUUID()}]);},[isRemote,user]);
  const updateRoadmapItem=useCallback(async(item:RoadmapItem)=>{if(isRemote&&supabase){const{error}=await supabase.from('roadmap_items').update({title:item.title,description:item.description,status:item.status,owner:item.owner??''}).eq('id',item.id);if(error)throw error;}setRoadmap(current=>current.map(row=>row.id===item.id?item:row));},[isRemote]);

  const listProjectMembers=useCallback(async(projectId:string):Promise<ProjectMember[]>=>{if(!isRemote||!supabase)throw new Error('Project access management requires Supabase.');const{data,error}=await supabase.rpc('list_reclaim_project_members',{target_project:projectId});if(error)throw error;return((data??[]) as any[]).map(row=>({projectId,userId:String(row.user_id),displayName:String(row.display_name??''),email:String(row.email??''),role:row.role as ProjectRole}));},[isRemote]);
  const addProjectMember=useCallback(async(projectId:string,email:string,role:ProjectRole)=>{if(!isRemote||!supabase)throw new Error('Project access management requires Supabase.');const{error}=await supabase.rpc('add_reclaim_project_member',{target_project:projectId,target_email:email,target_role:role});if(error)throw error;},[isRemote]);
  const updateProjectMemberRole=useCallback(async(projectId:string,userId:string,role:ProjectRole)=>{if(!isRemote||!supabase)throw new Error('Project access management requires Supabase.');if(role==='owner')throw new Error('Ownership cannot be transferred from this screen.');const{error}=await supabase.from('project_members').update({role}).eq('project_id',projectId).eq('user_id',userId);if(error)throw error;},[isRemote]);
  const removeProjectMember=useCallback(async(projectId:string,userId:string)=>{if(!isRemote||!supabase)throw new Error('Project access management requires Supabase.');const{error}=await supabase.from('project_members').delete().eq('project_id',projectId).eq('user_id',userId);if(error)throw error;},[isRemote]);
  const isPlatformOperator=useCallback(async():Promise<boolean>=>{if(!isRemote||!supabase)return false;const{data,error}=await supabase.rpc('is_reclaim_platform_operator');if(error)throw error;return Boolean(data);},[isRemote]);
  const listAccessRequests=useCallback(async(projectId:string):Promise<ProjectAccessRequest[]>=>{if(!isRemote||!supabase)throw new Error('Access requests require a shared workspace.');const{data,error}=await supabase.from('project_access_requests').select('*').eq('project_id',projectId).order('created_at',{ascending:false});if(error)throw error;return(data??[]).map(mapAccessRequest);},[isRemote]);
  const requestProjectAccess=useCallback(async(projectId:string,requesterName:string,requesterEmail:string,role:Exclude<ProjectRole,'owner'>,message:string)=>{if(!supabase)throw new Error('Access requests are unavailable in this workspace.');const{error}=await supabase.from('project_access_requests').insert({project_id:projectId,requester_id:user?.mode==='supabase'?user.id:null,requester_name:requesterName.trim(),requester_email:requesterEmail.trim().toLowerCase(),requested_role:role,message:message.trim()});if(error)throw error;},[user]);
  const decideAccessRequest=useCallback(async(requestId:string,decision:Extract<AccessRequestStatus,'approved'|'rejected'>,note='')=>{if(!isRemote||!supabase)throw new Error('Access decisions require a shared workspace.');const{error}=await supabase.rpc('decide_reclaim_access_request',{p_request_id:requestId,p_decision:decision,p_decision_note:note});if(error)throw error;},[isRemote]);
  const listProjectActivity=useCallback(async(projectId:string):Promise<ProjectActivity[]>=>{if(!isRemote||!supabase)throw new Error('Project activity requires a shared workspace.');const{data,error}=await supabase.from('project_activity').select('*').eq('project_id',projectId).order('created_at',{ascending:false}).limit(40);if(error)throw error;return(data??[]).map(mapActivity);},[isRemote]);

  const loadDakotaCase=useCallback(async()=>{
    if(projects.some(project=>project.slug==='dakota-crescent'))return;
    if(isRemote&&supabase&&user){
      const{data,error}=await supabase.from('projects').insert({owner_id:user.id,slug:'dakota-crescent',name:demoProject.name,description:demoProject.description,country:demoProject.country,region:demoProject.region,status:demoProject.status,is_case_study:true,visibility:'public',assumptions:[]}).select().single();if(error)throw error;const project=mapProject(data);
      try{
        const buildingRows=demoBuildings.map(item=>({project_id:project.id,name:item.name,address:item.address,building_type:item.buildingType,current_use:item.currentUse,year_built:item.yearBuilt,approximate_area:item.approximateArea,condition:item.condition,notes:item.notes,documented_facts:item.documentedFacts,unknowns:item.unknowns,evidence_titles:item.evidenceTitles,created_by:user.id}));
        const evidenceRows=demoEvidence.map(item=>({project_id:project.id,title:item.title,kind:item.kind,status:item.status,source:item.source,source_url:item.sourceUrl,summary:item.summary,added_by:item.addedBy,created_by:user.id,evidence_date:item.date}));
        const[b,e]=await Promise.all([supabase.from('buildings').insert(buildingRows).select(),supabase.from('evidence_items').insert(evidenceRows).select()]);if(b.error)throw b.error;if(e.error)throw e.error;
        const buildingMap=new Map(demoBuildings.map((item,index)=>[item.id,String(b.data?.[index]?.id)]));
        const blockageRows=demoBlockages.map(item=>({project_id:project.id,building_id:item.buildingId?buildingMap.get(item.buildingId)??null:null,category:item.category,title:item.title,summary:item.summary,impact:item.impact,confidence:item.confidence,status:blockageStatusToDb(item.status),response_ideas:item.possibleResponses,prerequisites:item.prerequisites,evidence_needed:item.evidenceNeeded,related_evidence_titles:item.relatedEvidenceTitles,created_by:user.id}));
        const pathwayRows=demoPathways.map(item=>({project_id:project.id,title:item.title,summary:item.summary,status:item.status,audience:item.audience,opportunity:item.opportunity,requirements:item.requirements,supporting_signals:item.supportingSignals,tradeoffs:item.tradeoffs,evidence_needed:item.evidenceNeeded,evidence_titles:item.evidenceTitles,created_by:user.id}));
        const measureRows=demoRetrofitMeasures.map(item=>({project_id:project.id,order_index:item.orderIndex,category:item.stage,title:item.title,summary:item.intent,requirements:[],prerequisites:item.prerequisites,tradeoffs:[],signals:[],watchouts:item.watchouts,evidence_needed:item.evidenceNeeded,evidence_titles:item.evidenceTitles,status:measureStatusToDb(item.status),created_by:user.id}));
        const gateRows=demoDecisionGates.map(item=>gateRow(item,user.id));
        const roadmapRows=demoRoadmap.map(item=>({project_id:project.id,phase:item.phase,title:item.title,description:item.description,status:item.status,owner:item.owner??'',created_by:user.id}));
        const writes=await Promise.all([supabase.from('blockages').insert(blockageRows),supabase.from('pathways').insert(pathwayRows),supabase.from('retrofit_measures').insert(measureRows),supabase.from('decision_gates').insert(gateRows),supabase.from('roadmap_items').insert(roadmapRows),supabase.from('survey_datasets').insert({project_id:project.id,title:demoSurveySummary.title,row_count:demoSurveySummary.rowCount,aggregate_fields:[],note:demoSurveySummary.note,uploaded_by:user.id})]);
        const failed=writes.find(result=>result.error)?.error;if(failed)throw failed;
      }catch(error){await supabase.from('projects').delete().eq('id',project.id);throw new Error(`Dakota sample setup was rolled back because one or more records did not save: ${error instanceof Error?error.message:'Unknown database error'}`);}
      await refresh();return;
    }
    setProjects(current=>[demoProject,...current]);setBuildings(current=>[...demoBuildings,...current]);setEvidence(current=>[...demoEvidence,...current]);setDatasets(current=>[demoSurveySummary,...current]);setBlockages(current=>[...demoBlockages,...current]);setPathways(current=>[...demoPathways,...current]);setMeasures(current=>[...demoRetrofitMeasures,...current]);setGates(current=>[...demoDecisionGates,...current]);setRoadmap(current=>[...demoRoadmap,...current]);
  },[projects,isRemote,user,refresh]);

  const value=useMemo<WorkspaceContextValue>(()=>({projects,buildings,evidence,datasets,blockages,pathways,measures,gates,roadmap,loading,syncMessage,isRemote,createProject,updateProject,addBuilding,updateBuilding,addEvidence,addSurveyDataset,addBlockage,updateBlockage,addPathway,updatePathway,addMeasure,updateMeasure,addGate,updateGate,addRoadmapItem,updateRoadmapItem,listProjectMembers,addProjectMember,updateProjectMemberRole,removeProjectMember,isPlatformOperator,listAccessRequests,requestProjectAccess,decideAccessRequest,listProjectActivity,loadDakotaCase,refresh}),[projects,buildings,evidence,datasets,blockages,pathways,measures,gates,roadmap,loading,syncMessage,isRemote,createProject,updateProject,addBuilding,updateBuilding,addEvidence,addSurveyDataset,addBlockage,updateBlockage,addPathway,updatePathway,addMeasure,updateMeasure,addGate,updateGate,addRoadmapItem,updateRoadmapItem,listProjectMembers,addProjectMember,updateProjectMemberRole,removeProjectMember,isPlatformOperator,listAccessRequests,requestProjectAccess,decideAccessRequest,listProjectActivity,loadDakotaCase,refresh]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace(){const context=useContext(WorkspaceContext);if(!context)throw new Error('useWorkspace must be used inside WorkspaceProvider');return context;}

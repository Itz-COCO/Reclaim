import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,Download,ExternalLink,Plus,Printer,Settings2} from 'lucide-react';
import {Link,useParams,useSearchParams} from 'react-router-dom';
import type {Blockage,Building,DecisionGate,MeasureStatus,Pathway,Project,RecordStatus,RetrofitMeasure,RoadmapItem} from '../types';
import {useWorkspace} from '../context/WorkspaceContext';
import {BlockageMap} from '../components/BlockageMap';
import {ProjectJourneyNav} from '../components/ProjectJourneyNav';
import {RecordFormModal} from '../components/RecordFormModal';
import {ProjectAccess} from '../components/ProjectAccess';
import {SurveySummary} from '../components/SurveySummary';
import {EmptyState,Notice,PageHeader,StatusBadge} from '../components/UI';
import {surveyMetricGroups} from '../data/seed';
import {downloadDecisionBrief} from '../lib/decisionBrief';

const steps=[
  {id:'case',label:'Case file',short:'Case'},
  {id:'blockages',label:'Blockage map',short:'Blockages'},
  {id:'survey',label:'Survey and needs',short:'Survey'},
  {id:'uses',label:'Future uses',short:'Uses'},
  {id:'retrofit',label:'Retrofit plan',short:'Retrofit'},
  {id:'compare',label:'Compare routes',short:'Compare'},
  {id:'roadmap',label:'Roadmap',short:'Roadmap'},
  {id:'evidence',label:'Evidence',short:'Evidence'},
  {id:'brief',label:'Decision brief',short:'Brief'},
];
const journeyGroups=[
  {id:'case',label:'Case file',short:'Case',firstStep:'case'},
  {id:'investigate',label:'Investigate',short:'Review',firstStep:'blockages'},
  {id:'uses',label:'Future uses',short:'Uses',firstStep:'uses'},
  {id:'plan',label:'Plan and compare',short:'Plan',firstStep:'retrofit'},
  {id:'brief',label:'Decision brief',short:'Brief',firstStep:'brief'},
];
const groupByStep:Record<string,string>={case:'case',blockages:'investigate',survey:'investigate',evidence:'investigate',uses:'uses',retrofit:'plan',compare:'plan',roadmap:'plan',brief:'brief'};
const substepsByGroup:Record<string,string[]>={investigate:['blockages','survey','evidence'],plan:['retrofit','compare','roadmap']};
type EditorKind='building'|'blockage'|'use'|'measure'|'gate'|'roadmap'|'project';
type StressCase={id:string;label:string;effect:string};
const stressCases:StressCase[]=[
  {id:'roof',label:'Roof capacity is unknown',effect:'Keep on-site generation conditional until a structural review is available.'},
  {id:'operator',label:'No shared-system operator is identified',effect:'A coordinated route needs a responsible operator and maintenance agreement.'},
  {id:'load',label:'Building loads are not measured',effect:'Do not compare system size, energy yield or savings from generic assumptions.'},
  {id:'planning',label:'Permissions or ownership are unresolved',effect:'Both routes need current planning advice and owner confirmation.'},
  {id:'survey',label:'Survey responses are not local',effect:'Gather site-specific input before treating a reuse preference as a design brief.'},
];
const measureStatuses:MeasureStatus[]=['Proposed','Assessing','Selected','In progress','Complete','Deferred','Rejected'];
const roadmapStatuses:RecordStatus[]=['Not started','In progress','Held','Complete'];
const gateStatuses:DecisionGate['status'][]=['Open','Evidence linked','Blocked','Deferred','Approved','Rejected'];

export function ProjectPage(){
  const{projectId=''}=useParams();
  const[params,setParams]=useSearchParams();
  const{
    projects,buildings,evidence,datasets,blockages,pathways,measures,gates,roadmap,
    addBuilding,updateBuilding,addBlockage,updateBlockage,addPathway,updatePathway,
    addMeasure,updateMeasure,addGate,updateGate,addRoadmapItem,updateRoadmapItem,
    updateProject,addSurveyDataset,loading,isRemote,
  }=useWorkspace();
  const[editor,setEditor]=useState<EditorKind|null>(null);
  const[editing,setEditing]=useState<any>(undefined);
  const[selectedBlockage,setSelectedBlockage]=useState('');
  const[stress,setStress]=useState<string[]>([]);
  const[error,setError]=useState('');
  const[notice,setNotice]=useState('');
  const project=projects.find(item=>item.id===projectId);
  const requestedStep=params.get('step');
  const currentId=steps.some(item=>item.id===requestedStep)?requestedStep as string:'case';
  const currentGroupId=groupByStep[currentId]??'case';const currentSubsteps=substepsByGroup[currentGroupId]??[];

  const projectBuildings=useMemo(()=>buildings.filter(item=>item.projectId===projectId),[buildings,projectId]);
  const projectEvidence=useMemo(()=>evidence.filter(item=>item.projectId===projectId),[evidence,projectId]);
  const projectDatasets=useMemo(()=>datasets.filter(item=>item.projectId===projectId),[datasets,projectId]);
  const projectBlockages=useMemo(()=>blockages.filter(item=>item.projectId===projectId),[blockages,projectId]);
  const projectPathways=useMemo(()=>pathways.filter(item=>item.projectId===projectId),[pathways,projectId]);
  const projectMeasures=useMemo(()=>measures.filter(item=>item.projectId===projectId).slice().sort((a,b)=>a.orderIndex-b.orderIndex),[measures,projectId]);
  const projectGates=useMemo(()=>gates.filter(item=>item.projectId===projectId).slice().sort((a,b)=>a.orderIndex-b.orderIndex),[gates,projectId]);
  const projectRoadmap=useMemo(()=>roadmap.filter(item=>item.projectId===projectId),[roadmap,projectId]);
  const stepIndex=steps.findIndex(item=>item.id===currentId);
  const nextStep=steps[stepIndex+1];
  const previousStep=steps[stepIndex-1];

  useEffect(()=>{setStress(project?.assumptions??[]);},[project?.id,project?.assumptions]);
  function setStep(id:string){setError('');setNotice('');setParams({step:id});window.scrollTo({top:0,behavior:'smooth'});}
  function openEditor(kind:EditorKind,record?:any){setError('');setEditing(record);setEditor(kind);}
  function closeEditor(){setEditor(null);setEditing(undefined);}

  async function saveRecord(value:any){
    if(editor==='building'){if(value.id)await updateBuilding(value as Building);else await addBuilding(value);}
    else if(editor==='blockage'){if(value.id)await updateBlockage(value as Blockage);else await addBlockage(value as Omit<Blockage,'id'>);setSelectedBlockage(value.id??'');}
    else if(editor==='use'){if(value.id)await updatePathway(value as Pathway);else await addPathway(value as Omit<Pathway,'id'>);}
    else if(editor==='measure'){if(value.id)await updateMeasure(value as RetrofitMeasure);else await addMeasure(value as Omit<RetrofitMeasure,'id'>);}
    else if(editor==='gate'){if(value.id)await updateGate(value as DecisionGate);else await addGate(value as Omit<DecisionGate,'id'>);}
    else if(editor==='roadmap'){if(value.id)await updateRoadmapItem(value as RoadmapItem);else await addRoadmapItem(value as Omit<RoadmapItem,'id'>);}
    else if(editor==='project'&&project)await updateProject({...project,...value} as Project);
    setNotice('Saved.');
  }
  async function changeGate(gate:DecisionGate,status:DecisionGate['status']){setError('');setNotice('');try{await updateGate({...gate,status});setNotice('Gate status saved.');}catch(caught){setError(caught instanceof Error?caught.message:'Could not update this gate.');}}
  async function changeMeasureStatus(item:RetrofitMeasure,status:MeasureStatus){setError('');setNotice('');try{await updateMeasure({...item,status});setNotice('Retrofit status saved.');}catch(caught){setError(caught instanceof Error?caught.message:'Could not update this step.');}}
  async function changeRoadmapStatus(item:RoadmapItem,status:RecordStatus){setError('');setNotice('');try{await updateRoadmapItem({...item,status});setNotice('Roadmap status saved.');}catch(caught){setError(caught instanceof Error?caught.message:'Could not update this action.');}}
  async function toggleStress(id:string){
    if(!project)return;
    const next=stress.includes(id)?stress.filter(item=>item!==id):[...stress,id];
    setStress(next);setError('');
    try{await updateProject({...project,assumptions:next});}
    catch(caught){setStress(project.assumptions??[]);setError(caught instanceof Error?caught.message:'Could not save this assumption.');}
  }

  if(!project&&isRemote&&loading)return <Notice>Loading project…</Notice>;
  if(!project)return <><Link to="/projects" className="back-link"><ArrowLeft size={15}/>Projects</Link><EmptyState title="Project not found" body="It may have been removed or you may not have access to it." action={<Link className="button button-primary" to="/projects">Open projects</Link>}/></>;

  const notApproved=projectGates.filter(item=>item.status!=='Approved').length;
  const briefData={project,buildings:projectBuildings,evidence:projectEvidence,blockages:projectBlockages,pathways:projectPathways,measures:projectMeasures,gates:projectGates,roadmap:projectRoadmap,survey:surveyMetricGroups,assumptions:stress};
  return <>
    <Link to="/projects" className="back-link"><ArrowLeft size={15}/>Projects</Link>
    <PageHeader title={project.name} actions={<button className="button button-secondary" type="button" onClick={()=>openEditor('project',project)}><Settings2 size={16}/>Project details</button>}/>
    {notice&&<Notice tone="success">{notice}</Notice>}{error&&<Notice tone="warning">{error}</Notice>}
    <div className="project-state-line"><StatusBadge status={project.status}/><span>{projectBuildings.length} {projectBuildings.length===1?'building':'buildings'}</span><span>{projectEvidence.length} {projectEvidence.length===1?'source':'sources'}</span><span>{notApproved} {notApproved===1?'gate to resolve':'gates to resolve'}</span></div>
    <ProjectAccess project={project}/>
    <ProjectJourneyNav steps={journeyGroups} current={currentGroupId} onChange={id=>setStep(journeyGroups.find(item=>item.id===id)?.firstStep??'case')}/>
    {currentSubsteps.length>1&&<nav className="journey-subnav" aria-label={currentGroupId==='investigate'?'Investigation sections':'Planning sections'}><ol>{currentSubsteps.map(id=>{const item=steps.find(step=>step.id===id)!;return <li key={id}><button type="button" className={currentId===id?'active':''} aria-current={currentId===id?'page':undefined} onClick={()=>setStep(id)}>{item.label}</button></li>;})}</ol></nav>}
    <div className="project-step-content" key={`${project.id}-${currentId}`}>
      {currentId==='case'&&<CaseStep project={project} buildings={projectBuildings} evidence={projectEvidence} onAddBuilding={()=>openEditor('building')} onEditBuilding={building=>openEditor('building',building)} onEditProject={()=>openEditor('project',project)} onOpenEvidence={()=>setStep('evidence')} onStartInvestigation={()=>setStep('blockages')}/>}
      {currentId==='blockages'&&<section className="step-panel"><div className="step-panel-head"><div><h2>Blockage map</h2><p>Track facts and open questions that could affect a use or retrofit. A question is not a verified defect.</p></div><button className="button button-primary" onClick={()=>openEditor('blockage')}><Plus size={16}/>Add question</button></div><BlockageMap items={projectBlockages} evidence={projectEvidence} selectedId={selectedBlockage} onSelect={setSelectedBlockage} onAdd={()=>openEditor('blockage')} onEdit={item=>openEditor('blockage',item)} onOpenEvidence={()=>setStep('evidence')}/></section>}
      {currentId==='survey'&&<section className="step-panel"><div className="step-panel-head"><div><h2>Survey and needs</h2><p>Keep the question, sample size and limits beside each result.</p></div></div><SurveySummary project={project} datasets={projectDatasets} onImport={addSurveyDataset}/></section>}
      {currentId==='uses'&&<UsesStep items={projectPathways} evidence={projectEvidence} onAdd={()=>openEditor('use')} onEdit={item=>openEditor('use',item)} onOpenEvidence={()=>setStep('evidence')}/>}
      {currentId==='retrofit'&&<RetrofitStep items={projectMeasures} evidence={projectEvidence} onAdd={()=>openEditor('measure',{projectId,orderIndex:Math.max(0,...projectMeasures.map(item=>item.orderIndex))+1,status:'Proposed'})} onEdit={item=>openEditor('measure',item)} onStatus={changeMeasureStatus} onOpenEvidence={()=>setStep('evidence')}/>}
      {currentId==='compare'&&<CompareStep project={project} pathways={projectPathways} stress={stress} onToggle={id=>void toggleStress(id)} gates={projectGates} evidence={projectEvidence} onGateChange={changeGate} onAddGate={()=>openEditor('gate',{projectId,orderIndex:Math.max(0,...projectGates.map(item=>item.orderIndex))+1,status:'Open'})} onEditGate={gate=>openEditor('gate',gate)} onOpenEvidence={()=>setStep('evidence')}/>}
      {currentId==='roadmap'&&<RoadmapStep items={projectRoadmap} onAdd={()=>openEditor('roadmap',{projectId,phase:String(projectRoadmap.length+1).padStart(2,'0'),status:'Not started'})} onEdit={item=>openEditor('roadmap',item)} onStatus={changeRoadmapStatus}/>}
      {currentId==='evidence'&&<EvidenceStep project={project} items={projectEvidence}/>}
      {currentId==='brief'&&<BriefStep project={project} buildings={projectBuildings} evidence={projectEvidence} blockages={projectBlockages} pathways={projectPathways} measures={projectMeasures} gates={projectGates} roadmap={projectRoadmap} assumptions={stress} onDownload={()=>downloadDecisionBrief(briefData)}/>}
    </div>
    <div className="step-pagination">{previousStep?<button type="button" className="button button-secondary" onClick={()=>setStep(previousStep.id)}><ArrowLeft size={15}/>{previousStep.short}</button>:<span/>}{nextStep&&<button type="button" className="button button-primary" onClick={()=>setStep(nextStep.id)}>Next: {nextStep.short}<ArrowRight size={15}/></button>}</div>
    {editor&&<RecordFormModal key={`${editor}-${editing?.id??'new'}`} kind={editor} projectId={projectId} initial={editing} buildings={projectBuildings} evidence={projectEvidence} onClose={closeEditor} onSave={saveRecord}/>}
  </>;
}

function CaseStep({project,buildings,evidence,onAddBuilding,onEditBuilding,onEditProject,onOpenEvidence,onStartInvestigation}:{project:Project;buildings:Building[];evidence:any[];onAddBuilding:()=>void;onEditBuilding:(building:Building)=>void;onEditProject:()=>void;onOpenEvidence:()=>void;onStartInvestigation:()=>void}){
  const[recordOpen,setRecordOpen]=useState(()=>typeof window==='undefined'||window.matchMedia('(min-width: 801px)').matches);
  return <section className="step-panel case-step">
    <div className="step-panel-head"><div><h2>Case file</h2><p>{project.description||'Set the scope. Add building information as it is verified.'}</p></div><button className="button button-secondary" onClick={onEditProject}><Settings2 size={15}/>Edit details</button></div>
    <button type="button" className="button button-primary case-start-button" onClick={onStartInvestigation}><ArrowRight size={16}/>Start investigation</button>
    <details className="case-record-details" open={recordOpen} onToggle={event=>setRecordOpen(event.currentTarget.open)}>
      <summary>View case record</summary>
      <div className="case-record-body">
    <div className="case-facts-row"><div><span>Study area</span><strong>{project.region||'Not recorded'}</strong></div><div><span>Country</span><strong>{project.country||'Not recorded'}</strong></div><div><span>Buildings</span><strong>{buildings.length}</strong></div><div><span>Sources</span><strong>{evidence.length}</strong></div></div>
    <div className="step-section-heading"><div><h3>Buildings</h3><p>Keep source-backed facts separate from unknowns.</p></div><button className="button button-secondary" onClick={onAddBuilding}><Plus size={15}/>Add building</button></div>
    {buildings.length?<div className="building-grid">{buildings.map(building=><article className="building-card" key={building.id}>
      <div className="building-card-top"><span className="building-mark" aria-hidden="true">B</span><StatusBadge status={building.condition}/><button className="text-button" onClick={()=>onEditBuilding(building)}>Edit</button></div>
      <h3>{building.name}</h3><p className="building-address">{building.address||'Address not recorded'}</p>
      <dl><div><dt>Type</dt><dd>{building.buildingType||'Not recorded'}</dd></div><div><dt>Current use</dt><dd>{building.currentUse||'Not recorded'}</dd></div><div><dt>Built</dt><dd>{building.yearBuilt||'Not recorded'}</dd></div><div><dt>Area</dt><dd>{building.approximateArea||'Not recorded'}</dd></div></dl>
      {building.notes&&<p className="building-note">{building.notes}</p>}
      <div className="building-fact-groups">
        <div><h4>Documented facts</h4>{building.documentedFacts.length?<TagList values={building.documentedFacts}/>:<p className="not-recorded">No source-backed facts recorded.</p>}<EvidenceLinks titles={building.evidenceTitles??[]} evidence={evidence} onOpen={onOpenEvidence}/></div>
        <div><h4>Unknowns to check</h4>{building.unknowns.length?<TagList values={building.unknowns}/>:<p className="not-recorded">No unknowns recorded yet.</p>}</div>
      </div>
    </article>)}</div>:<EmptyState title="No buildings recorded" body="Add the first building to the case file." action={<button className="button button-primary" onClick={onAddBuilding}><Plus size={15}/>Add building</button>}/>} 
      </div>
    </details>
  </section>;
}
function UsesStep({items,evidence,onAdd,onEdit,onOpenEvidence}:{items:Pathway[];evidence:any[];onAdd:()=>void;onEdit:(item:Pathway)=>void;onOpenEvidence:()=>void}){
  const criteria:[string,(item:Pathway)=>string[]][]=[
    ['Potential users',item=>item.audience?[item.audience]:[]],
    ['Requirements',item=>item.requirements],
    ['Supporting signals',item=>item.supportingSignals],
    ['Trade-offs',item=>item.tradeoffs],
    ['Open checks',item=>item.evidenceNeeded],
    ['Related sources',item=>item.evidenceTitles??[]],
  ];
  return <section className="step-panel"><div className="step-panel-head"><div><h2>Future uses</h2><p>Keep options open until local needs, building requirements and delivery have been checked.</p></div><button className="button button-primary" onClick={onAdd}><Plus size={16}/>Add candidate</button></div>
    {items.length?<>
      <div className="use-card-grid">{items.map((item,index)=><article className="use-card" key={item.id}><div className="use-card-top"><span className="use-index">{String(index+1).padStart(2,'0')}</span><StatusBadge status={item.status}/><button type="button" className="text-button" onClick={()=>onEdit(item)}>Edit</button></div><h3>{item.title}</h3><p>{item.summary}</p><div className="use-card-detail"><strong>Why examine it</strong><p>{item.opportunity||'Not recorded'}</p></div><div className="linked-source-section"><strong>Related evidence</strong><EvidenceLinks titles={item.evidenceTitles??[]} evidence={evidence} onOpen={onOpenEvidence}/></div></article>)}</div>
      <section className="use-comparison" aria-label="Compare future-use candidates"><h3>Compare candidates</h3><p>Use the same questions for each option. Missing information remains visible.</p>
        {criteria.map(([label,getValues])=><div className="use-compare-row" key={label}><h4>{label}</h4><div className="use-compare-options">{items.map(item=><article key={item.id}><strong>{item.title}</strong><TagList values={getValues(item)}/></article>)}</div></div>)}
      </section>
    </>:<EmptyState title="No future-use candidates" body="Add an option to examine. Reclaim keeps its requirements and evidence gaps visible." action={<button className="button button-primary" onClick={onAdd}><Plus size={16}/>Add candidate</button>}/>}
  </section>;
}
function RetrofitStep({items,evidence,onAdd,onEdit,onStatus,onOpenEvidence}:{items:RetrofitMeasure[];evidence:any[];onAdd:()=>void;onEdit:(item:RetrofitMeasure)=>void;onStatus:(item:RetrofitMeasure,status:MeasureStatus)=>void;onOpenEvidence:()=>void}){
  return <section className="step-panel"><div className="step-panel-head"><div><h2>Retrofit sequence</h2><p>Put building and demand checks before equipment choices.</p></div><button className="button button-primary" onClick={onAdd}><Plus size={16}/>Add step</button></div>
    {items.length?<div className="measure-list">{items.map((item,index)=><article className={`measure-row ${item.status==='Deferred'?'measure-held':''}`} key={item.id}><span className="measure-number">{String(index+1).padStart(2,'0')}</span><div className="measure-main"><div className="measure-meta"><span>{item.stage}</span><StatusBadge status={item.status}/></div><h3>{item.title}</h3><p>{item.intent}</p><div className="measure-columns"><div><strong>Prerequisites</strong><TagList values={item.prerequisites}/></div><div><strong>Risks and limits</strong><TagList values={item.watchouts}/></div><div><strong>Evidence needed</strong><TagList values={item.evidenceNeeded}/></div></div><div className="linked-source-section"><strong>Related evidence</strong><EvidenceLinks titles={item.evidenceTitles??[]} evidence={evidence} onOpen={onOpenEvidence}/></div></div><div className="measure-actions"><label className="small-select"><span>Status</span><select value={item.status} onChange={event=>onStatus(item,event.target.value as MeasureStatus)}>{measureStatuses.map(value=><option key={value}>{value}</option>)}</select></label><button className="text-button" onClick={()=>onEdit(item)}>Edit</button></div></article>)}</div>:<EmptyState title="No retrofit steps" body="Add an ordered step and record its prerequisites before treating it as a proposal." action={<button className="button button-primary" onClick={onAdd}><Plus size={16}/>Add step</button>}/>}</section>;
}

function CompareStep({project,pathways,stress,onToggle,gates,evidence,onGateChange,onAddGate,onEditGate,onOpenEvidence}:{project:Project;pathways:Pathway[];stress:string[];onToggle:(id:string)=>void;gates:DecisionGate[];evidence:any[];onGateChange:(gate:DecisionGate,status:DecisionGate['status'])=>void;onAddGate:()=>void;onEditGate:(gate:DecisionGate)=>void;onOpenEvidence:()=>void}){
  const selected=stressCases.filter(item=>stress.includes(item.id));
  return <section className="step-panel"><div className="step-panel-head"><div><h2>Compare energy routes</h2><p>Keep the future use separate from how energy or services may be delivered.</p></div></div>
    <div className="comparison-note">These are questions to investigate. Building, load, roof, ownership, connection and operating data are not verified.</div>
    <div className="route-compare-grid"><RouteCard title="Building-only" label="One building" body="Assess measures and services for one building at a time." items={['Needs a building baseline and owner access.','Limits coordination with nearby buildings.','Costs and performance still need evidence.']}/><RouteCard title="Coordinated" label="More than one building" body="Explore whether nearby buildings could share energy or services." items={['Needs participating owners, agreements and an operator.','Requires compatible loads, metering and connection rules.','Potential scale is unknown until technical and governance checks are complete.']}/></div>
    <div className="comparison-criteria"><h3>What changes the comparison?</h3><div className="criteria-grid"><div><strong>Energy demand</strong><p>Measured loads and operating hours</p></div><div><strong>Building constraints</strong><p>Condition, structure, services and approvals</p></div><div><strong>Delivery</strong><p>Who can approve, operate, maintain and fund</p></div><div><strong>Local need</strong><p>Input from people connected to the site</p></div></div></div>
    <div className="stress-test"><div className="stress-heading"><div><h3>Assumption check</h3><p>Choose unknowns to see which checks they add. Choices are saved with this project.</p></div><span>{stress.length} selected</span></div><div className="stress-options">{stressCases.map(item=><label key={item.id} className={`stress-option ${stress.includes(item.id)?'selected':''}`}><input type="checkbox" checked={stress.includes(item.id)} onChange={()=>onToggle(item.id)}/><span>{item.label}</span></label>)}</div>{selected.length>0&&<div className="stress-effects"><strong>Checks to add</strong>{selected.map(item=><p key={item.id}><span aria-hidden="true">•</span>{item.effect}</p>)}</div>}<p className="stress-footnote">A selected assumption does not make either route feasible or infeasible.</p></div>
    <div className="decision-gates"><div className="step-section-heading"><div><h3>Decision gates</h3><p>Record each state carefully. A project entry is not professional sign-off.</p></div><button className="button button-secondary" onClick={onAddGate}><Plus size={15}/>Add gate</button></div>{gates.length?gates.map(gate=><article className="decision-gate-row" key={gate.id}><div className="gate-index">{String(gate.orderIndex).padStart(2,'0')}</div><div className="gate-copy"><strong>{gate.title}</strong><p>{gate.question}</p><small>{gate.reason}</small>{gate.requirements.length>0&&<ul>{gate.requirements.map(item=><li key={item}>{item}</li>)}</ul>}<div className="linked-source-section"><strong>Related evidence</strong><EvidenceLinks titles={gate.evidenceTitles??[]} evidence={evidence} onOpen={onOpenEvidence}/></div><button type="button" className="text-button" onClick={()=>onEditGate(gate)}>Edit gate</button></div><label className="small-select"><span>State</span><select value={gate.status} onChange={event=>onGateChange(gate,event.target.value as DecisionGate['status'])}>{gateStatuses.map(value=><option key={value}>{value}</option>)}</select></label></article>):<EmptyState title="No decision gates" body="Add the evidence or specialist review that needs to be resolved before a decision." action={<button className="button button-secondary" onClick={onAddGate}><Plus size={15}/>Add gate</button>}/>}</div>
    {pathways.length>0&&<div className="compare-use-note"><strong>Future-use candidates</strong><p>{pathways.map(item=>item.title).join(' · ')}</p><p>Assess each use separately from its delivery route. A selected use does not prove energy feasibility.</p></div>}
    {project.slug==='dakota-crescent'&&<p className="compare-sample-note">The broad survey is not specific to this site. Do not use its preferences to select a future use without local engagement.</p>}
  </section>;
}

function RoadmapStep({items,onAdd,onEdit,onStatus}:{items:RoadmapItem[];onAdd:()=>void;onEdit:(item:RoadmapItem)=>void;onStatus:(item:RoadmapItem,status:RecordStatus)=>void}){
  return <section className="step-panel"><div className="step-panel-head"><div><h2>Roadmap</h2><p>Keep next steps, owners and status together. A completed entry is not a specialist sign-off.</p></div><button className="button button-primary" onClick={onAdd}><Plus size={16}/>Add action</button></div>
    {items.length?<div className="roadmap-list">{items.map((item,index)=><article className="roadmap-row" key={item.id}><div className="roadmap-index">{item.phase||String(index+1).padStart(2,'0')}</div><div className="roadmap-copy"><h3>{item.title}</h3><p>{item.description}</p>{item.owner&&<small>Owner: {item.owner}</small>}</div><label className="small-select"><span>Status</span><select value={item.status} onChange={event=>onStatus(item,event.target.value as RecordStatus)}>{roadmapStatuses.map(value=><option key={value}>{value}</option>)}</select></label><button className="text-button" onClick={()=>onEdit(item)}>Edit</button></article>)}</div>:<EmptyState title="No next steps recorded" body="Add the checks that need to happen before a decision." action={<button className="button button-primary" onClick={onAdd}><Plus size={16}/>Add action</button>}/>}</section>;
}

function EvidenceStep({project,items}:{project:Project;items:any[]}){
  const link=`/evidence?project=${encodeURIComponent(project.id)}`;
  return <section className="step-panel"><div className="step-panel-head"><div><h2>Evidence for {project.name}</h2><p>Sources stay with this project and can be linked to questions, uses, measures and gates.</p></div><Link className="button button-primary" to={link}><Plus size={16}/>Add source</Link></div>
    {items.length?<div className="evidence-list">{items.map(item=><article className="evidence-row" key={item.id}><div className="evidence-row-mark" aria-hidden="true">{item.kind.slice(0,1)}</div><div className="evidence-row-copy"><div className="evidence-row-title"><h3>{item.title}</h3><StatusBadge status={item.status}/></div><p>{item.summary}</p><div className="evidence-row-meta"><span>{item.kind}</span><span>{item.source}</span><span>{item.date||'Date not recorded'}</span></div>{item.sourceUrl&&<a className="inline-link" href={item.sourceUrl} target="_blank" rel="noreferrer">Open source <ExternalLink size={14}/></a>}</div></article>)}</div>:<EmptyState title="No sources in this project" body="Add a source to support a finding, or record what evidence is still needed." action={<Link className="button button-primary" to={link}><Plus size={16}/>Add source</Link>}/>}</section>;
}

function BriefStep({project,buildings,evidence,blockages,pathways,measures,gates,roadmap,assumptions,onDownload}:{project:Project;buildings:Building[];evidence:any[];blockages:Blockage[];pathways:Pathway[];measures:RetrofitMeasure[];gates:DecisionGate[];roadmap:RoadmapItem[];assumptions:string[];onDownload:()=>void}){
  const unresolvedGates=gates.filter(item=>item.status!=='Approved');
  const selectedAssumptions=stressCases.filter(item=>assumptions.includes(item.id));
  return <section className="step-panel brief-step"><div className="brief-header"><div><h2>Decision brief</h2><p>A dated snapshot of the current project record, open evidence and next steps.</p></div><div className="brief-actions"><button className="button button-primary" onClick={onDownload}><Download size={16}/>Download brief</button><button className="button button-secondary" onClick={()=>window.print()}><Printer size={16}/>Print</button></div></div>
    <div className="brief-status"><strong>No preferred route is established.</strong><span>{unresolvedGates.length} {unresolvedGates.length===1?'gate is':'gates are'} not marked approved.</span></div>
    <div className="brief-summary-grid"><BriefFact label="Buildings" value={buildings.length}/><BriefFact label="Open questions" value={blockages.filter(item=>item.status!=='Resolved').length}/><BriefFact label="Use candidates" value={pathways.length}/><BriefFact label="Sources" value={evidence.length}/></div>
    <section className="brief-preview-section"><h3>Scope</h3><p>{project.description||'No scope has been written yet.'}</p><p>{[project.region,project.country].filter(Boolean).join(', ')||'Location not recorded'}</p></section>
    <section className="brief-preview-section"><h3>Building record</h3>{buildings.length?buildings.map(item=><div className="brief-line" key={item.id}><StatusBadge status={item.condition}/><div><strong>{item.name}</strong><p>{item.address||'Address not recorded'} · {item.currentUse||'Current use not recorded'}</p>{item.documentedFacts?.length>0&&<p>Documented facts: {item.documentedFacts.join('; ')}</p>}{item.unknowns?.length>0&&<p>Unknowns: {item.unknowns.join('; ')}</p>}{item.evidenceTitles?.length>0&&<p>Related sources: {item.evidenceTitles.join('; ')}</p>}</div></div>):<p>No building has been recorded.</p>}</section>
    <section className="brief-preview-section"><h3>Future-use candidates</h3>{pathways.length?pathways.map(item=><div className="brief-line" key={item.id}><StatusBadge status={item.status}/><div><strong>{item.title}</strong><p>{item.summary} Related sources: {item.evidenceTitles?.join(', ')||'none linked'}.</p></div></div>):<p>No candidate use has been added.</p>}</section>
    <section className="brief-preview-section"><h3>Retrofit sequence</h3>{measures.length?measures.map(item=><div className="brief-line" key={item.id}><StatusBadge status={item.status}/><div><strong>{item.orderIndex}. {item.title}</strong><p>{item.intent} Related sources: {item.evidenceTitles?.join(', ')||'none linked'}.</p></div></div>):<p>No retrofit steps have been added.</p>}</section>
    <section className="brief-preview-section"><h3>Comparison assumptions</h3>{selectedAssumptions.length?selectedAssumptions.map(item=><div className="brief-line" key={item.id}><StatusBadge status="Needs verification"/><div><strong>{item.label}</strong><p>{item.effect}</p></div></div>):<p>No comparison assumptions are selected.</p>}<p>Building-only and coordinated routes remain conditional. No engineering performance score is calculated.</p></section>
    <section className="brief-preview-section"><h3>Decision gates</h3>{gates.length?gates.map(item=><div className="brief-line" key={item.id}><StatusBadge status={item.status}/><div><strong>{item.title}</strong><p>{item.question} Related sources: {item.evidenceTitles?.join(', ')||'none linked'}.</p></div></div>):<p>No decision gates have been added.</p>}</section>
    <section className="brief-preview-section"><h3>Next steps</h3>{roadmap.length?roadmap.slice(0,6).map(item=><div className="brief-line" key={item.id}><StatusBadge status={item.status}/><div><strong>{item.title}</strong><p>{item.description}</p></div></div>):<p>No next steps have been recorded.</p>}</section>
    <Notice tone="warning">This brief is a research aid, not an engineering, safety, legal, cost, energy or conservation assessment. “Approved” is a project status, not independent certification.</Notice>
  </section>;
}

function EvidenceLinks({titles,evidence,onOpen}:{titles:string[];evidence:any[];onOpen:()=>void}){
  const resolved=(titles??[]).map(title=>({title,source:evidence.find(item=>item.title===title)}));
  return resolved.length?<ul className="source-link-list">{resolved.map(({title,source})=><li key={title}>{source?.sourceUrl?<a href={source.sourceUrl} target="_blank" rel="noreferrer">{title}<ExternalLink size={12}/></a>:<button type="button" onClick={onOpen}>{title}</button>}</li>)}</ul>:<button type="button" className="link-source-action" onClick={onOpen}>Add a source, then link it</button>;
}
function RouteCard({title,label,body,items}:{title:string;label:string;body:string;items:string[]}){return <article className="route-card"><div className="route-card-top"><span className="route-marker"/><span>{label}</span></div><h3>{title}</h3><p>{body}</p><ul>{items.map(item=><li key={item}>{item}</li>)}</ul></article>;}
function TagList({values}:{values:string[]}){return values.length?<ul className="tag-list">{values.map(value=><li key={value}>{value}</li>)}</ul>:<p className="not-recorded">Not recorded.</p>;}
function BriefFact({label,value}:{label:string;value:number}){return <div className="brief-fact"><span>{label}</span><strong>{value}</strong></div>;}

import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {ExternalLink} from 'lucide-react';
import type {Building,EvidenceItem} from '../types';
import {Modal,Notice} from './UI';

type EditorKind='building'|'blockage'|'use'|'measure'|'gate'|'roadmap'|'project';
type FieldType='text'|'textarea'|'select'|'list';
interface FieldSpec{key:string;label:string;type?:FieldType;required?:boolean;placeholder?:string;help?:string;options?:string[];}
interface Props{kind:EditorKind;projectId:string;initial?:any;buildings?:Building[];evidence?:EvidenceItem[];onClose:()=>void;onSave:(value:any)=>Promise<void>;}
const measureStatuses=['Proposed','Assessing','Selected','In progress','Complete','Deferred','Rejected'];
const gateStatuses=['Open','Evidence linked','Blocked','Deferred','Approved','Rejected'];
const specs:Record<EditorKind,FieldSpec[]>={
  building:[{key:'name',label:'Building name',required:true,placeholder:'Name or block number'},{key:'address',label:'Address'},{key:'buildingType',label:'Building type',help:'Mark an unconfirmed detail as unknown.'},{key:'currentUse',label:'Current use',help:'Mark an unconfirmed use as unknown.'},{key:'yearBuilt',label:'Year built or period'},{key:'approximateArea',label:'Approximate area'},{key:'condition',label:'Record status',type:'select',options:['Not assessed','Needs verification','Inspected']},{key:'documentedFacts',label:'Documented facts',type:'list',help:'Add only facts supported by a source, then link that source below.'},{key:'unknowns',label:'Unknowns to check',type:'list'},{key:'notes',label:'Notes',type:'textarea'}],
  blockage:[{key:'title',label:'Question or issue',required:true,placeholder:'What needs to be checked?'},{key:'category',label:'Category',type:'select',options:['Building record','Condition','Permissions','Comfort and energy','Local need','Energy integration','Delivery','Other']},{key:'buildingId',label:'Related building',type:'select'},{key:'summary',label:'What is known so far?',type:'textarea',required:true},{key:'impact',label:'Why does it matter?',type:'textarea'},{key:'confidence',label:'Confidence',type:'select',options:['Unknown','Low','Medium','High']},{key:'status',label:'Status',type:'select',options:['Needs verification','Evidence linked','Under review','Resolved','Deferred']},{key:'possibleResponses',label:'Responses to examine',type:'list',help:'These are options to study, not recommendations.'},{key:'prerequisites',label:'What must happen first?',type:'list'},{key:'evidenceNeeded',label:'Evidence still needed',type:'list'}],
  use:[{key:'title',label:'Future-use candidate',required:true,placeholder:'For example, study and youth space'},{key:'summary',label:'Current view',type:'textarea',required:true},{key:'audience',label:'Who might it serve?',type:'textarea'},{key:'opportunity',label:'Why examine this use?',type:'textarea'},{key:'requirements',label:'Requirements',type:'list'},{key:'supportingSignals',label:'Signals to consider',type:'list'},{key:'tradeoffs',label:'Trade-offs',type:'list'},{key:'evidenceNeeded',label:'Evidence still needed',type:'list'},{key:'status',label:'Status',type:'select',options:['Research candidate','Under review','Selected'],help:'“Selected” is a workspace choice, not proof of feasibility.'}],
  measure:[{key:'orderIndex',label:'Order',required:true,placeholder:'1'},{key:'stage',label:'Stage',required:true,placeholder:'Verify, reduce demand, improve systems…'},{key:'title',label:'Measure or check',required:true},{key:'intent',label:'Purpose',type:'textarea',required:true},{key:'prerequisites',label:'Prerequisites',type:'list'},{key:'watchouts',label:'Risks and limits',type:'list'},{key:'evidenceNeeded',label:'Evidence needed',type:'list'},{key:'status',label:'Status',type:'select',options:measureStatuses}],
  gate:[{key:'orderIndex',label:'Order',required:true,placeholder:'1'},{key:'title',label:'Decision gate',required:true},{key:'question',label:'Question to resolve',type:'textarea',required:true},{key:'reason',label:'Why this matters',type:'textarea'},{key:'requirements',label:'Evidence or review needed',type:'list'},{key:'status',label:'Status',type:'select',options:gateStatuses,help:'A project status is not professional or authority sign-off.'}],
  roadmap:[{key:'phase',label:'Order',required:true,placeholder:'01'},{key:'title',label:'Next step',required:true},{key:'description',label:'What needs to happen?',type:'textarea',required:true},{key:'owner',label:'Owner or role',placeholder:'Optional'},{key:'status',label:'Status',type:'select',options:['Not started','In progress','Held','Complete']}],
  project:[
  {key:'name',label:'Project name',required:true},
  {key:'region',label:'Area or district'},
  {key:'country',label:'Country'},
  {key:'description',label:'Project scope',type:'textarea'},
  {
    key:'visibility',
    label:'Project visibility',
    type:'select',
    options:['private','public'],
    help:'Public projects can be viewed without an account.'
  },
  {
    key:'locationInput',
    label:'Location or Google Maps link',
    placeholder:'Paste a Google Maps link or type the place name',
    help:'A Google Maps link can provide the map point automatically.'
  },
  {
    key:'locationPrecision',
    label:'Public location detail',
    type:'select',
    options:['hidden','area','approximate','exact'],
    help:'Exact shows the selected building point. Approximate shifts it nearby. Area shows only the label.'
  },
  {
    key:'publicGalleryEnabled',
    label:'Public gallery',
    type:'select',
    options:['false','true'],
    help:'Only approved photos marked public will appear.'
  },
  {
    key:'status',
    label:'Status',
    type:'select',
    options:['In research','Planning','Active','Archived']
  }
],


};
const titles:Record<EditorKind,string>={building:'Building record',blockage:'Blockage question',use:'Future-use candidate',measure:'Retrofit step',gate:'Decision gate',roadmap:'Roadmap action',project:'Project details'};
const arraysByKind:Partial<Record<EditorKind,string[]>>={building:['documentedFacts','unknowns'],blockage:['possibleResponses','prerequisites','evidenceNeeded'],use:['requirements','supportingSignals','tradeoffs','evidenceNeeded'],measure:['prerequisites','watchouts','evidenceNeeded'],gate:['requirements']};
function listText(value:unknown){return Array.isArray(value)?value.join('\n'):String(value??'');}

export function RecordFormModal({kind,projectId,initial,buildings=[],evidence=[],onClose,onSave}:Props){
  const fields=specs[kind];const[arrayKeys]=useState(arraysByKind[kind]??[]);const[values,setValues]=useState<Record<string,string>>({});const[selectedSources,setSelectedSources]=useState<string[]>([]);const[busy,setBusy]=useState(false);const[error,setError]=useState('');const isEditing=Boolean(initial?.id);
  useEffect(()=>{const next:Record<string,string>={};for(const field of fields){const value=initial?.[field.key];next[field.key]=field.type==='list'?listText(value):String(value??'');}setValues(next);setSelectedSources(initial?.relatedEvidenceTitles??initial?.evidenceTitles??[]);setError('');},[kind,initial?.id]);
  const title=titles[kind];const linkedSourceTitles=useMemo(()=>Array.from(new Set(evidence.map(item=>item.title))),[evidence]);
  function set(key:string,value:string){setValues(current=>({...current,[key]:value}));}
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{
    const parsed:any={...values,projectId};for(const key of arrayKeys)parsed[key]=values[key]?.split('\n').map(value=>value.trim()).filter(Boolean)??[];
    if(kind==='project'){
  const input=values.locationInput.trim();

  let latitude:number|null=null;
  let longitude:number|null=null;

  // Supports Google Maps URLs containing @lat,long.
  const atMatch=input.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);

  // Also supports URLs containing !3dLAT!4dLONG.
  const dataMatch=input.match(
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/
  );

  const match=atMatch??dataMatch;

  if(match){
    latitude=Number(match[1]);
    longitude=Number(match[2]);
  }

  if(
  (values.locationPrecision==='exact'||
   values.locationPrecision==='approximate')&&
  (latitude==null||longitude==null)
){
  throw new Error(
    'For an exact or approximate map, paste the confirmed Google Maps link. Choose Area or Hidden if you only want to publish the location label.'
  );
}

parsed.locationLabel=input;
parsed.latitude=latitude;
parsed.longitude=longitude;
parsed.publicGalleryEnabled=values.publicGalleryEnabled==='true';


  if(values.locationPrecision==='exact'){
    parsed.publicLatitude=latitude;
    parsed.publicLongitude=longitude;
  }else if(values.locationPrecision==='approximate'){
    // Roughly 300 metres away from the exact point.
    parsed.publicLatitude=latitude==null?null:latitude+0.003;
    parsed.publicLongitude=longitude==null?null:longitude+0.003;
  }else{
    // Hidden and area-label-only do not publish a map point.
    parsed.publicLatitude=null;
    parsed.publicLongitude=null;
  }
}


    if(kind==='building'){parsed.condition=values.condition||'Needs verification';parsed.evidenceTitles=selectedSources;}
    if(kind==='blockage'){parsed.relatedEvidenceTitles=selectedSources;parsed.buildingId=values.buildingId||undefined;}
    if(kind==='use'||kind==='measure'||kind==='gate')parsed.evidenceTitles=selectedSources;
    if(kind==='measure'||kind==='gate')parsed.orderIndex=Math.max(1,Number.parseInt(values.orderIndex||'1',10)||1);
    if(kind==='roadmap')parsed.owner=values.owner||'';
    if(kind==='project'&&initial)parsed.id=initial.id;
    if(initial&&kind!=='project')parsed.id=initial.id;
    await onSave(parsed);onClose();
  }catch(caught){setError(caught instanceof Error?caught.message:'Could not save this record.');}finally{setBusy(false);}}
  const canLinkEvidence=['building','blockage','use','measure','gate'].includes(kind);
  return <Modal title={isEditing?'Edit '+title.toLowerCase():'Add '+title.toLowerCase()} description={kind==='blockage'?'Describe the gap, not an assumed defect.':kind==='use'?'Keep an option open until evidence and requirements are clear.':kind==='gate'?'Record what must be true before the project moves forward.':kind==='building'?'Separate source-backed facts from details that still need checking.':undefined} onClose={onClose} wide>
    <form className="form-stack" onSubmit={submit}>{error&&<Notice tone="warning">{error}</Notice>}
      <div className="form-grid">{fields.map(field=>{const value=values[field.key]??'';if(field.key==='buildingId')return <label className="form-field full-width" key={field.key}><span>{field.label}</span><select value={value} onChange={event=>set(field.key,event.target.value)}><option value="">No building selected</option>{buildings.filter(item=>item.projectId===projectId).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
      if(field.key==='locationInput'){
  const searchUrl=value.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value.trim() )}`
    : '';

  return(
    <label className="form-field full-width" key={field.key}>
      <span>{field.label}</span>

      <input
        value={value}
        onChange={event=>set(field.key,event.target.value)}
        placeholder={field.placeholder}
        maxLength={500}
      />

      {searchUrl&&(
        <a
          className="text-link"
          href={searchUrl}
          target="_blank"
          rel="noreferrer"
        >
          Search this place in Google Maps
          <ExternalLink size={14}/>
        </a>
      )}

      {field.help&&(
        <small className="field-help">{field.help}</small>
      )}
    </label>
  );
}

        return <label className={`form-field ${field.type==='textarea'||field.type==='list'||field.key==='name'&&kind==='project'?'full-width':''}`} key={field.key}><span>{field.label}{field.required&&<b className="required-mark"> *</b>}</span>{field.type==='textarea'||field.type==='list'?<textarea required={field.required} rows={field.type==='list'?3:4} value={value} onChange={event=>set(field.key,event.target.value)} placeholder={field.type==='list'?'One item per line':field.placeholder} maxLength={3000}/>:field.type==='select'?<select value={value||field.options?.[0]} onChange={event=>set(field.key,event.target.value)}>{field.options?.map(option=><option key={option}>{option}</option>)}</select>:<input type={field.key==='orderIndex'?'number':'text'} min={field.key==='orderIndex'?1:undefined} required={field.required} value={value} onChange={event=>set(field.key,event.target.value)} placeholder={field.placeholder} maxLength={field.key==='title'?120:300}/>} {field.help&&<small className="field-help">{field.help}</small>}</label>;})}</div>
      {canLinkEvidence&&<fieldset className="evidence-picker"><legend>Related evidence</legend><p>Choose sources already recorded in this project. Linking a source does not verify a claim.</p>{linkedSourceTitles.length?linkedSourceTitles.map(source=><label key={source} className="checkbox-row"><input type="checkbox" checked={selectedSources.includes(source)} onChange={event=>setSelectedSources(current=>event.target.checked?[...current,source]:current.filter(value=>value!==source))}/><span>{source}</span></label>):<p>No sources recorded yet. Add them in Evidence first.</p>}</fieldset>}
      <div className="form-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy?'Saving…':isEditing?'Save changes':'Save record'}</button></div>
    </form>
  </Modal>;
}

import {useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import {Link,useNavigate} from 'react-router-dom';
import {useWorkspace} from '../context/WorkspaceContext';
import {PageHeader} from '../components/UI';

export function NewProjectPage(){
  const {createProject}=useWorkspace();
  const navigate=useNavigate();
  const [name,setName]=useState('');const [region,setRegion]=useState('');const [country,setCountry]=useState('');const [description,setDescription]=useState('');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');try{const project=await createProject({name:name.trim(),region:region.trim(),country:country.trim(),description:description.trim()});navigate(`/projects/${project.id}`);}catch(caught){setError(caught instanceof Error?caught.message:'Could not create this project.');}finally{setBusy(false);}}
  return <>
    <Link className="back-link" to="/projects"><ArrowLeft size={15}/>Back to projects</Link>
    <PageHeader title="Create a project" description="Start with the place and record what you know. Add the rest as it is checked."/>
    <div className="form-layout"><form className="surface-card form-card" onSubmit={submit}>
      <div className="form-section-title"><span className="step-number">01</span><div><h2>Project details</h2><p>Use what is known today. Unknowns can stay unknown.</p></div></div>
      <label>Project name <span className="required-mark">*</span><input required value={name} onChange={event=>setName(event.target.value)} placeholder="e.g. Riverside Community Hub" maxLength={100}/></label>
      <div className="two-field-row"><label>Area or district<input value={region} onChange={event=>setRegion(event.target.value)} placeholder="District, town or site" maxLength={120}/></label><label>Country<input value={country} onChange={event=>setCountry(event.target.value)} placeholder="Country" maxLength={80}/></label></div>
      <label>Purpose and scope<textarea value={description} onChange={event=>setDescription(event.target.value)} placeholder="What are you trying to understand, and what is still open?" rows={5} maxLength={1000}/></label>
      <div className="form-hint">You can add buildings, evidence, survey results, pathway candidates and a roadmap after the project is created.</div>
      {error&&<div className="form-alert error-alert" role="alert">{error}</div>}
      <div className="form-actions"><Link className="button button-quiet" to="/projects">Cancel</Link><button className="button button-primary" type="submit" disabled={busy}>{busy?'Creating…':'Create project'}<ArrowRight size={16}/></button></div>
    </form>
    <aside className="form-aside"><h3>How the project develops</h3><p>Reclaim keeps sources, assumptions and missing checks beside the work. An early idea stays separate from a validated recommendation.</p><div className="aside-list"><span><b>01</b> Place and scope</span><span><b>02</b> Buildings and records</span><span><b>03</b> Evidence and local needs</span><span><b>04</b> Options and next checks</span></div></aside></div>
  </>;
}

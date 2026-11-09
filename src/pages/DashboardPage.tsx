import {useMemo,useState} from 'react';
import {ArrowRight,CheckCircle2,Plus} from 'lucide-react';
import {Link} from 'react-router-dom';
import {useWorkspace} from '../context/WorkspaceContext';
import {Notice,StatusBadge} from '../components/UI';

export function DashboardPage(){
  const {projects,evidence,blockages,roadmap,loading,loadDakotaCase}=useWorkspace();
  const [caseError,setCaseError]=useState('');
  const dakota=projects.find(project=>project.slug==='dakota-crescent');
  const activeProject=dakota??projects[0];
  const projectBlockages=useMemo(()=>activeProject?blockages.filter(item=>item.projectId===activeProject.id&&item.status!=='Resolved'):[],[activeProject,blockages]);
  const projectRoadmap=useMemo(()=>activeProject?roadmap.filter(item=>item.projectId===activeProject.id&&item.status!=='Complete'):[],[activeProject,roadmap]);
  const projectEvidence=activeProject?evidence.filter(item=>item.projectId===activeProject.id):[];
  const urgentBlockages=projectBlockages.slice(0,3);
  const nextActions=projectRoadmap.slice(0,3);

  async function addCase(){
    setCaseError('');
    try{await loadDakotaCase();}
    catch(caught){setCaseError(caught instanceof Error?caught.message:'The case could not be loaded. Check your connection and try again.');}
  }

  return <>
    <header className="work-index-header">
      <div><p className="page-kicker">RESEARCH WORKSPACE</p><h1>Projects</h1><p className="page-description">See what needs checking, what is blocking a decision and what should happen next.</p></div>
      <Link className="button button-primary" to="/projects/new"><Plus size={17}/>New project</Link>
    </header>
    {caseError&&<Notice tone="warning">{caseError}</Notice>}

    {dakota&&<>
      <section className="project-start-panel">
        <div className="project-start-copy"><p className="page-kicker">FIRST CASE</p><h2>{dakota.name}</h2><p>{dakota.description}</p><div className="project-start-meta"><span>{dakota.region}, {dakota.country}</span><span>{projectEvidence.length} sources</span><StatusBadge status={dakota.status}/></div></div>
        <Link
  className="button button-primary project-open-button"
  to={`/projects/${dakota.id}?step=case`}
>
  Open Dakota Crescent <ArrowRight size={16}/>
</Link>
      </section>
      <section className="action-overview" aria-labelledby="attention-heading">
        <div className="action-overview-heading"><div><p className="page-kicker">WORK TO DO</p><h2 id="attention-heading">What needs attention</h2><p>Reclaim keeps uncertainty visible so a team can decide what to verify next.</p></div><Link className="text-link" to={`/projects/${dakota.id}?step=blockages`}>Open investigation <ArrowRight size={15}/></Link></div>
        <div className="action-overview-grid">
          <div className="action-column"><h3>Open questions <span>{projectBlockages.length}</span></h3>{urgentBlockages.length?urgentBlockages.map(item=><Link className="action-row" to={`/projects/${dakota.id}?step=blockages`} key={item.id}><span className="action-marker warning"/><span><strong>{item.title}</strong><small>{item.confidence} confidence · {item.status}</small></span><ArrowRight size={15}/></Link>):<p className="action-empty"><CheckCircle2 size={16}/>No unresolved questions.</p>}</div>
          <div className="action-column"><h3>Next actions <span>{projectRoadmap.length}</span></h3>{nextActions.length?nextActions.map(item=><Link className="action-row" to={`/projects/${dakota.id}?step=roadmap`} key={item.id}><span className="action-marker"/><span><strong>{item.title}</strong><small>{item.status}{item.owner?` · ${item.owner}`:''}</small></span><ArrowRight size={15}/></Link>):<p className="action-empty"><CheckCircle2 size={16}/>No outstanding actions.</p>}</div>
        </div>
        <div className="decision-position"><strong>Current position</strong><p>No reuse option is ready to recommend yet. The case needs a verified building record, site-specific local input, permissions and ownership checks, and measured energy and comfort data.</p><Link className="text-link" to={`/projects/${dakota.id}?step=brief`}>View decision brief <ArrowRight size={15}/></Link></div>
      </section>
    </>}

    {!dakota&&<section className="project-start-panel empty-project-start"><div><p className="page-kicker">START HERE</p><h2>Turn a place and question into a shared record.</h2><p>Dakota Crescent is available as a reviewed sample, or create a project for another building, neighbourhood or retrofit question.</p></div><div className="inline-actions"><button className="button button-secondary" onClick={addCase} disabled={loading}><Plus size={16}/>{loading?'Loading case…':'Explore sample case'}</button><Link className="text-link" to="/projects/new">Create a project <ArrowRight size={15}/></Link></div></section>}

    <section className="project-index-section"><div className="section-heading-row"><div><h2>All projects</h2><p className="section-support">Every project uses the same evidence-led path from open question to next action.</p></div></div>
      {projects.length?<div className="project-list">{projects.map((project,index)=><Link className="project-row" to={`/projects/${project.id}?step=case`} key={project.id}><span className="project-row-index">{String(index+1).padStart(2,'0')}</span><span className="project-row-main"><strong>{project.name}</strong><span>{project.region}{project.country?`, ${project.country}`:''}</span></span><StatusBadge status={project.status}/><span className="project-row-facts">{evidence.filter(item=>item.projectId===project.id).length} sources <ArrowRight size={15}/></span></Link>)}</div>:<div className="empty-state"><h2>No projects yet</h2><p>Create a project to begin recording a place, its buildings and the questions that need evidence.</p></div>}
    </section>
  </>;
}


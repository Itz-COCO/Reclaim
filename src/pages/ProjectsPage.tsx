import {useMemo,useState} from 'react';
import {ArrowRight,FolderKanban,Plus,Search} from 'lucide-react';
import {Link} from 'react-router-dom';
import {useWorkspace} from '../context/WorkspaceContext';
import {EmptyState,PageHeader,StatusBadge} from '../components/UI';

export function ProjectsPage(){
  const {projects}=useWorkspace();
  const [query,setQuery]=useState('');
  const filtered=useMemo(()=>projects.filter(project=>`${project.name} ${project.region} ${project.country}`.toLowerCase().includes(query.toLowerCase())),[projects,query]);
  return <>
    <PageHeader title="Projects" description="Continue an investigation or start one for another place." action={<Link className="button button-primary" to="/projects/new"><Plus size={17}/>New project</Link>}/>
    <div className="toolbar"><label className="search-field"><Search size={17}/><input aria-label="Search projects" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a project"/></label><span className="toolbar-count">{filtered.length} {filtered.length===1?'project':'projects'}</span></div>
    {filtered.length?<div className="project-card-grid">{filtered.map(project=><Link className="project-card" to={`/projects/${project.id}`} key={project.id}><div className="project-card-top"><span className="project-monogram"><FolderKanban size={17}/></span><StatusBadge status={project.status}/></div><h3>{project.name}</h3><p>{project.region}{project.country?`, ${project.country}`:''}</p><div className="project-card-description">{project.description}</div><div className="project-card-bottom"><span>{project.isCaseStudy?'First case study':'Reusable project'}</span><span className="project-card-link project-open-button">
  Open <ArrowRight size={15}/>
</span>
</div></Link>)}</div>:<EmptyState title={query?'No matching projects':'No projects yet'} body={query?'Try another search term.':'Create a project, or load the Dakota Crescent case study to explore the workspace.'} action={<Link className="button button-primary" to="/projects/new"><Plus size={16}/>Create project</Link>}/>} 
  </>;
}

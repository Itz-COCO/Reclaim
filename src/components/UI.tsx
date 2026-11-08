import {useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';

export function PageHeader({title,description,actions,action,eyebrow}:{title:string;description?:string;actions?:ReactNode;action?:ReactNode;eyebrow?:string}){
  const pageActions=actions??action;
  return <header className="page-heading">{eyebrow&&<p className="page-kicker">{eyebrow}</p>}<div className="page-heading-row"><div><h1>{title}</h1>{description&&<p className="page-description">{description}</p>}</div>{pageActions&&<div className="page-actions">{pageActions}</div>}</div></header>;
}
export function StatusBadge({status}:{status:string}){
  const tone=/verified|complete|cleared|resolved|evidence linked|connected/i.test(status)?'positive':/needs|open|held|not started|unknown|verification/i.test(status)?'caution':/team research|expert insight|survey finding|local demo|research candidate/i.test(status)?'neutral':'plain';
  return <span className={`status-badge status-${tone}`}>{status}</span>;
}
export function EmptyState({title,body,action}:{title:string;body:string;action?:ReactNode}){return <div className="empty-state"><h2>{title}</h2><p>{body}</p>{action&&<div className="empty-state-action">{action}</div>}</div>;}
export function MetricCard({label,value,detail,note,icon}:{label:string;value:ReactNode;detail?:ReactNode;note?:ReactNode;icon?:ReactNode}){return <article className="metric-card">{icon&&<span className="metric-icon">{icon}</span>}<span className="metric-label">{label}</span><strong className="metric-value">{value}</strong>{(detail??note)&&<span className="metric-detail">{detail??note}</span>}</article>;}
export function Modal({title,description,onClose,children,wide=false}:{title:string;description?:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
  const dialogRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialogRef.current?.focus();const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};document.addEventListener('keydown',onKey);document.body.classList.add('modal-is-open');return()=>{document.removeEventListener('keydown',onKey);document.body.classList.remove('modal-is-open');previous?.focus();};},[onClose]);
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`modal-panel ${wide?'modal-wide':''}`}><header className="modal-header"><div><h2 id="modal-title">{title}</h2>{description&&<p>{description}</p>}</div><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18}/></button></header><div className="modal-body">{children}</div></section></div>;
}
export function Notice({children,tone='plain'}:{children:ReactNode;tone?:'plain'|'warning'|'success'}){return <div className={`notice notice-${tone}`} role={tone==='warning'?'alert':'status'}>{children}</div>;}

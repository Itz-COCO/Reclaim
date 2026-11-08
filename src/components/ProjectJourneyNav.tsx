import {Check} from 'lucide-react';
import type {ReactNode} from 'react';
export interface JourneyStep{id:string;label:string;short:string;}
export function ProjectJourneyNav({steps,current,onChange,completeMap}:{steps:JourneyStep[];current:string;onChange:(step:string)=>void;completeMap?:Record<string,boolean>}){
  return <nav className="journey-nav" aria-label="Project workflow steps"><ol>{steps.map((step,index)=>{const active=step.id===current;const done=Boolean(completeMap?.[step.id]);return <li key={step.id}><button type="button" className={`journey-step ${active?'current':''} ${done?'complete':''}`} aria-current={active?'step':undefined} onClick={()=>onChange(step.id)}><span className="journey-number">{done?<Check size={14}/>:String(index+1).padStart(2,'0')}</span><span className="journey-label">{step.label}</span></button></li>;})}</ol></nav>;
}
export function StepIntro({number,title,description,action}:{number:string;title:string;description:string;action?:ReactNode}){return <header className="step-intro"><div><span className="step-number">{number}</span><div><h2>{title}</h2><p>{description}</p></div></div>{action&&<div className="step-intro-action">{action}</div>}</header>;}

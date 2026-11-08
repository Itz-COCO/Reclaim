import {useMemo} from 'react';
import {ArrowUpRight,PenLine,Plus} from 'lucide-react';
import type {Blockage,EvidenceItem} from '../types';

interface BlockageMapProps{
  items:Blockage[];
  evidence:EvidenceItem[];
  selectedId:string;
  onSelect:(id:string)=>void;
  onAdd:()=>void;
  onEdit:(item:Blockage)=>void;
  onOpenEvidence:()=>void;
}
const markerPoints=[{x:84,y:72},{x:390,y:74},{x:73,y:164},{x:410,y:157},{x:100,y:255},{x:380,y:251}];

export function BlockageMap({items,evidence,selectedId,onSelect,onAdd,onEdit,onOpenEvidence}:BlockageMapProps){
  const selected=items.find(item=>item.id===selectedId)??items[0];
  const linked=useMemo(()=>selected?evidence.filter(item=>(selected.relatedEvidenceTitles??[]).includes(item.title)):[],[selected,evidence]);
  return <div className="blockage-map-layout">
    <section className="map-panel" aria-label="Conceptual building issue map">
      <div className="map-canvas">
        <svg viewBox="0 0 480 330" role="img" aria-labelledby="map-title map-desc" className="building-map-svg">
          <title id="map-title">Conceptual building issue map</title>
          <desc id="map-desc">A simple building outline with selectable numbered markers for project questions. Marker positions are not measured defect locations.</desc>
          <path className="map-ground" d="M30 294H450"/>
          <path className="map-building-outline" d="M156 294V109L240 62L324 109V294Z"/>
          <path className="map-roof-line" d="M147 110L240 55L333 110"/>
          <path className="map-floor-line" d="M156 169H324M156 230H324"/>
          <path className="map-center-line" d="M240 63V294"/>
          {[0,1,2,3].map(index=><rect key={index} className="map-window" x={174+(index%2)*88} y={125+Math.floor(index/2)*80} width="36" height="24" rx="1"/>)}
          {items.slice(0,markerPoints.length).map((item,index)=>{
            const point=markerPoints[index];const active=item.id===selected?.id;
            const anchorX=point.x<240?156:324;const anchorY=Math.min(273,Math.max(89,point.y));
            return <g key={item.id} role="button" tabIndex={0} aria-label={`Select question ${index+1}: ${item.title}`} aria-pressed={active} aria-controls="blockage-detail" className={`map-marker ${active?'is-selected':''}`} onClick={()=>onSelect(item.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(item.id);}}}>
              <path className="map-connector" d={`M${anchorX} ${anchorY}L${point.x} ${point.y}`}/>
              <circle cx={point.x} cy={point.y} r="18" className="map-marker-ring"/>
              <circle cx={point.x} cy={point.y} r="12" className="map-marker-dot"/>
              <text x={point.x} y={point.y+4} textAnchor="middle" className="map-marker-number">{String(index+1).padStart(2,'0')}</text>
            </g>;
          })}
        </svg>
        <div className="map-caption"><span className="map-caption-mark"/>Concept diagram. Markers are not defect locations; all questions remain in the list.</div>
      </div>
      <div className="map-issue-list" aria-label="Project questions">
        {items.length?items.map((item,index)=><button key={item.id} type="button" aria-pressed={item.id===selected?.id} className={`map-issue-button ${item.id===selected?.id?'active':''}`} onClick={()=>onSelect(item.id)}><span className="map-issue-number">{String(index+1).padStart(2,'0')}</span><span><strong>{item.title}</strong><small>{item.category}</small></span><span className={`issue-dot issue-${item.status.toLowerCase().replaceAll(' ','-')}`} aria-label={item.status}/></button>):<div className="map-empty">No questions yet. Add the first one to begin.</div>}
        <button type="button" className="map-add-button" onClick={onAdd}><Plus size={16}/>Add a question</button>
      </div>
    </section>
    {selected?<section id="blockage-detail" className="blockage-detail" aria-live="polite" aria-labelledby="blockage-detail-title">
      <div className="detail-kicker"><span>{selected.category}</span><span className={`record-status record-${selected.status.toLowerCase().replaceAll(' ','-')}`}>{selected.status}</span></div>
      <div className="blockage-detail-heading"><h3 id="blockage-detail-title">{selected.title}</h3><button type="button" className="icon-button" aria-label={`Edit ${selected.title}`} onClick={()=>onEdit(selected)}><PenLine size={16}/></button></div>
      <p className="detail-summary">{selected.summary}</p>
      <div className="detail-line"><strong>Why it matters</strong><p>{selected.impact||'Not recorded.'}</p></div>
      {selected.possibleResponses.length>0&&<div className="detail-line"><strong>Responses to examine</strong><ul>{selected.possibleResponses.map(value=><li key={value}>{value}</li>)}</ul></div>}
      {selected.prerequisites.length>0&&<div className="detail-line"><strong>Before this moves</strong><ul>{selected.prerequisites.map(value=><li key={value}>{value}</li>)}</ul></div>}
      <div className="detail-line"><strong>Evidence still needed</strong>{selected.evidenceNeeded.length?<ul>{selected.evidenceNeeded.map(value=><li key={value}>{value}</li>)}</ul>:<p>Not recorded.</p>}</div>
      <div className="linked-evidence-block"><div className="linked-evidence-head"><strong>Related evidence</strong><button type="button" className="text-button" onClick={onOpenEvidence}>Open register <ArrowUpRight size={14}/></button></div>
        {linked.length?linked.map(item=><div className="linked-evidence-item" key={item.id}><span className="evidence-link-mark"/><div><strong>{item.title}</strong><small>{item.source}</small></div></div>):<p className="no-linked-evidence">No source is linked. Keep the question open until evidence is added.</p>}
      </div>
    </section>:<section className="blockage-detail blockage-empty"><h3>Start with an open question</h3><p>Add a concern or missing fact. Keep it separate from verified building information.</p><button type="button" className="button button-primary" onClick={onAdd}><Plus size={16}/>Add a question</button></section>}
  </div>;
}

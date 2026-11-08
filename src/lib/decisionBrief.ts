import type {Blockage,Building,DecisionGate,EvidenceItem,Pathway,Project,RetrofitMeasure,RoadmapItem,SurveyMetricGroup} from '../types';

interface DecisionBriefData{
  project:Project;buildings:Building[];evidence:EvidenceItem[];blockages:Blockage[];pathways:Pathway[];
  measures:RetrofitMeasure[];gates:DecisionGate[];roadmap:RoadmapItem[];survey:SurveyMetricGroup[];assumptions:string[];
}
const bullets=(items:string[])=>items.length?items.map(item=>`- ${item}`).join('\n'):'- Not recorded';
const sourceLine=(titles:string[])=>titles?.length?titles.join('; '):'None linked';
const stressLabels:Record<string,string>={
  roof:'Roof capacity is unknown',operator:'No shared-system operator is identified',load:'Building loads are not measured',
  planning:'Permissions or ownership are unresolved',survey:'Survey responses are not local',
};

export function buildDecisionBrief(data:DecisionBriefData):string{
  const{project,buildings,evidence,blockages,pathways,measures,gates,roadmap,survey,assumptions}=data;
  const openGates=gates.filter(item=>item.status!=='Approved');
  const openBlockages=blockages.filter(item=>item.status!=='Resolved');
  const lines=[
    `# ${project.name}: decision brief`,'',
    `Prepared ${new Date().toLocaleDateString('en-GB',{year:'numeric',month:'long',day:'numeric'})}`,'',
    `**Location:** ${[project.region,project.country].filter(Boolean).join(', ')||'Not recorded'}`,
    `**Project status:** ${project.status}`,
    '**Current position:** No preferred route is established. Options remain candidates until evidence and decision gates are addressed.','',
    '## Scope',project.description||'No project scope is recorded.','',
    '## Buildings',...(buildings.length?buildings.map(building=>`### ${building.name}\n\nAddress: ${building.address||'Not recorded'}\n\nRecord status: ${building.condition}. Current use: ${building.currentUse||'Not recorded'}. Type: ${building.buildingType||'Not recorded'}.\n\n**Documented facts:**\n${bullets(building.documentedFacts)}\n\n**Unknowns to check:**\n${bullets(building.unknowns)}\n\n**Related sources:** ${sourceLine(building.evidenceTitles)}\n\n${building.notes||'No further building note.'}`):['No building records have been added.']),'',
    '## Open questions and evidence gaps',...(openBlockages.length?openBlockages.map(item=>`### ${item.title}\n\n**Status:** ${item.status}. **Confidence:** ${item.confidence}.\n\n${item.summary}\n\n**Why it matters:** ${item.impact||'Not recorded'}\n\n**Evidence needed:**\n${bullets(item.evidenceNeeded)}\n\n**Responses to examine:**\n${bullets(item.possibleResponses)}\n\n**Related sources:** ${sourceLine(item.relatedEvidenceTitles)}`):['No open question is recorded. This does not certify the building or remove the need for professional review.']),'',
    '## Survey findings',project.slug==='dakota-crescent'?'The supplied 114-response survey is a broad, self-selected sample. It is not representative and is not specific to Dakota Crescent. The renovation question is affirmatively framed and offers no explicit “no” response. These results indicate broad signals only; they do not establish local demand or feasibility.':'No Dakota-specific survey result is applied to this project.',
    ...(project.slug==='dakota-crescent'?survey.map(group=>`\n### ${group.title}\n\nQuestion: ${group.question}\n\nValid responses: ${group.validCount}.\n\n${group.categories.map(item=>`- ${item.label}: ${item.count}`).join('\n')}\n\n${group.sourceNote}`):[]),'',
    '## Candidate future uses',...(pathways.length?pathways.map(item=>`### ${item.title}\n\n**Status:** ${item.status}. **Potential users:** ${item.audience||'Not recorded'}.\n\n${item.summary}\n\n**Opportunity:** ${item.opportunity||'Not recorded'}\n\n**Requirements:**\n${bullets(item.requirements)}\n\n**Signals:**\n${bullets(item.supportingSignals)}\n\n**Trade-offs:**\n${bullets(item.tradeoffs)}\n\n**Open checks:**\n${bullets(item.evidenceNeeded)}\n\n**Related sources:** ${sourceLine(item.evidenceTitles)}`):['No candidate use has been added.']),'',
    '## Retrofit sequence',...(measures.length?measures.slice().sort((a,b)=>a.orderIndex-b.orderIndex).map(item=>`### ${item.orderIndex}. ${item.title}\n\nStage: ${item.stage}. Status: ${item.status}.\n\n${item.intent}\n\n**Prerequisites:**\n${bullets(item.prerequisites)}\n\n**Watchouts:**\n${bullets(item.watchouts)}\n\n**Evidence needed:**\n${bullets(item.evidenceNeeded)}\n\n**Related sources:** ${sourceLine(item.evidenceTitles)}`):['No retrofit measures have been added.']),'',
    '## Route comparison','Building-only and coordinated/shared-system routes remain conditional. The app calculates no engineering score, energy yield or cost estimate.','',
    '### Selected assumptions',...(assumptions.length?assumptions.map(item=>`- ${stressLabels[item]??item}`):['No comparison assumptions selected.']),'',
    '## Decision gates',...(gates.length?gates.slice().sort((a,b)=>a.orderIndex-b.orderIndex).map(item=>`- **${item.title}: ${item.status}.** ${item.question} ${item.reason} Requirements: ${item.requirements.join('; ')||'Not recorded'} Related sources: ${sourceLine(item.evidenceTitles)}.`):['No decision gates have been recorded.']),'',
    '## Roadmap',...(roadmap.length?roadmap.map(item=>`- **${item.phase} | ${item.title} (${item.status}):** ${item.description}`):['No roadmap actions have been added.']),'',
    '## Sources in this project',...(evidence.length?evidence.map(item=>`- ${item.title} — ${item.status}. ${item.source}${item.sourceUrl?` (${item.sourceUrl})`:''}`):['No evidence items have been added.']),'',
    '## Conditions and limits',
    `- ${openGates.length} gate(s) are not marked approved. A workspace status is not independent verification.`,
    '- This brief is a research aid, not an engineering, energy, conservation, legal, safety, cost or code-compliance assessment.',
    '- Do not claim savings, carbon reductions, site suitability or approval without suitable measured data and qualified review.',
    '- Any status shown here is a project record, not certification by Reclaim.','',
  ];
  return lines.join('\n');
}

export function downloadDecisionBrief(data:DecisionBriefData):void{
  const text=buildDecisionBrief(data);const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`${data.project.slug||'reclaim-project'}-decision-brief.md`;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export type AuthMode = 'demo' | 'supabase';
export type ProjectStatus = 'In research' | 'Planning' | 'Active' | 'Archived';
export type EvidenceStatus = 'Verified source' | 'Team research' | 'Survey finding' | 'Expert insight' | 'Estimate' | 'Needs verification';
export type EvidenceKind = 'Official source' | 'Research paper' | 'Survey' | 'Interview' | 'Dataset' | 'Team note' | 'Other';
export type BuildingCondition = 'Not assessed' | 'Needs verification' | 'Inspected';
export type BlockageStatus = 'Needs verification' | 'Evidence linked' | 'Under review' | 'Resolved' | 'Deferred';
export type MeasureStatus = 'Proposed' | 'Assessing' | 'Selected' | 'In progress' | 'Complete' | 'Deferred' | 'Rejected';
export type RecordStatus = 'Not started' | 'In progress' | 'Held' | 'Complete';
export type DecisionGateStatus = 'Open' | 'Evidence linked' | 'Blocked' | 'Deferred' | 'Approved' | 'Rejected';
export type ProjectRole = 'owner'|'member'|'viewer'|'contributor';

export interface AppUser {
  id:string;
  email:string;
  name:string;
  mode:AuthMode;
  avatarUrl?:string;
  bio?:string;
  websiteUrl?:string;
  instagramUrl?:string;
  linkedinUrl?:string;
  xUrl?:string;
  publicProfile?:boolean;
}

export interface ProfilePatch {
  name:string;
  bio:string;
  websiteUrl:string;
  instagramUrl:string;
  linkedinUrl:string;
  xUrl:string;
  avatarUrl?:string;
  publicProfile?:boolean;
}

export interface Project {
  id:string;
  slug:string;
  name:string;
  description:string;
  country:string;
  region:string;
  status:ProjectStatus;
  ownerId?:string;
  createdAt:string;
  isCaseStudy?:boolean;
  visibility?:'private'|'public';
  locationLabel?:string;
  latitude?:number|null;
  longitude?:number|null;
  publicLatitude?:number|null;
  publicLongitude?:number|null;
  locationPrecision?:'exact'|'approximate'|'area'|'hidden';
  publicGalleryEnabled?:boolean;
  assumptions:string[];
}
export interface Building {id:string;projectId:string;name:string;address:string;buildingType:string;currentUse:string;yearBuilt:string;approximateArea:string;condition:BuildingCondition;notes:string;documentedFacts:string[];unknowns:string[];evidenceTitles:string[];}
export interface EvidenceItem {id:string;projectId:string;title:string;kind:EvidenceKind;status:EvidenceStatus;source:string;sourceUrl:string;summary:string;addedBy:string;date:string;}
export interface CategoryCount {label:string;count:number;}
export interface SurveyFieldSummary {field:string;validCount:number;categories:CategoryCount[];}
export interface SurveyDataset {id:string;projectId:string;title:string;rowCount:number;importedAt:string;fields:SurveyFieldSummary[];note:string;}
export interface Blockage {id:string;projectId:string;buildingId?:string;category:string;title:string;summary:string;impact:string;confidence:'Unknown'|'Low'|'Medium'|'High';status:BlockageStatus;possibleResponses:string[];prerequisites:string[];evidenceNeeded:string[];relatedEvidenceTitles:string[];}
export interface Pathway {id:string;projectId:string;title:string;summary:string;status:'Research candidate'|'Under review'|'Selected';audience:string;opportunity:string;requirements:string[];supportingSignals:string[];tradeoffs:string[];evidenceNeeded:string[];evidenceTitles:string[];}
export interface RetrofitMeasure {id:string;projectId:string;orderIndex:number;stage:string;title:string;intent:string;prerequisites:string[];watchouts:string[];evidenceNeeded:string[];evidenceTitles:string[];status:MeasureStatus;}
export interface DecisionGate {id:string;projectId:string;orderIndex:number;title:string;question:string;reason:string;requirements:string[];evidenceTitles:string[];status:DecisionGateStatus;}
export interface ProjectMember {projectId:string;userId:string;displayName:string;email:string;role:ProjectRole;}
export type AccessRequestStatus = 'pending'|'approved'|'rejected'|'withdrawn';
export interface ProjectAccessRequest {id:string;projectId:string;requesterId?:string;requesterName:string;requesterEmail:string;requestedRole:Exclude<ProjectRole,'owner'>;message:string;status:AccessRequestStatus;decisionNote:string;createdAt:string;decidedAt?:string;}
export interface ProjectActivity {id:string;projectId:string;actorId?:string;entityType:string;entityId?:string;action:string;summary:string;metadata:Record<string,unknown>;createdAt:string;}
export interface RoadmapItem {id:string;projectId:string;phase:string;title:string;description:string;status:RecordStatus;owner?:string;}
export interface SurveyMetricGroup {title:string;question:string;validCount:number;categories:CategoryCount[];sourceNote:string;}

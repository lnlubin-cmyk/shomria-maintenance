export type UserRole = "admin" | "resident" | "maintenance" | "maintenance_manager";
export type FaultStatus = "received" | "in_treatment" | "fixed" | "closed";
export type TreatmentType = "electricity" | "plumbing" | "other";
export type FaultPriority = "very_urgent" | "normal" | "can_wait";

/** Hebrew labels — the single source of truth for how each enum renders. */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "אדמין",
  resident: "תושב",
  maintenance: "איש תחזוקה",
  maintenance_manager: "מנהל תחזוקה",
};

export const STATUS_LABELS: Record<FaultStatus, string> = {
  received: "התקלה התקבלה במערכת",
  in_treatment: "התקלה בטיפול",
  fixed: "התקלה תוקנה",
  closed: "הקריאה סגורה",
};

/** Compact labels for the resident status tracker (stepper). */
export const STATUS_SHORT_LABELS: Record<FaultStatus, string> = {
  received: "התקבלה",
  in_treatment: "בטיפול",
  fixed: "תוקנה",
  closed: "סגורה",
};

export const TREATMENT_TYPE_LABELS: Record<TreatmentType, string> = {
  electricity: "חשמל",
  plumbing: "אינסטלציה",
  other: "אחר",
};

export const PRIORITY_LABELS: Record<FaultPriority, string> = {
  very_urgent: "דחוף מאוד",
  normal: "רגיל",
  can_wait: "יכול לחכות",
};

export const STATUS_ORDER: FaultStatus[] = ["received", "in_treatment", "fixed", "closed"];
export const TREATMENT_TYPE_ORDER: TreatmentType[] = ["electricity", "plumbing", "other"];
// Most urgent first.
export const PRIORITY_ORDER: FaultPriority[] = ["very_urgent", "normal", "can_wait"];

export const STATUS_STYLES: Record<FaultStatus, string> = {
  received: "bg-blue-100 text-blue-800",
  in_treatment: "bg-amber-100 text-amber-800",
  fixed: "bg-emerald-100 text-emerald-800",
  closed: "bg-gray-200 text-gray-700",
};

export const PRIORITY_STYLES: Record<FaultPriority, string> = {
  very_urgent: "bg-red-100 text-red-800",
  normal: "bg-gray-100 text-gray-700",
  can_wait: "bg-slate-100 text-slate-500",
};

export interface Resident {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  share_phone: boolean;
  share_house: boolean;
}

export interface AppUser {
  id: string;
  resident_id: string | null; // null for external (non-resident) maintenance staff
  role: UserRole;
  first_name: string | null; // set only for non-resident users
  last_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
}

/** A person who can be shown by name — either a linked resident or a user's own name. */
export interface NamedUser {
  first_name: string | null;
  last_name: string | null;
  resident: Pick<Resident, "first_name" | "last_name"> | null;
}

/** Display name for a user: their resident's name, or their own (external staff). */
export function staffName(u: NamedUser | null | undefined): string {
  if (!u) return "—";
  if (u.resident) return `${u.resident.first_name} ${u.resident.last_name}`;
  if (u.first_name && u.last_name) return `${u.first_name} ${u.last_name}`;
  return "—";
}

export interface BuildingLayer {
  id: number;
  name: string; // "בתים", "מבני ציבור"
  prefix: string; // "בית משפחת", ""
  sort_order: number;
}

export interface Building {
  plot_number: string;
  street_name: string | null;
  house_number: string | null;
  building_name: string; // bare name — "לוי" (no "בית משפחת" prefix)
  resident_1: string | null;
  resident_2: string | null;
  resident_3: string | null;
  resident_4: string | null;
  layer_id: number | null;
  layer?: Pick<BuildingLayer, "name" | "prefix"> | null;
  latitude: number | null;
  longitude: number | null;
  itm_x: number | null;
  itm_y: number | null;
}

/**
 * How a building reads in dropdowns and lists: the layer prefix + the bare name
 * ("בית משפחת לוי"), or just the name when the layer has no prefix ("חדר אוכל").
 * The map, by contrast, shows only the bare name.
 */
export function buildingLabel(
  b: { building_name: string; layer?: { prefix: string } | null } | null | undefined
): string {
  if (!b) return "—";
  const prefix = b.layer?.prefix?.trim();
  return prefix ? `${prefix} ${b.building_name}` : b.building_name;
}

export interface Fault {
  fault_number: number;
  caller_resident_id: string;
  created_by_user_id: string;
  building_plot_number: string;
  fault_description: string;
  status: FaultStatus;
  priority: FaultPriority;
  assigned_to_user_id: string | null;
  treatment_description: string | null;
  treatment_type: TreatmentType | null;
  hours_spent: number | null; // staff only
  total_cost: number; // staff only — sum of cost items
  closed_at: string | null;
  created_at: string;
}

/** A message/SMS sent to the resident about a fault. */
export interface FaultMessage {
  id: string;
  body: string;
  to_phone: string | null;
  sms_ok: boolean | null;
  is_automatic: boolean;
  created_at: string;
  sender: NamedUser | null; // null for the automatic system message
}

/** A cost line on a fault (staff only). */
export interface FaultCostItem {
  id: string;
  description: string;
  amount: number;
  created_at: string;
}

/** A fault joined with the names needed to display it. */
export interface FaultRow extends Fault {
  caller: Pick<Resident, "first_name" | "last_name"> | null;
  building: { building_name: string; layer: { prefix: string } | null } | null;
  // Assignee may be a non-resident staff member, so carry both name sources.
  assignee: NamedUser | null;
}

/** A "קהילה" item: an admin-managed menu entry with an attached PDF. */
export interface CommunityItem {
  id: string;
  subject: string;
  file_path: string | null;
  file_name: string | null;
  is_visible: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** A community item reduced to what the nav needs (only visible + complete ones). */
export interface CommunityMenuItem {
  id: string;
  subject: string;
}

export type HomeMediaKind = "image" | "video" | "youtube";

/** Home-page carousel media (image, uploaded video, or YouTube), admin-managed. */
export interface HomeMedia {
  id: string;
  kind: HomeMediaKind;
  file_path: string | null; // null for youtube
  file_name: string | null;
  mime_type: string | null;
  youtube_id: string | null; // set only for youtube
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** A media item reduced to what the carousel needs. */
export interface HomeMediaItem {
  id: string;
  kind: HomeMediaKind;
  url?: string; // image/video: public file URL
  youtubeId?: string; // youtube: the video id
}

/** A Torah lesson (שיעור תורה), admin-managed. */
export interface TorahLesson {
  id: string;
  subject: string;
  lecturer: string; // מעביר השיעור — free text
  occurrence: string; // free text, e.g. "כל יום ראשון ושלישי"
  hour: string; // free text
  notes: string; // הערות — free text
  is_visible: boolean;
  sort_order: number;
}

/** The signed-in user. `resident` is null for external maintenance staff. */
export interface Session {
  user: AppUser;
  resident: Resident | null;
  displayName: string;
  residentId: string | null;
}

export function isStaff(role: UserRole): boolean {
  return role === "maintenance" || role === "maintenance_manager" || role === "admin";
}

export function canDeleteFaults(role: UserRole): boolean {
  return role === "maintenance_manager" || role === "admin";
}

export function fullName(r: { first_name: string; last_name: string } | null | undefined): string {
  return r ? `${r.first_name} ${r.last_name}` : "—";
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =====================================================================
// Votes / elections (הצבעות)
// =====================================================================
export type VoteFormat = "options" | "election";
export type VoteClosureMode = "manual" | "scheduled";
export type VoteState = "upcoming" | "open" | "closed";

export const VOTE_FORMAT_LABELS: Record<VoteFormat, string> = {
  options: "אפשרויות מוגדרות מראש",
  election: "בחירות (בחירת מועמדים)",
};

export const VOTE_STATE_LABELS: Record<VoteState, string> = {
  upcoming: "טרם החלה",
  open: "הצבעה פעילה",
  closed: "ההצבעה הסתיימה",
};

export const VOTE_STATE_STYLES: Record<VoteState, string> = {
  upcoming: "bg-blue-100 text-blue-800",
  open: "bg-emerald-100 text-emerald-800",
  closed: "bg-gray-200 text-gray-700",
};

export interface Vote {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  format: VoteFormat;
  max_selections: number;
  start_at: string;
  closure_mode: VoteClosureMode;
  closes_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface VoteOption {
  id: string;
  label: string;
  candidate_resident_id: string | null;
  sort_order: number;
}

export interface VoteCommitteeMember {
  resident_id: string;
  first_name: string;
  last_name: string;
}

/** One option's result line — only ever assembled after the vote is closed. */
export interface VoteOptionResult {
  id: string;
  label: string;
  count: number;
}

export interface VoteResults {
  totalVoters: number;
  options: VoteOptionResult[];
}

/** A resident row in the committee's turnout lists (voted / not-yet-voted). */
export interface VoteRosterEntry {
  resident_id: string;
  first_name: string;
  last_name: string;
  by_self?: boolean; // in the "voted" list: true = voted themselves, false = entered on their behalf
}

/**
 * The state of a vote at a point in time. `closed_at` (a manual/early close)
 * wins; otherwise a scheduled vote closes automatically once its time passes.
 */
export function voteState(
  v: Pick<Vote, "start_at" | "closes_at" | "closed_at" | "closure_mode">,
  now: Date = new Date()
): VoteState {
  const t = now.getTime();
  if (v.closed_at) return "closed";
  if (t < new Date(v.start_at).getTime()) return "upcoming";
  if (v.closure_mode === "scheduled" && v.closes_at && t >= new Date(v.closes_at).getTime()) {
    return "closed";
  }
  return "open";
}

export function isVoteOpen(
  v: Pick<Vote, "start_at" | "closes_at" | "closed_at" | "closure_mode">,
  now: Date = new Date()
): boolean {
  return voteState(v, now) === "open";
}

export type UserRole = "admin" | "resident" | "maintenance" | "maintenance_manager";
export type FaultStatus = "received" | "in_treatment" | "on_hold" | "fixed" | "duplicate";
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
  on_hold: "בהמתנה",
  fixed: "התקלה תוקנה",
  duplicate: "כפול (יש כבר קריאה במערכת)",
};

/** Compact labels for the resident status tracker (stepper). */
export const STATUS_SHORT_LABELS: Record<FaultStatus, string> = {
  received: "התקבלה",
  in_treatment: "בטיפול",
  on_hold: "בהמתנה",
  fixed: "תוקנה",
  duplicate: "כפול",
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

// All statuses, in the order they appear in staff dropdowns and filters.
export const STATUS_ORDER: FaultStatus[] = [
  "received",
  "in_treatment",
  "on_hold",
  "fixed",
  "duplicate",
];

// The linear progression shown in the resident status tracker. "בהמתנה" and
// "כפול" are non-linear outcomes and are shown separately, not as steps.
export const STATUS_STEPPER: FaultStatus[] = ["received", "in_treatment", "fixed"];
export const TREATMENT_TYPE_ORDER: TreatmentType[] = ["electricity", "plumbing", "other"];
// Most urgent first.
export const PRIORITY_ORDER: FaultPriority[] = ["very_urgent", "normal", "can_wait"];

export const STATUS_STYLES: Record<FaultStatus, string> = {
  received: "bg-blue-100 text-blue-800",
  in_treatment: "bg-amber-100 text-amber-800",
  on_hold: "bg-slate-200 text-slate-700",
  fixed: "bg-emerald-100 text-emerald-800",
  duplicate: "bg-gray-200 text-gray-600",
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
  is_member: boolean; // kibbutz member — only members may vote
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
  water_heater_type: string | null; // סוג הדוד — free text (e.g. דוד שמש)
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
  // Nullable: cleared when the caller resident is deleted (the call is kept,
  // and caller_name preserves the frozen name for display).
  caller_resident_id: string | null;
  caller_name: string | null; // frozen snapshot of the caller's name
  created_by_user_id: string | null;
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

/** A [key, value] note staff keep about a house (staff only). */
export interface BuildingFact {
  id: string;
  key: string;
  value: string;
  created_at: string;
}

/** A fault joined with the names needed to display it. */
export interface FaultRow extends Fault {
  caller: Pick<Resident, "first_name" | "last_name"> | null;
  building: { building_name: string; layer: { prefix: string } | null } | null;
  // Assignee may be a non-resident staff member, so carry both name sources.
  assignee: NamedUser | null;
  // Resident's 1-5 rating of the handling. For staff it's populated only for
  // מנהל תחזוקה/admin (hidden from a plain איש תחזוקה); for a resident it's their
  // own rating. Null when not rated or not visible to the viewer.
  feedback_rating: number | null;
}

/** Which menu section a document item appears under. */
export type DocSection = "community" | "info" | "torah";

/** The מכולת (grocery) info record: free text or an uploaded PDF, per `mode`. */
export interface StoreInfo {
  menu_label: string;
  mode: "text" | "pdf";
  body: string;
  file_path: string | null;
  file_name: string | null;
}

/** An admin-managed menu entry with an attached PDF (in "קהילה" or "מידע לתושב"). */
export interface CommunityItem {
  id: string;
  subject: string;
  section: DocSection;
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

export type HomeMediaKind = "image" | "video" | "youtube" | "bunny";

/** Home-page carousel media (image, uploaded video, YouTube, or Bunny Stream), admin-managed. */
export interface HomeMedia {
  id: string;
  kind: HomeMediaKind;
  file_path: string | null; // null for youtube/bunny
  file_name: string | null;
  mime_type: string | null;
  youtube_id: string | null; // set only for youtube
  bunny_video_id: string | null; // set only for bunny (the video GUID)
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** A media item reduced to what the carousel needs. */
export interface HomeMediaItem {
  id: string;
  kind: HomeMediaKind;
  url?: string; // image/video (incl. Bunny MP4): the media URL
  poster?: string; // video: optional poster/thumbnail image
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

/** A campaign — a poster image shown on first entry, with an optional link. */
export interface Campaign {
  id: string;
  title: string;
  file_path: string | null;
  file_name: string | null;
  link_url: string | null; // "/path" (internal, login-gated) or "https://…" (external)
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** The active campaign, reduced to what the home-page modal needs. */
export interface ActiveCampaign {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
}

/** צור קשר — a kibbutz unit (e.g. משרד) with an optional email/phone. */
export interface Contact {
  id: string;
  name: string; // שם היחידה (e.g. משרד)
  email: string; // אופציונלי
  phone: string; // אופציונלי
  notes: string; // מידע חופשי נוסף (למשל שעות פעילות)
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

/**
 * Split a house label into up to two display rows. Labels are usually just a
 * surname; when families share a surname, first names are appended. Row 1 is the
 * surname, row 2 the rest. The surname is the first word — or the first TWO words
 * when it starts with "בן" (e.g. "בן עגו" is a two-word surname). A hyphen keeps
 * a surname as one word (e.g. "כהן-לוי"), so it stays on a single row.
 */
export function splitHouseLabel(name: string): string[] {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [words[0] ?? ""];
  const surnameWords = words[0] === "בן" ? 2 : 1;
  const surname = words.slice(0, surnameWords).join(" ");
  const rest = words.slice(surnameWords).join(" ");
  return rest ? [surname, rest] : [surname];
}

/** Only מנהל תחזוקה / אדמין may see residents' handling feedback. */
export function canSeeFeedback(role: UserRole): boolean {
  return role === "maintenance_manager" || role === "admin";
}

/** Only מנהל תחזוקה / אדמין may export the calls grid to Excel. */
export function canExportFaults(role: UserRole): boolean {
  return role === "maintenance_manager" || role === "admin";
}

/** True once a call's fix is done, so the resident may rate the handling. */
export function canRateFault(status: FaultStatus): boolean {
  return status === "fixed";
}

export function fullName(r: { first_name: string; last_name: string } | null | undefined): string {
  return r ? `${r.first_name} ${r.last_name}` : "—";
}

/**
 * The caller's name for display: the linked resident if present, otherwise the
 * frozen snapshot kept on the fault (for a resident who was since deleted).
 */
export function callerDisplay(f: {
  caller: { first_name: string; last_name: string } | null;
  caller_name?: string | null;
}): string {
  if (f.caller) return `${f.caller.first_name} ${f.caller.last_name}`;
  return f.caller_name?.trim() || "—";
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
export type VoteFormat = "options" | "election" | "membership";
export type VoteClosureMode = "manual" | "scheduled";
export type VoteState = "upcoming" | "open" | "closed";

export const VOTE_FORMAT_LABELS: Record<VoteFormat, string> = {
  options: "אפשרויות מוגדרות מראש",
  election: "בחירות (בחירת מועמדים)",
  membership: "הצבעה לחברות",
};

/** The honesty declaration each ועדת קלפי member confirms before results publish. */
export const VOTE_APPROVAL_STATEMENT =
  "הריני מאשר שהבחירות נערכו בצורה הוגנת וישרה ואני מאשר את התוצאות הנ״ל";

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
  allow_proxy_vote: boolean;
  allow_paper_votes: boolean;
  created_at: string;
}

/** How a resident's participation was recorded. */
export type VoteMethod = "self" | "proxy" | "paper";

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

/**
 * One option's outcome line — only ever assembled after the vote is closed.
 * For options/election the accept fields hold the vote count and decline is 0.
 * For membership: electronic/paper/total = בעד, decline* = נגד.
 */
export interface VoteOptionOutcome {
  id: string;
  label: string;
  electronic: number; // app votes (membership: בעד)
  paper: number; // approved manual count (membership: בעד)
  total: number; // electronic + paper once approved (membership: בעד)
  declineElectronic: number; // membership only: נגד app votes
  declinePaper: number; // membership only: נגד manual
  declineTotal: number; // membership only: נגד total
}

/** State of the manual paper count for a closed vote. */
export interface PaperTallyState {
  paperVoters: number; // residents marked as having voted on paper (mark_paper_vote)
  submittedManualVoters: number; // manual voter count entered with the count
  required: boolean; // there is manual data → results wait for the approved count
  submissionExists: boolean;
  enteredByName: string | null;
  enteredAt: string | null;
  counts: Record<string, number>; // option_id → entered paper count (membership: בעד)
  declineCounts: Record<string, number>; // membership only: option_id → נגד manual count
  approvedResidentIds: string[]; // committee members who approved
  committeeSize: number;
  finalized: boolean; // approved by every committee member
}

/**
 * Everything the vote page needs once a vote is closed. `ready` is false while a
 * vote with paper ballots still awaits its approved manual count — until then no
 * final numbers are published.
 */
export interface VoteOutcome {
  ready: boolean;
  totalVoters: number;
  options: VoteOptionOutcome[];
  paper: PaperTallyState;
}

/** One result line in a vote protocol. */
export interface VoteProtocolResult {
  label: string;
  votes?: number; // options / election
  accept?: number; // membership: בעד
  decline?: number; // membership: נגד
}

/** The written protocol of a finally-closed vote (regulatory record). */
export interface VoteProtocol {
  title: string;
  subject: string;
  description: string | null;
  format: VoteFormat;
  startAt: string;
  closesAt: string | null;
  closedAt: string | null;
  closureMode: VoteClosureMode;
  committee: string[];
  turnout: { total: number; electronic: number; manual: number };
  results: VoteProtocolResult[];
  confirmation: string; // the honesty declaration the committee confirmed
  generatedAt: string;
}

/** A resident row in the committee's turnout lists (voted / not-yet-voted). */
export interface VoteRosterEntry {
  resident_id: string;
  first_name: string;
  last_name: string;
  method?: VoteMethod; // in the "voted" list: how their participation was recorded
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

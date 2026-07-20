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
  closed_at: string | null;
  created_at: string;
}

/** A fault joined with the names needed to display it. */
export interface FaultRow extends Fault {
  caller: Pick<Resident, "first_name" | "last_name"> | null;
  building: { building_name: string; layer: { prefix: string } | null } | null;
  // Assignee may be a non-resident staff member, so carry both name sources.
  assignee: NamedUser | null;
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

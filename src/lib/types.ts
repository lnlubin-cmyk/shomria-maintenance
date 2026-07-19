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
  resident_id: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
  is_active: boolean;
}

export interface Building {
  plot_number: string;
  street_name: string | null;
  house_number: string | null;
  building_name: string;
  resident_1: string | null;
  resident_2: string | null;
  resident_3: string | null;
  resident_4: string | null;
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
  building: Pick<Building, "building_name"> | null;
  assignee: { resident: Pick<Resident, "first_name" | "last_name"> | null } | null;
}

/** The signed-in user plus their resident record. */
export interface Session {
  user: AppUser;
  resident: Resident;
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

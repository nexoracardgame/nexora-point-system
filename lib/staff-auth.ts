export function isAdminRole(role?: string | null) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "gm" || normalized === "superadmin";
}

export function isStaffRole(role?: string | null) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "staff" || isAdminRole(normalized);
}

export function isStaffRole(role?: string | null) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "staff";
}

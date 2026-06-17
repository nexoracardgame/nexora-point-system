export const PAWN_STANDARD_INTEREST_RATE = 5;
export const PAWN_STANDARD_MAINTENANCE_FEE_THB = 200;
export const PAWN_STANDARD_LOAN_TO_VALUE_RATIO = 0.8;

export type PawnChargeSummary = {
  principalTHB: number;
  interestRate: number;
  monthlyInterestTHB: number;
  maintenanceFeeTHB: number;
  totalDueTHB: number;
};

export type PawnCollateralSummary = {
  collateralValueTHB: number;
  maxPrincipalTHB: number;
};

function toNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export function getPawnChargeSummary(
  principalTHB: number,
  interestRate = PAWN_STANDARD_INTEREST_RATE,
  maintenanceFeeTHB = PAWN_STANDARD_MAINTENANCE_FEE_THB
): PawnChargeSummary {
  const safePrincipal = Math.max(0, toNumber(principalTHB));
  const safeRate = Math.max(0, toNumber(interestRate));
  const safeMaintenanceFee = Math.max(0, toNumber(maintenanceFeeTHB));
  const monthlyInterestTHB = Math.max(0, Math.round(safePrincipal * (safeRate / 100)));

  return {
    principalTHB: safePrincipal,
    interestRate: safeRate,
    monthlyInterestTHB,
    maintenanceFeeTHB: safeMaintenanceFee,
    totalDueTHB: monthlyInterestTHB + safeMaintenanceFee,
  };
}

export function getPawnCollateralSummary(collateralValueTHB: number): PawnCollateralSummary {
  const safeCollateral = Math.max(0, toNumber(collateralValueTHB));
  const maxPrincipalTHB = Math.max(
    0,
    Math.floor(safeCollateral * PAWN_STANDARD_LOAN_TO_VALUE_RATIO)
  );

  return {
    collateralValueTHB: safeCollateral,
    maxPrincipalTHB,
  };
}

export function resolvePawnPrincipalTHB(
  principalTHB: number,
  collateralValueTHB: number
) {
  const { maxPrincipalTHB } = getPawnCollateralSummary(collateralValueTHB);
  const requestedPrincipalTHB = Math.max(0, toNumber(principalTHB));
  return requestedPrincipalTHB > 0 ? requestedPrincipalTHB : maxPrincipalTHB;
}

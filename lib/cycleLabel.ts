// lib/cycleLabel.ts
export function getCycleLabel(params: {
  selectedCycleId: string | null;
  openCycleIds: string[];
  cycleById: Map<string, string>;
}) {
  const { selectedCycleId, openCycleIds, cycleById } = params;

  if (selectedCycleId) return cycleById.get(selectedCycleId) ?? "Selected cycle";

  if (openCycleIds.length > 1) return "All open cycles";

  if (openCycleIds.length === 1) return cycleById.get(openCycleIds[0]) ?? "Open cycle";

  return "No open cycles";
}

export const SCAFFOLD_NO_MATERIALS_SUBCATEGORY_CODE = '20';

type ScaffoldOrderIdentity = {
  subcategory_code?: string | null;
  subcategory?: { code?: string | null; name?: string | null } | null;
  subcategoryName?: string | null;
  notes?: unknown;
};

const parseNotes = (notes: unknown): Record<string, unknown> | null => {
  if (notes && typeof notes === 'object') return notes as Record<string, unknown>;
  if (typeof notes !== 'string' || !notes.trim()) return null;
  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

export function isScaffoldingNoMaterials(order: ScaffoldOrderIdentity, parsedNotes?: Record<string, unknown> | null): boolean {
  if ((order.subcategory_code ?? order.subcategory?.code) === SCAFFOLD_NO_MATERIALS_SUBCATEGORY_CODE) return true;
  const notes = parsedNotes ?? parseNotes(order.notes);
  return [
    order.subcategoryName,
    order.subcategory?.name,
    notes?.service_type,
    notes?.subcategory,
    notes?.scaffoldingType,
    notes?.scaffold_type,
  ].some((value) => typeof value === 'string' && value.includes('بدون اجناس'));
}
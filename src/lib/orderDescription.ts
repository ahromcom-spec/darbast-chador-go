// Robust extractor that turns the messy `projects_v3.notes` payload into a
// human-readable Persian description for invoices / statements.
//
// Notes column can be:
//   - null
//   - a plain text note
//   - a JSON object (jsonb)
//   - a stringified JSON object
//   - a double-encoded JSON string (string whose value is JSON, wrapped in quotes)
//
// We never want to dump raw JSON into the UI.

const RENTAL_PLAN_LABELS: Record<string, string> = {
  '1': 'به شرط یک ماه',
  '2': 'به شرط دو ماه',
  '3': 'سه ماه و بیشتر',
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  facade: 'داربست نما',
  ceiling: 'داربست سقفی',
  stairs: 'داربست راه‌پله',
  industrial: 'داربست صنعتی',
  tarpaulin: 'چادر برزنتی',
  scaffolding: 'داربست فلزی',
  facade_with_materials: 'اجرای داربست با اجناس',
};

function tryParse(input: any, depth = 0): any {
  if (input == null) return null;
  if (typeof input !== 'string') return input;
  const t = input.trim();
  if (!t) return null;
  // unwrap double-encoded strings: "\"{...}\"" or "\"hello\""
  if ((t.startsWith('"') && t.endsWith('"')) && depth < 3) {
    try {
      return tryParse(JSON.parse(t), depth + 1);
    } catch {
      // strip outer quotes manually if JSON.parse failed
      return t.slice(1, -1);
    }
  }
  if ((t.startsWith('{') || t.startsWith('[')) && depth < 3) {
    try {
      return tryParse(JSON.parse(t), depth + 1);
    } catch {
      return t;
    }
  }
  return t;
}

function formatDimensions(dimensions: any[]): string {
  if (!Array.isArray(dimensions) || dimensions.length === 0) return '';
  const parts = dimensions
    .map((d) => {
      const l = Number(d?.length) || 0;
      const w = Number(d?.width) || 0;
      const h = Number(d?.height) || 0;
      if (l <= 0 && h <= 0 && w <= 0) return '';
      const pieces: string[] = [];
      if (l > 0) pieces.push(`${l} طول`);
      if (w > 0) pieces.push(`${w} عرض`);
      if (h > 0) pieces.push(`${h} ارتفاع`);
      return pieces.join('×');
    })
    .filter(Boolean);
  return parts.join(' | ');
}

function buildFromStructured(o: any): string | null {
  if (!o || typeof o !== 'object') return null;
  const lines: string[] = [];

  // multi-scaffold (expert pricing)
  if (Array.isArray(o.scaffolds) && o.scaffolds.length > 0) {
    o.scaffolds.forEach((sc: any, i: number) => {
      const label = sc?.label || `داربست ${i + 1}`;
      const dims = formatDimensions(sc?.dimensions);
      const desc = sc?.description ? ` — ${String(sc.description).trim()}` : '';
      lines.push(`• ${label}${dims ? ` (${dims})` : ''}${desc}`);
    });
  } else if (Array.isArray(o.multi_scaffolds) && o.multi_scaffolds.length > 0) {
    o.multi_scaffolds.forEach((it: any, i: number) => {
      const label = it?.label || `داربست ${i + 1}`;
      const snap = it?.snapshot || {};
      const dims = formatDimensions(snap?.dimensions);
      const purpose = snap?.locationPurpose || it?.description || '';
      lines.push(`• ${label}${dims ? ` (${dims})` : ''}${purpose ? ` — ${String(purpose).trim()}` : ''}`);
    });
  }

  // primary descriptive text
  const primary =
    o.description ||
    o.installationDescription ||
    o.additional_notes ||
    o.locationPurpose ||
    o.serviceDescription;
  if (primary && typeof primary === 'string' && primary.trim()) {
    lines.unshift(primary.trim());
  }

  // single-scaffold dimensions summary (only if we didn't already list per-scaffold)
  if (lines.length === 0 || (!Array.isArray(o.scaffolds) && !Array.isArray(o.multi_scaffolds))) {
    const dims = formatDimensions(o.dimensions);
    if (dims) lines.push(`ابعاد: ${dims}`);
  }

  const meta: string[] = [];
  const stype = o.service_type;
  if (stype && SERVICE_TYPE_LABELS[stype]) meta.push(SERVICE_TYPE_LABELS[stype]);
  const plan = o.conditions?.rentalMonthsPlan ?? o.rentalMonthsPlan;
  if (plan && RENTAL_PLAN_LABELS[String(plan)]) meta.push(RENTAL_PLAN_LABELS[String(plan)]);
  const months = o.conditions?.totalMonths;
  if (months && Number(months) > 1) meta.push(`${months} ماه`);
  if (typeof o.totalArea === 'number' && o.totalArea > 0) {
    meta.push(`مساحت ${Number(o.totalArea).toLocaleString('fa-IR')} متر`);
  }
  if (meta.length) lines.push(meta.join(' • '));

  const result = lines.filter(Boolean).join('\n').trim();
  return result || null;
}

export function extractOrderDescription(notes: any): string | null {
  if (notes == null) return null;
  const parsed = tryParse(notes);
  if (parsed == null) return null;
  if (typeof parsed === 'string') {
    // plain free-form text, just clean it up
    const t = parsed.trim();
    return t || null;
  }
  if (typeof parsed === 'object') {
    return buildFromStructured(parsed);
  }
  return null;
}

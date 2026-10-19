export interface ConditionTypeCatalog {
  byId: Map<string, { id: string; name: string }>;
  byName: Map<string, { id: string; name: string }>;
  loadedFromDb?: boolean;
}

export const CANONICAL_CONDITION_TYPE_NAMES: Record<string, string> = {
  '9526b7ae-8c84-45a2-a8ac-c4ecbeea600b': 'Security Deposit',
};

export function resolveConditionTypeIdFromEntry(
  cond: any,
  catalog?: ConditionTypeCatalog
): string {
  const explicitId = String(cond?.condition_type_id ?? cond?.conditionTypeId ?? '').trim();
  if (explicitId) {
    return explicitId;
  }
  const explicitName = String(
    cond?.name ?? cond?.condition_type_name ?? cond?.condition_types?.name ?? ''
  ).trim();
  if (explicitName && catalog?.byName.has(explicitName.toLowerCase())) {
    return catalog.byName.get(explicitName.toLowerCase())!.id;
  }
  return '';
}

export function resolveConditionName(
  cond: any,
  catalog?: ConditionTypeCatalog
): string {
  const typeId = resolveConditionTypeIdFromEntry(cond, catalog);
  if (typeId && catalog?.byId.has(typeId)) {
    return catalog.byId.get(typeId)!.name;
  }
  const explicitName =
    cond?.name ?? cond?.condition_type_name ?? cond?.condition_types?.name;
  if (typeof explicitName === 'string' && explicitName.trim().length > 0) {
    return explicitName.trim();
  }
  if (typeId && CANONICAL_CONDITION_TYPE_NAMES[typeId]) {
    return CANONICAL_CONDITION_TYPE_NAMES[typeId];
  }
  return 'Security Deposit';
}

export function resolveConditionNotes(cond: any): string | null {
  const raw = cond?.notes;
  return raw !== undefined && raw !== null && String(raw).trim().length > 0
    ? String(raw).trim()
    : null;
}

export function toConditionNotesMap(
  conditions: any[],
  catalog?: ConditionTypeCatalog
): { map: Map<string, string | null>; hasUnresolvedEntry: boolean } {
  const map = new Map<string, string | null>();
  let hasUnresolvedEntry = false;

  for (const cond of conditions) {
    const id = resolveConditionTypeIdFromEntry(cond, catalog);
    if (!id) {
      hasUnresolvedEntry = true;
      continue;
    }
    map.set(id, resolveConditionNotes(cond));
  }

  return { map, hasUnresolvedEntry };
}

export function toConditionDisplayMap(
  conditions: any[]
): Map<string, { name: string; notes: string | null }> {
  const map = new Map<string, { name: string; notes: string | null }>();
  for (const c of conditions) {
    const key = String(
      c?.condition_type_id ?? c?.conditionTypeId ?? resolveConditionName(c)
    ).trim();
    if (!key) continue;
    map.set(key, {
      name: resolveConditionName(c),
      notes: resolveConditionNotes(c),
    });
  }
  return map;
}

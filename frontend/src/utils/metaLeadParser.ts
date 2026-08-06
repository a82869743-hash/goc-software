/* ============================================================
   Meta Lead Form Question & Response Dynamic Parser
   Converts stored extra fields from notes into structured UI cards
   ============================================================ */

export interface MetaFormField {
  rawKey: string;
  label: string;
  value: string;
  icon: string;
}

/**
  Formats raw technical keys into clean, human-readable labels.
  e.g., "current_area_of_residence" -> "Current Area Of Residence"
        "which_car_do_you_own?" -> "Which Car Do You Own?"
 */
export function formatMetaFieldLabel(rawKey: string): string {
  if (!rawKey) return 'Question';

  let cleaned = rawKey
    .replace(/[?:]/g, '')
    .replace(/_/g, ' ')
    .trim();

  // Capitalize each word cleanly
  return cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
  Assigns a Material symbol icon based on field label or key context.
 */
export function getMetaFieldIcon(rawKey: string): string {
  const k = rawKey.toLowerCase();

  if (k.includes('area') || k.includes('residence') || k.includes('city') || k.includes('location') || k.includes('address')) {
    return 'location_on';
  }
  if (k.includes('car') || k.includes('vehicle') || k.includes('model') || k.includes('make') || k.includes('auto')) {
    return 'directions_car';
  }
  if (k.includes('service') || k.includes('requirement') || k.includes('interested') || k.includes('package') || k.includes('work')) {
    return 'build';
  }
  if (k.includes('budget') || k.includes('price') || k.includes('cost') || k.includes('spend')) {
    return 'payments';
  }
  if (k.includes('date') || k.includes('time') || k.includes('schedule') || k.includes('when')) {
    return 'calendar_today';
  }
  if (k.includes('phone') || k.includes('contact') || k.includes('mobile') || k.includes('call')) {
    return 'call';
  }
  if (k.includes('email') || k.includes('mail')) {
    return 'mail';
  }
  if (k.includes('color') || k.includes('paint') || k.includes('wrap') || k.includes('shade')) {
    return 'palette';
  }

  return 'quiz';
}

/**
  Parses any string notes containing "Meta Extra Fields — key: val | key2: val2" or "key: val" lines
  into a structured list of MetaFormField objects.
 */
export function parseMetaLeadFields(notes: string | null | undefined): MetaFormField[] {
  if (!notes) return [];

  const fields: MetaFormField[] = [];

  // Check if string contains "Meta Extra Fields — "
  let payloadString = notes;
  const marker = 'Meta Extra Fields —';
  if (notes.includes(marker)) {
    payloadString = notes.split(marker)[1] || '';
  }

  // Split by pipe '|' or newlines
  const pairs = payloadString.split(/[|\n]/);

  for (const rawPair of pairs) {
    const trimmed = rawPair.trim();
    if (!trimmed) continue;

    // Split on first colon ':'
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const rawKey = trimmed.substring(0, colonIdx).trim();
      let rawVal = trimmed.substring(colonIdx + 1).trim();

      if (!rawKey) continue;

      const label = formatMetaFieldLabel(rawKey);
      const icon = getMetaFieldIcon(rawKey);
      const displayVal = rawVal && rawVal.length > 0 ? rawVal : '—';

      fields.push({
        rawKey,
        label,
        value: displayVal,
        icon,
      });
    }
  }

  return fields;
}

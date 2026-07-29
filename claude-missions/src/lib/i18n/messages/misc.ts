// "misc" UI copy. Filled by the i18n translation pass. Add keys to BOTH sr and
// en, keeping this typed structure (Serbian is the source of truth; en is typed
// against the sr keys so a missing translation fails the build). Namespace all
// keys as "misc.<name>".
const sr = {} as const;

const en: Record<keyof typeof sr, string> = {};

export const misc = { sr, en };

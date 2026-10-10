/**
 * Medication name normalization for local rule matching (EF-21).
 * Handles case, accents, dosage suffixes, pharmaceutical forms and a small
 * brand-name → substance map. Non-exhaustive by design; unresolvable names
 * are reported so matching can be skipped for them.
 */

export const SUBSTANCE_ALIASES: Record<string, string[]> = {
  warfarin: ['warfarin', 'warfarine', 'coumadin', 'coumadine'],
  ibuprofen: ['ibuprofen', 'ibuprofene', 'advil', 'nurofen', 'brufen', 'upfen'],
  acetylsalicylic_acid: [
    'acetylsalicylic acid',
    'acide acetylsalicylique',
    'acetylsalicylique',
    'aspirin',
    'aspirine',
    'aspegic',
    'kardegic',
    'asa',
  ],
  simvastatin: ['simvastatin', 'simvastatine', 'zocor'],
  clarithromycin: ['clarithromycin', 'clarithromycine', 'zeclar'],
  sildenafil: ['sildenafil', 'sildenafil citrate', 'sildenafile', 'viagra', 'revatio'],
  isosorbide_dinitrate: [
    'isosorbide dinitrate',
    'dinitrate disosorbide',
    'dinitrate isosorbide',
    'isosorbide',
    'risordan',
  ],
  methotrexate: ['methotrexate', 'novatrex', 'imeth', 'metoject'],
  trimethoprim_sulfamethoxazole: [
    'trimethoprim sulfamethoxazole',
    'trimethoprime sulfamethoxazole',
    'cotrimoxazole',
    'cotrimoxazol',
    'bactrim',
    'trimethoprim',
    'trimethoprime',
    'sulfamethoxazole',
    'sulfamethoxazol',
  ],
  tramadol: ['tramadol', 'contramal', 'topalgic'],
  fluoxetine: ['fluoxetine', 'fluoxetina', 'prozac'],
  lisinopril: ['lisinopril', 'zestril', 'prinivil'],
  spironolactone: ['spironolactone', 'aldactone'],
  // Substances without rules — needed for negative-pair testing:
  paracetamol: ['paracetamol', 'acetaminophen', 'paracetamolo', 'doliprane', 'dafalgan', 'efferalgan', 'tylenol'],
  omeprazole: ['omeprazole', 'omeprazol', 'mopral', 'zoltum'],
  amoxicillin: ['amoxicillin', 'amoxicilline', 'clamoxyl'],
  cetirizine: ['cetirizine', 'cetirizina', 'zyrtec', 'virlix'],
  loratadine: ['loratadine', 'loratadina', 'claritine'],
  amlodipine: ['amlodipine', 'amlodipina', 'amlor'],
  salbutamol: ['salbutamol', 'salbutamolo', 'ventoline'],
  vitamin_d: ['vitamin d', 'vitamine d', 'cholecalciferol', 'colecalciferol', 'uvedose'],
};

const NOISE_PATTERNS: RegExp[] = [
  /\b\d+([.,]\d+)?\s*(mg|mcg|µg|ug|g|iu|ui|ml|l|%|ui\/ml)\b/g,
  /\b(comprim[ée]s?|comprimes?|tabletts?|tablets?|cp|cpr|g[ée]lules?|capsules?|sachets?|sirop|syrup|solution|suspension|injectable|buvable|buv\.?|oral|orale|oro-dispersibles?|lyophilisats?|suppositoires?|ovules?|pommade|cr[èe]me|gel|collyre|spray|ampoules?)\b/g,
  /\b(dose|dosage|dose\/prise)\b/g,
  /\b(ec|e\.?c\.?|lp|lp\.?|adr|retard|prolong[ée]e)\b/g,
  /\b(sodium|sodique|potassium|potassique|calcium|chlorhydrate|chlorhydrique|hydrochloride|tartrate|besylate|maleate|furoate|h[ée]misuccinate|dihydrog[ée]n[ée]s?|acide)\b/g,
];

/** Strips accents and lowercases. */
export function basicNormalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’'`´]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reduces a printed medication name to a comparable key, or null when the
 * name cannot be resolved to a known substance.
 */
export function canonicalSubstance(name: string): string | null {
  let n = basicNormalize(name);
  for (const pattern of NOISE_PATTERNS) {
    n = n.replace(pattern, ' ');
  }
  n = n.replace(/\s+/g, ' ').trim();
  if (!n) return null;

  for (const [substance, aliases] of Object.entries(SUBSTANCE_ALIASES)) {
    for (const alias of aliases) {
      const aliasNorm = basicNormalize(alias);
      const re = new RegExp(`(^|\\s|\\()${escapeRegExp(aliasNorm)}($|\\s|\\))`);
      if (re.test(n)) return substance;
    }
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function severityRank(severity: 'high' | 'medium' | 'low'): number {
  return severity === 'high' ? 3 : severity === 'medium' ? 2 : 1;
}

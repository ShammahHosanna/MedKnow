import type { Interaction, Medication, Severity } from '@/types/medknow';
import type { ZodLang } from '@/lib/ai/schema';
import { canonicalSubstance, severityRank } from './normalize';
import rulesData from './rules.json';

/**
 * Local cross-check of critical interactions (EF-21, spec § 4).
 * The rule file is NOT exhaustive; it only covers the most dangerous known
 * pairs so an omitted interaction cannot leave the result unnoticed.
 */

interface LocalRule {
  id: string;
  substances: [string, string];
  severity: Severity;
  explanation: { en: string; fr: string; es: string };
  source: string;
}

const RULES = (rulesData as { version: number; rules: Omit<LocalRule, 'substances'>[] & { substances: string[] }[] }).rules as unknown as LocalRule[];

const RULE_INDEX = new Map<string, LocalRule>();
for (const rule of RULES) {
  const [a, b] = rule.substances;
  const key = [a, b].sort().join('|');
  RULE_INDEX.set(key, rule);
}

export interface RuleMatchStats {
  unmatchedMedications: number;
  rulesAdded: number;
  rulesRaised: number;
}

export interface RuleMatchResult {
  interactions: Interaction[];
  /** Rule ids that are now represented in the interactions list. */
  appliedRuleIds: string[];
  duplicateSubstanceNotice: { medA: string; medB: string } | null;
  stats: RuleMatchStats;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/**
 * Cross-checks model interactions against the local rule file:
 * - a rule absent from the model output is added (source = local_rule) ;
 * - a model interaction below the rule severity is raised (source =
 *   model+local_rule) ;
 * - duplicate active substances produce a notice (EF-05 A4).
 */
export function applyLocalRules(
  medications: Medication[],
  modelInteractions: Interaction[],
  lang: ZodLang,
): RuleMatchResult {
  const stats: RuleMatchStats = {
    unmatchedMedications: 0,
    rulesAdded: 0,
    rulesRaised: 0,
  };

  // Resolve each medication to a canonical substance.
  const substanceById = new Map<string, string>();
  for (const med of medications) {
    const canonical = canonicalSubstance(med.nameAsPrinted) ?? canonicalSubstance(med.genericName.value ?? '');
    if (canonical) {
      substanceById.set(med.id, canonical);
    } else {
      stats.unmatchedMedications += 1;
    }
  }

  // Detect duplicate active substances (two entries, same substance).
  let duplicateSubstanceNotice: { medA: string; medB: string } | null = null;
  const seen = new Map<string, string>();
  for (const med of medications) {
    const canonical = substanceById.get(med.id);
    if (!canonical) continue;
    const firstId = seen.get(canonical);
    if (firstId && firstId !== med.id && !duplicateSubstanceNotice) {
      const medA = medications.find((m) => m.id === firstId);
      duplicateSubstanceNotice = { medA: medA?.nameAsPrinted ?? firstId, medB: med.nameAsPrinted };
    } else if (!firstId) {
      seen.set(canonical, med.id);
    }
  }

  // Pairs already covered by the model, keyed by canonical substances.
  const modelPairs = new Map<string, Interaction>();
  for (const interaction of modelInteractions) {
    const substances = interaction.medicationIds
      .map((id) => substanceById.get(id))
      .filter((s): s is string => Boolean(s));
    if (substances.length < 2) continue;
    const key = pairKey(substances[0], substances[1]);
    const existing = modelPairs.get(key);
    if (!existing || severityRank(interaction.severity) > severityRank(existing.severity)) {
      modelPairs.set(key, interaction);
    }
  }

  const result: Interaction[] = [...modelInteractions];
  const appliedRuleIds: string[] = [];

  for (const [key, rule] of RULE_INDEX) {
    const modelInteraction = modelPairs.get(key);
    if (modelInteraction) {
      appliedRuleIds.push(rule.id);
      if (severityRank(modelInteraction.severity) < severityRank(rule.severity)) {
        // Raise severity to the rule level (EF-21 A2).
        modelInteraction.severity = rule.severity;
        modelInteraction.source = 'model+local_rule';
        stats.rulesRaised += 1;
      }
      continue;
    }
    // Rule not represented in the model output → add it (EF-21 step 3).
    const medsForSubstances = rule.substances
      .map((substance) => medications.find((m) => substanceById.get(m.id) === substance))
      .filter((m): m is Medication => Boolean(m));
    if (medsForSubstances.length < 2) continue;

    result.push({
      id: `r${rule.id}`,
      medicationIds: [medsForSubstances[0].id, medsForSubstances[1].id],
      severity: rule.severity,
      explanation: rule.explanation[lang],
      whatToDo:
        lang === 'fr'
          ? 'Demandez conseil à votre pharmacien ou à votre médecin avant la prochaine prise.'
          : lang === 'es'
            ? 'Consulte a su farmacéutico o a su médico antes de la próxima toma.'
            : 'Ask your pharmacist or doctor before the next dose.',
      confidence: 'high',
      source: 'local_rule',
    });
    appliedRuleIds.push(rule.id);
    stats.rulesAdded += 1;
  }

  // Sort by descending severity (CA-06.3), stable otherwise.
  result.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  return { interactions: result, appliedRuleIds, duplicateSubstanceNotice, stats };
}

/** All rule ids — used by tests to verify the reference game is covered. */
export function allRuleIds(): string[] {
  return RULES.map((r) => r.id);
}

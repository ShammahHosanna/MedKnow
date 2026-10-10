import type { Analysis, Field, Lang, Medication } from '@/types/medknow';

/**
 * Pre-calculated demo analyses (EF-17). They are shown when the demo image
 * cannot reach the API (offline, quota, outage). Each contains one high and
 * one medium interaction (CA-17.3) matching the local rules file so the
 * "cross-checked with a safety rule" badge is demonstrated.
 *
 * These files are fictional: warfarin + ibuprofen + lisinopril + paracetamol
 * is a plausible-looking poly-medication built for the demo only.
 */

const UUIDS: Record<Lang, string> = {
  en: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  fr: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
  es: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
};

type FieldInit = { value: string | null; provenance: Field['provenance'] };

const f = (value: string | null, provenance: Field['provenance'] = 'general_knowledge'): FieldInit => ({
  value,
  provenance,
});

interface MedTexts {
  name: string;
  generic: string;
  purpose: string;
  dosage: string;
  timing: string;
  duration: string | null;
  seCommon: string[];
  seSerious: string[];
  warnings: string[];
}

const MEDS: Record<Lang, MedTexts[]> = {
  fr: [
    {
      name: 'WARFARINE 5 mg',
      generic: 'warfarine',
      purpose: 'Est généralement utilisée pour fluidifier le sang et prévenir les caillots.',
      dosage: '5 mg',
      timing: '1 comprimé le soir',
      duration: null,
      seCommon: ['Bleus qui apparaissent facilement'],
      seSerious: ['Saignement inhabituel qui ne s\'arrête pas', 'Selles noires'],
      warnings: ['L\'alcool peut changer l\'effet de ce médicament'],
    },
    {
      name: 'IBUPROFÈNE 400 mg',
      generic: 'ibuprofène',
      purpose: 'Est généralement utilisé pour soulager la douleur et faire baisser la fièvre.',
      dosage: '400 mg',
      timing: '1 comprimé matin et soir, pendant les repas',
      duration: '5 jours',
      seCommon: ['Gêne à l\'estomac'],
      seSerious: ['Selles noires', 'Réaction allergique avec gonflement'],
      warnings: ['Ne pas cumuler avec d\'autres anti-inflammatoires'],
    },
    {
      name: 'LISINOPRIL 10 mg',
      generic: 'lisinopril',
      purpose: 'Est généralement utilisé pour faire baisser la tension artérielle.',
      dosage: '10 mg',
      timing: '1 comprimé le matin',
      duration: null,
      seCommon: ['Toux sèche'],
      seSerious: ['Gonflement du visage ou de la gorge'],
      warnings: ['Boire suffisamment d\'eau en cas de forte chaleur'],
    },
    {
      name: 'PARACÉTAMOL 1 000 mg',
      generic: 'paracétamol',
      purpose: 'Est généralement utilisé pour soulager la douleur et la fièvre.',
      dosage: '1 000 mg',
      timing: '1 comprimé 3 fois par jour si douleur',
      duration: null,
      seCommon: [],
      seSerious: ['Jaunisse', 'Douleur importante du ventre'],
      warnings: ['Ne pas dépasser 3 g par jour', 'Attention aux autres médicaments contenant du paracétamol'],
    },
  ],
  en: [
    {
      name: 'WARFARIN 5 mg',
      generic: 'warfarin',
      purpose: 'Is generally used to thin the blood and help prevent clots.',
      dosage: '5 mg',
      timing: '1 tablet in the evening',
      duration: null,
      seCommon: ['Bruising more easily'],
      seSerious: ['Unusual bleeding that does not stop', 'Black stools'],
      warnings: ['Alcohol can change how this medicine works'],
    },
    {
      name: 'IBUPROFEN 400 mg',
      generic: 'ibuprofen',
      purpose: 'Is generally used to relieve pain and lower fever.',
      dosage: '400 mg',
      timing: '1 tablet morning and evening, during meals',
      duration: '5 days',
      seCommon: ['Stomach discomfort'],
      seSerious: ['Black stools', 'Allergic reaction with swelling'],
      warnings: ['Do not combine with other anti-inflammatory medicines'],
    },
    {
      name: 'LISINOPRIL 10 mg',
      generic: 'lisinopril',
      purpose: 'Is generally used to lower blood pressure.',
      dosage: '10 mg',
      timing: '1 tablet in the morning',
      duration: null,
      seCommon: ['Dry cough'],
      seSerious: ['Swelling of the face or throat'],
      warnings: ['Drink enough water in hot weather'],
    },
    {
      name: 'PARACETAMOL 1,000 mg',
      generic: 'paracetamol',
      purpose: 'Is generally used to relieve pain and fever.',
      dosage: '1,000 mg',
      timing: '1 tablet 3 times a day if pain',
      duration: null,
      seCommon: [],
      seSerious: ['Yellow skin or eyes', 'Severe stomach pain'],
      warnings: ['Do not exceed 3 g per day', 'Watch out for other medicines containing paracetamol'],
    },
  ],
  es: [
    {
      name: 'WARFARINA 5 mg',
      generic: 'warfarina',
      purpose: 'Se usa generalmente para fluidificar la sangre y prevenir coágulos.',
      dosage: '5 mg',
      timing: '1 comprimido por la noche',
      duration: null,
      seCommon: ['Moretones que aparecen con facilidad'],
      seSerious: ['Sangrado inusual que no se detiene', 'Heces negras'],
      warnings: ['El alcohol puede cambiar el efecto de este medicamento'],
    },
    {
      name: 'IBUPROFENO 400 mg',
      generic: 'ibuprofeno',
      purpose: 'Se usa generalmente para aliviar el dolor y bajar la fiebre.',
      dosage: '400 mg',
      timing: '1 comprimido mañana y noche, durante las comidas',
      duration: '5 días',
      seCommon: ['Molestias estomacales'],
      seSerious: ['Heces negras', 'Reacción alérgica con hinchazón'],
      warnings: ['No combinar con otros antiinflamatorios'],
    },
    {
      name: 'LISINOPRIL 10 mg',
      generic: 'lisinopril',
      purpose: 'Se usa generalmente para bajar la tensión arterial.',
      dosage: '10 mg',
      timing: '1 comprimido por la mañana',
      duration: null,
      seCommon: ['Tos seca'],
      seSerious: ['Hinchazón de la cara o de la garganta'],
      warnings: ['Beber suficiente agua cuando hace calor'],
    },
    {
      name: 'PARACETAMOL 1.000 mg',
      generic: 'paracetamol',
      purpose: 'Se usa generalmente para aliviar el dolor y la fiebre.',
      dosage: '1.000 mg',
      timing: '1 comprimido 3 veces al día si dolor',
      duration: null,
      seCommon: [],
      seSerious: ['Piel u ojos amarillos', 'Dolor fuerte de estómago'],
      warnings: ['No superar 3 g al día', 'Cuidado con otros medicamentos que contengan paracetamol'],
    },
  ],
};

const SUMMARIES: Record<Lang, string> = {
  fr:
    'Cette ordonnance contient 4 médicaments. La warfarine fluidifie le sang. ' +
    'L\'ibuprofène soulage la douleur. Le lisinopril fait baisser la tension. ' +
    'Le paracétamol soulage douleur et fièvre. ' +
    'La journée : lisinopril le matin, ibuprofène matin et soir pendant les repas, paracétamol si besoin, warfarine le soir. ' +
    'Point le plus important : ibuprofène et warfarine ensemble augmentent le risque de saignement. ' +
    'Parlez-en à votre pharmacien avant la prochaine prise. Vérifiez toujours avec votre pharmacien ou votre médecin.',
  en:
    'This prescription contains 4 medicines. Warfarin thins the blood. ' +
    'Ibuprofen relieves pain. Lisinopril lowers blood pressure. ' +
    'Paracetamol relieves pain and fever. ' +
    'The day: lisinopril in the morning, ibuprofen morning and evening during meals, paracetamol if needed, warfarin in the evening. ' +
    'The most important point: ibuprofen and warfarin together increase the risk of bleeding. ' +
    'Talk to your pharmacist before the next dose. Always check with your pharmacist or doctor.',
  es:
    'Esta receta contiene 4 medicamentos. La warfarina fluidifica la sangre. ' +
    'El ibuprofeno alivia el dolor. El lisinopril baja la tensión. ' +
    'El paracetamol alivia dolor y fiebre. ' +
    'El día: lisinopril por la mañana, ibuprofeno mañana y noche durante las comidas, paracetamol si hace falta, warfarina por la noche. ' +
    'El punto más importante: ibuprofeno y warfarina juntos aumentan el riesgo de sangrado. ' +
    'Consulte a su farmacéutico antes de la próxima toma. Verifique siempre con su farmacéutico o médico.',
};

const QUESTIONS: Record<Lang, string[]> = {
  fr: [
    'Puis-je prendre ces médicaments ensemble ?',
    'Que faire si j\'oublie une prise ?',
    'Quels signes doivent me faire appeler en urgence ?',
    'Puis-je prendre un antidouleur acheté sans ordonnance ?',
  ],
  en: [
    'Can I take these medicines together?',
    'What should I do if I miss a dose?',
    'Which signs should make me call for urgent help?',
    'Can I take a painkiller bought without a prescription?',
  ],
  es: [
    '¿Puedo tomar estos medicamentos juntos?',
    '¿Qué hago si olvido una toma?',
    '¿Qué señales deben hacerme llamar a emergencias?',
    '¿Puedo tomar un analgésico comprado sin receta?',
  ],
};

const WHAT_TO_DO: Record<Lang, string> = {
  fr: 'Demandez conseil à votre pharmacien ou à votre médecin avant la prochaine prise.',
  en: 'Ask your pharmacist or doctor before the next dose.',
  es: 'Consulte a su farmacéutico o a su médico antes de la próxima toma.',
};

function buildMedications(lang: Lang): Medication[] {
  return MEDS[lang].map((med, index) => ({
    id: `m${index + 1}`,
    nameAsPrinted: med.name,
    genericName: { value: med.generic, provenance: 'general_knowledge' as const },
    purpose: { value: med.purpose, provenance: 'general_knowledge' as const },
    dosage: { value: med.dosage, provenance: 'printed' as const },
    timing: { value: med.timing, provenance: 'printed' as const },
    duration: { value: med.duration, provenance: med.duration ? ('printed' as const) : null },
    sideEffectsCommon: med.seCommon,
    sideEffectsSerious: med.seSerious,
    warnings: med.warnings,
    confidence: 'high' as const,
  }));
}

function buildDemoAnalysis(lang: Lang): Analysis {
  const medications = buildMedications(lang);
  return {
    schemaVersion: 1,
    id: UUIDS[lang],
    createdAt: '2026-10-01T08:00:00.000Z',
    lang,
    isMedicalDocument: true,
    documentType: 'prescription',
    imageQuality: { readable: true, issues: [] },
    medications,
    interactions: [
      {
        id: 'i1',
        medicationIds: ['m1', 'm2'],
        severity: 'high',
        explanation:
          lang === 'fr'
            ? 'La prise simultanée de ces deux médicaments augmente le risque de saignement.'
            : lang === 'es'
              ? 'Tomar estos dos medicamentos juntos aumenta el riesgo de sangrado.'
              : 'Taking these two medicines together increases the risk of bleeding.',
        whatToDo: WHAT_TO_DO[lang],
        confidence: 'high',
        source: 'model+local_rule',
      },
      {
        id: 'i2',
        medicationIds: ['m2', 'm3'],
        severity: 'medium',
        explanation:
          lang === 'fr'
            ? 'L\'anti-inflammatoire peut réduire l\'effet du traitement de la tension et fatiguer les reins.'
            : lang === 'es'
              ? 'El antiinflamatorio puede reducir el efecto del medicamento para la tensión y fatigar los riñones.'
              : 'The anti-inflammatory can reduce the blood-pressure medicine\'s effect and strain the kidneys.',
        whatToDo: WHAT_TO_DO[lang],
        confidence: 'high',
        source: 'local_rule',
      },
    ],
    summaryPlain: SUMMARIES[lang],
    questionsForPharmacist: QUESTIONS[lang],
    highestSeverity: 'high',
    notices: [],
  };
}

/** Pre-calculated demo analyses, keyed by language. */
export const DEMO_ANALYSES: Record<Lang, Analysis> = {
  en: buildDemoAnalysis('en'),
  fr: buildDemoAnalysis('fr'),
  es: buildDemoAnalysis('es'),
};

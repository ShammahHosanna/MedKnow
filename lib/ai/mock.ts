import type { LLMProvider, ProviderConfig, ProviderMode } from './provider';

/**
 * Deterministic mock provider (EXN-60 verification, CI, key-less local dev).
 * Returns a fixture-style analysis without any network call. It deliberately
 * omits the warfarin+ibuprofen interaction so integration tests can verify
 * that the local rules layer (EF-21) adds it back.
 */
export class MockProvider implements LLMProvider {
  readonly name: string;
  readonly model: string;

  constructor(config: ProviderConfig) {
    this.name = config.name;
    this.model = config.model;
  }

  async run(request: ProviderMode): Promise<string> {
    if (request.kind === 'translate') {
      // Echo the structure back: translation correctness is validated by the
      // real provider; the mock only needs to keep the shape valid.
      return request.analysisJson;
    }
    if (request.kind === 'manual') {
      return JSON.stringify(mockManualAnalysis(request.names));
    }
    return JSON.stringify(mockImageAnalysis());
  }
}

function mockImageAnalysis(): object {
  return {
    isMedicalDocument: true,
    documentType: 'prescription',
    imageQuality: { readable: true, issues: [] },
    medications: [
      {
        id: 'm1',
        nameAsPrinted: 'WARFARINE 5 mg',
        genericName: { value: 'warfarin', provenance: 'general_knowledge' },
        purpose: {
          value: 'Is generally used to thin the blood and help prevent clots.',
          provenance: 'general_knowledge',
        },
        dosage: { value: '5 mg', provenance: 'printed' },
        timing: { value: '1 tablet in the evening', provenance: 'printed' },
        duration: { value: null, provenance: null },
        sideEffectsCommon: ['Bruising more easily'],
        sideEffectsSerious: ['Unusual bleeding that does not stop', 'Black stools'],
        warnings: ['Alcohol can change how this medicine works'],
        confidence: 'high',
      },
      {
        id: 'm2',
        nameAsPrinted: 'IBUPROFENE 400 mg',
        genericName: { value: 'ibuprofen', provenance: 'general_knowledge' },
        purpose: {
          value: 'Is generally used to relieve pain and lower fever.',
          provenance: 'general_knowledge',
        },
        dosage: { value: '400 mg', provenance: 'printed' },
        timing: { value: '1 tablet morning and evening, during meals', provenance: 'printed' },
        duration: { value: '5 days', provenance: 'printed' },
        sideEffectsCommon: ['Stomach discomfort'],
        sideEffectsSerious: ['Black stools', 'Allergic reaction with swelling'],
        warnings: ['Do not combine with other anti-inflammatory medicines'],
        confidence: 'high',
      },
    ],
    interactions: [
      {
        id: 'i1',
        medicationIds: ['m1', 'm2'],
        severity: 'high',
        explanation: 'Taking these together can increase the risk of bleeding.',
        whatToDo: 'Ask your pharmacist or doctor before taking them together.',
        confidence: 'high',
        source: 'model',
      },
    ],
    summaryPlain:
      'This prescription lists two medicines. Warfarin is generally used to thin the blood. ' +
      'Ibuprofen is generally used for pain. Take warfarin in the evening and ibuprofen ' +
      'during meals. The most important point: talk to your pharmacist before taking both.',
    questionsForPharmacist: [
      'Can I take these medicines together?',
      'What should I do if I miss a dose?',
      'Which signs should make me call urgently?',
    ],
    notices: [],
  };
}

function mockManualAnalysis(names: string[]): object {
  return {
    isMedicalDocument: true,
    documentType: 'manual_entry',
    imageQuality: { readable: true, issues: [] },
    medications: names.slice(0, 10).map((name, index) => ({
      id: `m${index + 1}`,
      nameAsPrinted: name,
      genericName: { value: null, provenance: null },
      purpose: {
        value: 'Is generally used to treat the condition described by a doctor.',
        provenance: 'general_knowledge',
      },
      dosage: { value: null, provenance: null },
      timing: { value: null, provenance: null },
      duration: { value: null, provenance: null },
      sideEffectsCommon: [],
      sideEffectsSerious: [],
      warnings: [],
      confidence: 'low',
    })),
    interactions: [],
    summaryPlain: `You entered ${names.length} medicine name(s). This is general information only. Ask your pharmacist for advice about each one.`,
    questionsForPharmacist: ['What is this medicine generally used for?'],
    notices: [],
  };
}

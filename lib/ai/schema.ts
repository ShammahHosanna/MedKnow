import { z } from 'zod';

/**
 * Zod schema mirroring types/medknow.ts (spec § 7.1 / § 9.4).
 * The AI provider output is parsed with this schema; anything non-conformant
 * never reaches the UI (BNF-10). Soft constraints (array lengths, summary
 * length) are capped with `catch`/`transform` instead of hard failures where
 * trimming is safe; structural violations cause a retry, then 422.
 */

export const LANGS = ['en', 'fr', 'es'] as const;
export const langSchema = z.enum(LANGS);
export type ZodLang = z.infer<typeof langSchema>;

const provenanceEnum = z.enum(['printed', 'general_knowledge']);
const confidenceEnum = z.enum(['high', 'medium', 'low']);
const severityEnum = z.enum(['high', 'medium', 'low']);
const documentTypeEnum = z.enum([
  'prescription',
  'medication_label',
  'leaflet',
  'other_medical',
  'not_medical',
  'manual_entry',
]);

const imageIssueEnum = z.enum([
  'blurry',
  'dark',
  'glare',
  'cropped',
  'low_resolution',
  'handwriting_unclear',
]);

/**
 * Cap helper that PRESERVES the element type through `transform` — the
 * transform's return type drives `z.infer`, so a `(unknown[]) => unknown[]`
 * signature would collapse every capped array to `unknown[]`.
 */
const cap = <T>(n: number) => (arr: T[]) => arr.slice(0, n);

const fieldSchema = z
  .object({
    value: z.string().max(500).nullable().catch(null),
    provenance: provenanceEnum.nullable().catch(null),
  })
  .catch({ value: null, provenance: null });

export const medicationSchema = z.object({
  id: z.string().min(1).max(20),
  nameAsPrinted: z.string().min(1).max(200),
  genericName: fieldSchema.default({ value: null, provenance: null }),
  purpose: fieldSchema.default({ value: null, provenance: null }),
  dosage: fieldSchema.default({ value: null, provenance: null }),
  timing: fieldSchema.default({ value: null, provenance: null }),
  duration: fieldSchema.default({ value: null, provenance: null }),
  sideEffectsCommon: z
    .array(z.string().max(300))
    .transform(cap(5))
    .catch([])
    .default([]),
  sideEffectsSerious: z
    .array(z.string().max(300))
    .transform(cap(4))
    .catch([])
    .default([]),
  warnings: z.array(z.string().max(300)).transform(cap(4)).catch([]).default([]),
  confidence: confidenceEnum.catch('low').default('low'),
});
export type MedicationInput = z.infer<typeof medicationSchema>;

/**
 * Tuple with a runtime minimum of 2 ids, mirroring
 * `[string, string, ...string[]]` from types/medknow.ts so parsed values are
 * usable as `Interaction` without a cast.
 */
const medicationIdsSchema = z
  .array(z.string().min(1).max(20))
  .min(2)
  .max(4)
  .transform((ids) => ids as [string, string, ...string[]]);

export const interactionSchema = z.object({
  id: z.string().min(1).max(20),
  medicationIds: medicationIdsSchema,
  severity: severityEnum,
  explanation: z.string().min(1).max(1000),
  whatToDo: z.string().min(1).max(600),
  confidence: confidenceEnum.catch('low').default('low'),
  source: z.enum(['model', 'local_rule', 'model+local_rule']).catch('model').default('model'),
});
export type InteractionInput = z.infer<typeof interactionSchema>;

/** Raw model output — server-assigned fields are optional/absent here. */
export const modelAnalysisSchema = z.object({
  isMedicalDocument: z.boolean(),
  documentType: documentTypeEnum.catch('not_medical').default('not_medical'),
  imageQuality: z
    .object({
      readable: z.boolean(),
      issues: z.array(imageIssueEnum).transform(cap(6)).catch([]).default([]),
    })
    .catch({ readable: false, issues: [] })
    .default({ readable: false, issues: [] }),
  medications: z.array(medicationSchema).transform(cap(15)).catch([]).default([]),
  interactions: z.array(interactionSchema).transform(cap(20)).catch([]).default([]),
  summaryPlain: z.string().max(3000).catch('').default(''),
  questionsForPharmacist: z
    .array(z.string().max(300))
    .transform(cap(5))
    .catch([])
    .default([]),
  notices: z.array(z.string().max(300)).transform(cap(6)).catch([]).default([]),
});
export type ModelAnalysis = z.infer<typeof modelAnalysisSchema>;

// ── Structured-output schema (Gemini responseSchema) ────────────────────────
// JSON-schema mirror of modelAnalysisSchema, sent via generationConfig.
// responseSchema so the API constrains the model to the expected shape.

const fieldJsonSchema = {
  type: 'object',
  properties: {
    value: { type: 'string', nullable: true },
    provenance: { type: 'string', enum: ['printed', 'general_knowledge'], nullable: true },
  },
  required: ['value', 'provenance'],
};

export const MODEL_ANALYSIS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    isMedicalDocument: { type: 'boolean' },
    documentType: {
      type: 'string',
      enum: [
        'prescription',
        'medication_label',
        'leaflet',
        'other_medical',
        'not_medical',
        'manual_entry',
      ],
    },
    imageQuality: {
      type: 'object',
      properties: {
        readable: { type: 'boolean' },
        issues: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['blurry', 'dark', 'glare', 'cropped', 'low_resolution', 'handwriting_unclear'],
          },
        },
      },
      required: ['readable', 'issues'],
    },
    medications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          nameAsPrinted: { type: 'string' },
          genericName: fieldJsonSchema,
          purpose: fieldJsonSchema,
          dosage: fieldJsonSchema,
          timing: fieldJsonSchema,
          duration: fieldJsonSchema,
          sideEffectsCommon: { type: 'array', items: { type: 'string' } },
          sideEffectsSerious: { type: 'array', items: { type: 'string' } },
          warnings: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: [
          'id',
          'nameAsPrinted',
          'genericName',
          'purpose',
          'dosage',
          'timing',
          'duration',
          'sideEffectsCommon',
          'sideEffectsSerious',
          'warnings',
          'confidence',
        ],
      },
    },
    interactions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          medicationIds: { type: 'array', items: { type: 'string' } },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          explanation: { type: 'string' },
          whatToDo: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          source: { type: 'string', enum: ['model', 'local_rule', 'model+local_rule'] },
        },
        required: ['id', 'medicationIds', 'severity', 'explanation', 'whatToDo'],
      },
    },
    summaryPlain: { type: 'string' },
    questionsForPharmacist: { type: 'array', items: { type: 'string' } },
    notices: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'isMedicalDocument',
    'imageQuality',
    'medications',
    'interactions',
    'summaryPlain',
    'questionsForPharmacist',
    'notices',
  ],
} as const;

/** Complete Analysis stored client-side (spec § 7.1). */
export const analysisSchema = modelAnalysisSchema.extend({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  createdAt: z.string().min(1),
  lang: langSchema,
  highestSeverity: severityEnum.nullable(),
});
export type ZodAnalysis = z.infer<typeof analysisSchema>;

/** Accepted request bodies for POST /api/analyze (spec § 9.1). */
export const ANALYZE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 1_500_000; // ≤ 1.5 MB decoded

export const analyzeRequestSchema = z.object({
  mode: z.literal('analyze'),
  lang: langSchema,
  image: z.object({
    mimeType: z.enum(ANALYZE_MIME_TYPES),
    data: z.string().min(100),
  }),
});

export const translateRequestSchema = z.object({
  mode: z.literal('translate'),
  lang: langSchema,
  analysis: analysisSchema,
});

export const manualRequestSchema = z.object({
  mode: z.literal('manual'),
  lang: langSchema,
  names: z
    .array(z.string().trim().min(1).max(80))
    .min(1)
    .max(10)
    .transform((names) => Array.from(new Set(names.map((n) => n.replace(/\s+/g, ' '))))),
});

export const apiRequestSchema = z.discriminatedUnion('mode', [
  analyzeRequestSchema,
  translateRequestSchema,
  manualRequestSchema,
]);

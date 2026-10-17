/**
 * Machine Learning Recommendation Internationalization & Translation Helper
 * Governed by TASK-0413 Phase D refinement (Soft Bento Dashboard / Bilingual Parity)
 *
 * Ensures full localization consistency between frontend interface and external
 * ML telemetry predictions (parameters, diagnostic problems, agronomic impacts,
 * recommended farmer actions, and summary assessments).
 *
 * Provides bidirectional lookup (ID <-> EN), semantic code mapping, input
 * normalization, punctuation tolerance, dynamic parameterized summaries,
 * and safe non-intrusive fallback with original text disclosure.
 */

export interface TranslationResult {
  text: string;
  isTranslated: boolean;
  originalText?: string;
}

/**
 * Normalizes an input string by trimming, normalizing Unicode (NFKC),
 * lowercasing, replacing multiple spaces/linebreaks with single space,
 * normalizing spelling variants (e.g. kelembaban -> kelembapan),
 * and stripping outer quotes and trailing punctuation (. , : ; ! ?).
 */
export function normalizeKey(str: string | undefined | null): string {
  if (!str) return '';
  return (
    str
      .trim()
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
      // Normalize Indonesian spelling variants
      .replace(/\bkelembaban\b/g, 'kelembapan')
      // Strip trailing punctuation
      .replace(/[.:;,!?]+$/, '')
  );
}

export interface TranslationPair {
  id: string;
  en: string;
  aliases?: string[];
  unit?: string;
}

export const PARAMETER_ENTRIES: TranslationPair[] = [
  {
    id: 'Kelembapan Tanah',
    en: 'Soil Moisture',
    aliases: ['kelembaban tanah', 'kelembapan tanah', 'moisture', 'soil moisture', 'soil_moisture'],
    unit: '%',
  },
  {
    id: 'Suhu Tanah',
    en: 'Soil Temperature',
    aliases: [
      'suhu tanah',
      'temperature',
      'temp',
      'soil temp',
      'soil temperature',
      'soil_temp',
      'soil_temperature',
    ],
    unit: '°C',
  },
  {
    id: 'EC Tanah',
    en: 'Soil EC',
    aliases: ['ec tanah', 'soil ec', 'soil_ec', 'ec'],
    unit: 'µS/cm',
  },
  {
    id: 'Fosfor (P)',
    en: 'Phosphorus',
    aliases: ['phosphorus', 'fosfor', 'fosfor (p)', 'p', 'soil_phosphorus', 'soil_p'],
    unit: 'mg/kg',
  },
  {
    id: 'Kalium (K)',
    en: 'Potassium',
    aliases: ['potassium', 'kalium', 'kalium (k)', 'k', 'soil_potassium', 'soil_k'],
    unit: 'mg/kg',
  },
  {
    id: 'Nitrogen (N)',
    en: 'Nitrogen',
    aliases: ['nitrogen', 'nitrogen (n)', 'n', 'soil_nitrogen', 'soil_n'],
    unit: 'mg/kg',
  },
  {
    id: 'pH Tanah',
    en: 'Soil pH',
    aliases: ['ph tanah', 'soil ph', 'soil_ph', 'ph'],
    unit: '',
  },
  {
    id: 'EC Air',
    en: 'Water EC',
    aliases: ['ec air', 'water ec', 'water_ec'],
    unit: 'µS/cm',
  },
  {
    id: 'TDS Air',
    en: 'Water TDS',
    aliases: ['tds air', 'water tds', 'water_tds', 'tds'],
    unit: 'ppm',
  },
  {
    id: 'pH Air',
    en: 'Water pH',
    aliases: ['ph air', 'water ph', 'water_ph'],
    unit: '',
  },
];

export const PROBLEM_ENTRIES: TranslationPair[] = [
  // Required screenshot copy
  {
    id: 'Kelembapan tanah rendah',
    en: 'Soil moisture is low',
    aliases: [
      'kelembaban tanah rendah',
      'kelembapan tanah rendah',
      'soil moisture is low',
      'soil moisture low',
      'kelembaban rendah',
      'kelembapan rendah',
    ],
  },
  {
    id: 'TDS air tinggi',
    en: 'Water TDS is high',
    aliases: ['tds air tinggi', 'water tds is high', 'water tds high', 'tds tinggi'],
  },
  // Existing known variants
  {
    id: 'Kelembapan tanah terlalu tinggi',
    en: 'Soil moisture is too high',
    aliases: [
      'kelembaban tanah terlalu tinggi',
      'kelembapan tanah terlalu tinggi',
      'soil moisture is too high',
      'soil_moisture_high',
    ],
  },
  {
    id: 'Kelembapan tanah terlalu rendah',
    en: 'Soil moisture is too low',
    aliases: [
      'kelembaban tanah terlalu rendah',
      'kelembapan tanah terlalu rendah',
      'soil moisture is too low',
      'soil_moisture_low',
    ],
  },
  {
    id: 'Suhu tanah terlalu tinggi',
    en: 'Soil temperature is too high',
    aliases: ['suhu tanah terlalu tinggi', 'soil temperature is too high', 'soil_temp_high'],
  },
  {
    id: 'Suhu tanah terlalu rendah',
    en: 'Soil temperature is too low',
    aliases: ['suhu tanah terlalu rendah', 'soil temperature is too low', 'soil_temp_low'],
  },
  {
    id: 'EC tanah terlalu tinggi',
    en: 'Soil EC is too high',
    aliases: ['ec tanah terlalu tinggi', 'soil ec is too high', 'soil_ec_high'],
  },
  {
    id: 'EC tanah terlalu rendah',
    en: 'Soil EC is too low',
    aliases: ['ec tanah terlalu rendah', 'soil ec is too low', 'soil_ec_low'],
  },
  {
    id: 'Fosfor berlebih',
    en: 'Excessive phosphorus',
    aliases: [
      'phosphorus berlebih',
      'fosfor berlebih',
      'excessive phosphorus',
      'soil_phosphorus_high',
    ],
  },
  {
    id: 'Kandungan fosfor di bawah ambang batas optimal',
    en: 'Phosphorus content is below optimal threshold',
    aliases: [
      'kandungan fosfor di bawah ambang batas optimal',
      'phosphorus content is below optimal threshold',
      'phosphorus rendah',
      'fosfor rendah',
      'low phosphorus',
      'soil_phosphorus_low',
    ],
  },
  {
    id: 'Kalium berlebih',
    en: 'Excessive potassium',
    aliases: [
      'potassium berlebih',
      'kalium berlebih',
      'excessive potassium',
      'soil_potassium_high',
    ],
  },
  {
    id: 'Kalium rendah',
    en: 'Low potassium',
    aliases: ['potassium rendah', 'kalium rendah', 'low potassium', 'soil_potassium_low'],
  },
  {
    id: 'Nitrogen berlebih',
    en: 'Excessive nitrogen',
    aliases: ['nitrogen berlebih', 'excessive nitrogen', 'soil_nitrogen_high'],
  },
  {
    id: 'Nitrogen rendah',
    en: 'Low nitrogen',
    aliases: ['nitrogen rendah', 'low nitrogen', 'soil_nitrogen_low'],
  },
  {
    id: 'pH tanah terlalu asam',
    en: 'Soil pH is too acidic',
    aliases: ['ph tanah terlalu asam', 'soil ph is too acidic', 'soil_ph_acidic'],
  },
  {
    id: 'pH tanah terlalu basa',
    en: 'Soil pH is too alkaline',
    aliases: ['ph tanah terlalu basa', 'soil ph is too alkaline', 'soil_ph_alkaline'],
  },
  {
    id: 'Kandungan garam/nutrisi terlalu tinggi',
    en: 'Salinity/nutrient content is too high',
    aliases: [
      'kandungan garam/nutrisi terlalu tinggi',
      'salinity/nutrient content is too high',
      'salinity nutrient content is too high',
      'soil_salinity_high',
    ],
  },
  {
    id: 'Zat terlarut terlalu tinggi',
    en: 'Dissolved solids are too high',
    aliases: [
      'zat terlarut terlalu tinggi',
      'dissolved solids are too high',
      'water_tds_high',
      'tds air terlalu tinggi',
      'water tds is too high',
    ],
  },
  {
    id: 'EC air terlalu tinggi',
    en: 'Water EC is too high',
    aliases: ['ec air terlalu tinggi', 'water ec is too high', 'water_ec_high'],
  },
  {
    id: 'EC air terlalu rendah',
    en: 'Water EC is too low',
    aliases: ['ec air terlalu rendah', 'water ec is too low', 'water_ec_low'],
  },
  {
    id: 'EC air tinggi',
    en: 'Water EC is high',
    aliases: ['ec air tinggi', 'water ec is high', 'water ec high'],
  },
  {
    id: 'EC air rendah',
    en: 'Water EC is low',
    aliases: ['ec air rendah', 'water ec is low', 'water ec low'],
  },
  {
    id: 'pH air terlalu asam',
    en: 'Water pH is too acidic',
    aliases: ['ph air terlalu asam', 'water ph is too acidic', 'water_ph_acidic'],
  },
  {
    id: 'pH air terlalu basa',
    en: 'Water pH is too alkaline',
    aliases: ['ph air terlalu basa', 'water ph is too alkaline', 'water_ph_alkaline'],
  },
  {
    id: 'pH air tinggi',
    en: 'Water pH is high',
    aliases: ['ph air tinggi', 'ph air terlalu tinggi', 'water ph is high', 'water ph is too high'],
  },
  {
    id: 'pH air rendah',
    en: 'Water pH is low',
    aliases: ['ph air rendah', 'ph air terlalu rendah', 'water ph is low', 'water ph is too low'],
  },
];

export const IMPACT_ENTRIES: TranslationPair[] = [
  // Required screenshot copy
  {
    id: 'Ketersediaan unsur mikro dapat menurun.',
    en: 'Micronutrient availability may decrease.',
    aliases: ['ketersediaan unsur mikro dapat menurun', 'micronutrient availability may decrease'],
  },
  {
    id: 'Tanaman berisiko mengalami kekurangan air.',
    en: 'Plants may experience water stress.',
    aliases: ['tanaman berisiko mengalami kekurangan air', 'plants may experience water stress'],
  },
  {
    id: 'Kandungan nutrisi terlarut kemungkinan kurang.',
    en: 'Dissolved nutrient levels may be insufficient.',
    aliases: [
      'kandungan nutrisi terlarut kemungkinan kurang',
      'dissolved nutrient levels may be insufficient',
    ],
  },
  {
    id: 'Ketersediaan nutrisi tanaman dapat terganggu.',
    en: 'Nutrient availability to plants may be affected.',
    aliases: [
      'ketersediaan nutrisi tanaman dapat terganggu',
      'nutrient availability to plants may be affected',
    ],
  },
  {
    id: 'Ketersediaan beberapa unsur nutrisi dapat menurun.',
    en: 'The availability of some nutrients may decrease.',
    aliases: [
      'ketersediaan beberapa unsur nutrisi dapat menurun',
      'the availability of some nutrients may decrease',
    ],
  },
  {
    id: 'Risiko salinitas dan stres tanaman meningkat.',
    en: 'The risk of salinity and plant stress increases.',
    aliases: [
      'risiko salinitas dan stres tanaman meningkat',
      'the risk of salinity and plant stress increases',
    ],
  },
  {
    id: 'Larutan terlalu pekat dan dapat menyebabkan stres tanaman.',
    en: 'The solution is too concentrated and may stress plants.',
    aliases: [
      'larutan terlalu pekat dan dapat menyebabkan stres tanaman',
      'the solution is too concentrated and may stress plants',
    ],
  },
  {
    id: 'Tanaman dapat mengalami stres akibat panas.',
    en: 'Plants may experience heat stress.',
    aliases: [
      'tanaman dapat mengalami stres akibat panas',
      'tanaman dapat mengalami stres panas',
      'plants may experience heat stress',
    ],
  },
  // Existing known variants
  {
    id: 'Akar berisiko kekurangan oksigen dan mengalami gangguan.',
    en: 'Roots risk oxygen deficiency and impaired growth.',
    aliases: [
      'akar berisiko kekurangan oksigen dan mengalami gangguan',
      'roots risk oxygen deficiency and impaired growth',
    ],
  },
  {
    id: 'Kadar garam tinggi dapat menghambat penyerapan air tanaman.',
    en: 'High salinity can inhibit plant water absorption.',
    aliases: [
      'kadar garam tinggi dapat menghambat penyerapan air tanaman',
      'high salinity can inhibit plant water absorption',
    ],
  },
  {
    id: 'Keseimbangan nutrisi tanaman dapat terganggu.',
    en: 'Plant nutrient balance may be disrupted.',
    aliases: [
      'keseimbangan nutrisi tanaman dapat terganggu',
      'plant nutrient balance may be disrupted',
    ],
  },
  {
    id: 'Pertumbuhan akar dapat terhambat.',
    en: 'Root growth may be inhibited.',
    aliases: ['pertumbuhan akar dapat terhambat', 'root growth may be inhibited'],
  },
  {
    id: 'Dapat menyebabkan tanaman stres.',
    en: 'Can cause plant stress.',
    aliases: ['dapat menyebabkan tanaman stres', 'can cause plant stress'],
  },
  {
    id: 'Risiko akar sulit menyerap air.',
    en: 'Roots may struggle to absorb water.',
    aliases: ['risiko akar sulit menyerap air', 'roots may struggle to absorb water'],
  },
  {
    id: 'Tanaman berisiko dehidrasi dan layu.',
    en: 'Plants risk dehydration and wilting.',
    aliases: ['tanaman berisiko dehidrasi dan layu', 'plants risk dehydration and wilting'],
  },
  {
    id: 'Pertumbuhan tanaman dan penyerapan hara melambat.',
    en: 'Plant growth and nutrient absorption slow down.',
    aliases: [
      'pertumbuhan tanaman dan penyerapan hara melambat',
      'plant growth and nutrient absorption slow down',
    ],
  },
  {
    id: 'Daya tahan tanaman dan kualitas buah dapat menurun.',
    en: 'Plant resilience and fruit quality may decrease.',
    aliases: [
      'daya tahan tanaman dan kualitas buah dapat menurun',
      'plant resilience and fruit quality may decrease',
    ],
  },
  {
    id: 'Pertumbuhan vegetatif berlebihan dan rentan hama.',
    en: 'Excessive vegetative growth and higher pest vulnerability.',
    aliases: [
      'pertumbuhan vegetatif berlebihan dan rentan hama',
      'excessive vegetative growth and higher pest vulnerability',
    ],
  },
  {
    id: 'Daun menguning dan pertumbuhan tanaman terhambat.',
    en: 'Leaves turn yellow and plant growth is stunted.',
    aliases: [
      'daun menguning dan pertumbuhan tanaman terhambat',
      'leaves turn yellow and plant growth is stunted',
    ],
  },
  {
    id: 'Penyerapan unsur hara esensial terhambat dan toksisitas meningkat.',
    en: 'Essential nutrient absorption is inhibited and toxicity increases.',
    aliases: [
      'penyerapan unsur hara esensial terhambat dan toksisitas meningkat',
      'essential nutrient absorption is inhibited and toxicity increases',
    ],
  },
  {
    id: 'Ketersediaan unsur mikro seperti besi dan mangan menurun.',
    en: 'Micronutrient availability like iron and manganese decreases.',
    aliases: [
      'ketersediaan unsur mikro seperti besi dan mangan menurun',
      'micronutrient availability like iron and manganese decreases',
    ],
  },
  {
    id: 'Dapat merusak perakaran dan mengganggu penyerapan nutrisi.',
    en: 'Can damage root system and disrupt nutrient absorption.',
    aliases: [
      'dapat merusak perakaran dan mengganggu penyerapan nutrisi',
      'can damage root system and disrupt nutrient absorption',
    ],
  },
];

export const ACTION_ENTRIES: TranslationPair[] = [
  // Required screenshot copy
  {
    id: 'Tambahkan bahan organik dan evaluasi media tanam.',
    en: 'Add organic matter and assess the growing medium.',
    aliases: [
      'tambahkan bahan organik dan evaluasi media tanam',
      'add organic matter and assess the growing medium',
    ],
  },
  {
    id: 'Lakukan penyiraman secara bertahap.',
    en: 'Water gradually.',
    aliases: ['lakukan penyiraman secara bertahap', 'water gradually'],
  },
  {
    id: 'Evaluasi kebutuhan nutrisi tanaman.',
    en: 'Assess the plants’ nutrient needs.',
    aliases: [
      'evaluasi kebutuhan nutrisi tanaman',
      'assess the plants’ nutrient needs',
      "assess the plants' nutrient needs",
      'assess the plants nutrient needs',
    ],
  },
  {
    id: 'Tambahkan pupuk Nitrogen sesuai kebutuhan.',
    en: 'Apply nitrogen fertilizer as needed.',
    aliases: ['tambahkan pupuk nitrogen sesuai kebutuhan', 'apply nitrogen fertilizer as needed'],
  },
  {
    id: 'Tambahkan pupuk Phosphorus sesuai kebutuhan.',
    en: 'Apply phosphorus fertilizer as needed.',
    aliases: [
      'tambahkan pupuk phosphorus sesuai kebutuhan',
      'tambahkan pupuk fosfor sesuai kebutuhan',
      'apply phosphorus fertilizer as needed',
    ],
  },
  {
    id: 'Tambahkan pupuk Potassium sesuai kebutuhan.',
    en: 'Apply potassium fertilizer as needed.',
    aliases: [
      'tambahkan pupuk potassium sesuai kebutuhan',
      'tambahkan pupuk kalium sesuai kebutuhan',
      'apply potassium fertilizer as needed',
    ],
  },
  {
    id: 'Lakukan penyesuaian pH air.',
    en: 'Adjust the water pH.',
    aliases: ['lakukan penyesuaian ph air', 'adjust the water ph'],
  },
  {
    id: 'Kurangi konsentrasi nutrisi atau lakukan pengenceran.',
    en: 'Reduce the nutrient concentration or dilute the solution.',
    aliases: [
      'kurangi konsentrasi nutrisi atau lakukan pengenceran',
      'reduce the nutrient concentration or dilute the solution',
    ],
  },
  {
    id: 'Lakukan pengenceran menggunakan air bersih.',
    en: 'Dilute with clean water.',
    aliases: ['lakukan pengenceran menggunakan air bersih', 'dilute with clean water'],
  },
  {
    id: 'Jaga kelembapan tanah dan kurangi paparan panas.',
    en: 'Maintain soil moisture and reduce heat exposure.',
    aliases: [
      'jaga kelembaban tanah dan kurangi paparan panas',
      'jaga kelembapan tanah dan kurangi paparan panas',
      'maintain soil moisture and reduce heat exposure',
    ],
  },
  // Existing known variants
  {
    id: 'Kurangi penyiraman dan perbaiki drainase.',
    en: 'Reduce watering and improve drainage.',
    aliases: ['kurangi penyiraman dan perbaiki drainase', 'reduce watering and improve drainage'],
  },
  {
    id: 'Kurangi pupuk dan lakukan pencucian tanah.',
    en: 'Reduce fertilizer and flush the soil.',
    aliases: ['kurangi pupuk dan lakukan pencucian tanah', 'reduce fertilizer and flush the soil'],
  },
  {
    id: 'Kurangi pemberian pupuk Phosphorus.',
    en: 'Reduce Phosphorus fertilizer application.',
    aliases: [
      'kurangi pemberian pupuk phosphorus',
      'kurangi pemberian pupuk fosfor',
      'reduce phosphorus fertilizer application',
    ],
  },
  {
    id: 'Kurangi pemberian pupuk Potassium.',
    en: 'Reduce Potassium fertilizer application.',
    aliases: [
      'kurangi pemberian pupuk potassium',
      'kurangi pemberian pupuk kalium',
      'reduce potassium fertilizer application',
    ],
  },
  {
    id: 'Kurangi pemberian pupuk Nitrogen.',
    en: 'Reduce Nitrogen fertilizer application.',
    aliases: ['kurangi pemberian pupuk nitrogen', 'reduce nitrogen fertilizer application'],
  },
  {
    id: 'Tambahkan pupuk SP-36 10 mg/kg minggu ini',
    en: 'Add 10 mg/kg SP-36 fertilizer this week',
    aliases: [
      'tambahkan pupuk sp-36 10 mg/kg minggu ini',
      'add 10 mg/kg sp-36 fertilizer this week',
    ],
  },
  {
    id: 'Pantau kelembapan tanah',
    en: 'Monitor soil moisture',
    aliases: ['pantau kelembapan tanah', 'pantau kelembaban tanah', 'monitor soil moisture'],
  },
  {
    id: 'Kurangi konsentrasi pupuk nutrisi',
    en: 'Reduce nutrient fertilizer concentration',
    aliases: ['kurangi konsentrasi pupuk nutrisi', 'reduce nutrient fertilizer concentration'],
  },
  {
    id: 'Tambahkan air bersih untuk pengenceran',
    en: 'Add clean water for dilution',
    aliases: ['tambahkan air bersih untuk pengenceran', 'add clean water for dilution'],
  },
  {
    id: 'Tingkatkan frekuensi penyiraman secukupnya.',
    en: 'Increase watering frequency moderately.',
    aliases: [
      'tingkatkan frekuensi penyiraman secukupnya',
      'increase watering frequency moderately',
    ],
  },
  {
    id: 'Tambahkan kapur dolomit untuk menaikkan pH.',
    en: 'Add dolomite lime to raise pH.',
    aliases: ['tambahkan kapur dolomit untuk menaikkan ph', 'add dolomite lime to raise ph'],
  },
  {
    id: 'Tambahkan belerang atau bahan organik untuk menurunkan pH.',
    en: 'Add sulfur or organic matter to lower pH.',
    aliases: [
      'tambahkan belerang atau bahan organik untuk menurunkan ph',
      'add sulfur or organic matter to lower ph',
    ],
  },
  {
    id: 'Pertahankan pola perawatan saat ini.',
    en: 'Maintain current care pattern.',
    aliases: [
      'pertahankan pola perawatan saat ini',
      'pertahankan pola perawatan',
      'maintain current care pattern',
    ],
  },
  {
    id: 'Netralkan pH larutan',
    en: 'Neutralize solution pH',
    aliases: ['netralkan ph larutan', 'neutralize solution ph'],
  },
  {
    id: 'Pertahankan kelembapan',
    en: 'Maintain moisture level',
    aliases: ['pertahankan kelembapan', 'pertahankan kelembaban', 'maintain moisture level'],
  },
];

export const SUMMARY_EXACT_ENTRIES: TranslationPair[] = [
  {
    id: 'Kondisi tanah baik. Pertahankan pola perawatan saat ini.',
    en: 'Soil condition is optimal. Maintain current care pattern.',
    aliases: [
      'kondisi tanah baik. pertahankan pola perawatan saat ini',
      'soil condition is optimal. maintain current care pattern',
    ],
  },
  {
    id: 'Kualitas air optimal. Pertahankan pola perawatan saat ini.',
    en: 'Water quality is optimal. Maintain current care pattern.',
    aliases: [
      'kualitas air optimal. pertahankan pola perawatan saat ini',
      'water quality is optimal. maintain current care pattern',
    ],
  },
  {
    id: 'Nutrisi Fosfor rendah, perlu pemupukan tambahan.',
    en: 'Low phosphorus nutrient, additional fertilization needed.',
    aliases: [
      'nutrisi fosfor rendah, perlu pemupukan tambahan',
      'low phosphorus nutrient, additional fertilization needed',
    ],
  },
  {
    id: 'Ditemukan masalah keasaman air.',
    en: 'Water acidity issue detected.',
    aliases: ['ditemukan masalah keasaman air', 'water acidity issue detected'],
  },
];

// Build bidirectional lookup maps
function buildLookupMap(entries: TranslationPair[]): {
  idMap: Map<string, string>;
  enMap: Map<string, string>;
  unitMap?: Map<string, string>;
} {
  const idMap = new Map<string, string>();
  const enMap = new Map<string, string>();
  const unitMap = new Map<string, string>();

  for (const entry of entries) {
    const keys = [
      normalizeKey(entry.id),
      normalizeKey(entry.en),
      ...(entry.aliases || []).map(normalizeKey),
    ];

    for (const key of keys) {
      if (!key) continue;
      idMap.set(key, entry.id);
      enMap.set(key, entry.en);
      if (entry.unit !== undefined) {
        unitMap.set(key, entry.unit);
      }
    }
  }

  return { idMap, enMap, unitMap };
}

const PARAMETER_LOOKUPS = buildLookupMap(PARAMETER_ENTRIES);
const PROBLEM_LOOKUPS = buildLookupMap(PROBLEM_ENTRIES);
const IMPACT_LOOKUPS = buildLookupMap(IMPACT_ENTRIES);
const ACTION_LOOKUPS = buildLookupMap(ACTION_ENTRIES);
const SUMMARY_EXACT_LOOKUPS = buildLookupMap(SUMMARY_EXACT_ENTRIES);

/**
 * Returns concise localized notice for unknown messages.
 */
export function getUnavailableNotice(locale: string): string {
  return locale === 'en' ? 'Translation unavailable' : 'Terjemahan tidak tersedia';
}

/**
 * Translate parameter name according to active locale with metadata.
 */
export function translateParameterWithMeta(
  param: string | undefined | null,
  locale: string
): TranslationResult {
  if (!param) return { text: '-', isTranslated: true };
  const normKey = normalizeKey(param);
  const isEn = locale === 'en';
  const lookup = isEn ? PARAMETER_LOOKUPS.enMap : PARAMETER_LOOKUPS.idMap;
  const match = lookup.get(normKey);
  if (match) {
    return { text: match, isTranslated: true };
  }
  return {
    text: getUnavailableNotice(locale),
    isTranslated: false,
    originalText: param,
  };
}

export function translateParameter(param: string | undefined | null, locale: string): string {
  const res = translateParameterWithMeta(param, locale);
  return res.isTranslated ? res.text : res.originalText || res.text;
}

/**
 * Return parameter unit if known.
 */
export function getParameterUnit(param: string | undefined | null): string | null {
  if (!param) return null;
  const normKey = normalizeKey(param);
  return PARAMETER_LOOKUPS.unitMap?.get(normKey) ?? null;
}

/**
 * Translate diagnostic problem text according to active locale with metadata.
 */
export function translateProblemWithMeta(
  problem: string | undefined | null,
  locale: string
): TranslationResult {
  if (!problem) return { text: '', isTranslated: true };
  const normKey = normalizeKey(problem);
  const isEn = locale === 'en';
  const lookup = isEn ? PROBLEM_LOOKUPS.enMap : PROBLEM_LOOKUPS.idMap;
  const match = lookup.get(normKey);
  if (match) {
    return { text: match, isTranslated: true };
  }
  return {
    text: getUnavailableNotice(locale),
    isTranslated: false,
    originalText: problem,
  };
}

export function translateProblem(problem: string | undefined | null, locale: string): string {
  const res = translateProblemWithMeta(problem, locale);
  return res.isTranslated ? res.text : res.originalText || res.text;
}

/**
 * Translate agronomic impact text according to active locale with metadata.
 */
export function translateImpactWithMeta(
  impact: string | undefined | null,
  locale: string
): TranslationResult {
  if (!impact) return { text: '', isTranslated: true };
  const normKey = normalizeKey(impact);
  const isEn = locale === 'en';
  const lookup = isEn ? IMPACT_LOOKUPS.enMap : IMPACT_LOOKUPS.idMap;
  const match = lookup.get(normKey);
  if (match) {
    return { text: match, isTranslated: true };
  }
  return {
    text: getUnavailableNotice(locale),
    isTranslated: false,
    originalText: impact,
  };
}

export function translateImpact(impact: string | undefined | null, locale: string): string {
  const res = translateImpactWithMeta(impact, locale);
  return res.isTranslated ? res.text : res.originalText || res.text;
}

/**
 * Translate farmer action item according to active locale with metadata.
 */
export function translateActionWithMeta(
  action: string | undefined | null,
  locale: string
): TranslationResult {
  if (!action) return { text: '', isTranslated: true };
  const normKey = normalizeKey(action);
  const isEn = locale === 'en';
  const lookup = isEn ? ACTION_LOOKUPS.enMap : ACTION_LOOKUPS.idMap;
  const match = lookup.get(normKey);
  if (match) {
    return { text: match, isTranslated: true };
  }
  return {
    text: getUnavailableNotice(locale),
    isTranslated: false,
    originalText: action,
  };
}

export function translateAction(action: string | undefined | null, locale: string): string {
  const res = translateActionWithMeta(action, locale);
  return res.isTranslated ? res.text : res.originalText || res.text;
}

/**
 * Formats individual parameters inside summary parameter list.
 */
export function formatSummaryParameter(
  param: string,
  domain: 'water' | 'soil',
  locale: string
): string {
  const norm = normalizeKey(param);
  const isEn = locale === 'en';

  if (domain === 'water') {
    if (norm.includes('ph')) return isEn ? 'water pH' : 'pH air';
    if (norm.includes('ec')) return isEn ? 'water EC' : 'EC air';
    if (norm.includes('tds')) return isEn ? 'water TDS' : 'TDS air';
  } else {
    if (norm.includes('kelembaban') || norm.includes('kelembapan') || norm.includes('moisture')) {
      return isEn ? 'soil moisture' : 'kelembapan tanah';
    }
    if (norm.includes('suhu') || norm.includes('temp')) {
      return isEn ? 'soil temperature' : 'suhu tanah';
    }
    if (norm.includes('phosphorus') || norm.includes('fosfor') || norm === 'p') {
      return isEn ? 'phosphorus' : 'fosfor';
    }
    if (norm.includes('potassium') || norm.includes('kalium') || norm === 'k') {
      return isEn ? 'potassium' : 'kalium';
    }
    if (norm.includes('nitrogen') || norm === 'n') return isEn ? 'nitrogen' : 'nitrogen';
    if (/\bec\b/i.test(norm) || norm.includes('ec tanah')) return isEn ? 'soil EC' : 'EC tanah';
    if (/\bph\b/i.test(norm) || norm.includes('ph tanah')) return isEn ? 'soil pH' : 'pH tanah';
  }

  const general = translateParameter(param, locale);
  return general;
}

/**
 * Formats a localized list with grammatical joiners (and / dan) and Oxford comma in English.
 */
export function formatLocalizedList(items: string[], locale: string): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  const isEn = locale === 'en';
  const andWord = isEn ? 'and' : 'dan';
  if (items.length === 2) {
    return `${items[0]} ${andWord} ${items[1]}`;
  }
  const allExceptLast = items.slice(0, -1).join(', ');
  const last = items[items.length - 1];
  return isEn ? `${allExceptLast}, and ${last}` : `${allExceptLast}, dan ${last}`;
}

/**
 * Translate summary statement, handling structured patterns and direct matches.
 */
export function translateSummaryWithMeta(
  summary: string | undefined | null,
  locale: string
): TranslationResult {
  if (!summary) return { text: '', isTranslated: true };
  const normKey = normalizeKey(summary);
  const isEn = locale === 'en';

  // 1. Check exact lookup first
  const exactLookup = isEn ? SUMMARY_EXACT_LOOKUPS.enMap : SUMMARY_EXACT_LOOKUPS.idMap;
  const exactMatch = exactLookup.get(normKey);
  if (exactMatch) {
    return { text: exactMatch, isTranslated: true };
  }

  // 2. Pattern: "Ditemukan N parameter water/air/soil/tanah yang membutuhkan perhatian: P1, P2, ..."
  //    or English variants "N water quality parameters need attention: P1, P2, and P3."
  const paramMatchId = summary.match(
    /^(?:Ditemukan\s+)?(\d+)\s+parameter\s+(water(?:\s+quality)?|kualitas\s+air|air|soil|tanah)\s+(?:yang\s+)?(?:membutuhkan|memerlukan)\s+perhatian:\s*(.*)$/i
  );
  const paramMatchEn = summary.match(
    /^(?:Found\s+)?(\d+)\s+(water(?:\s+quality)?|soil)\s+parameters?\s+(?:need|requiring|needing)\s+attention:\s*(.*)$/i
  );

  const matched = paramMatchId || paramMatchEn;
  if (matched) {
    const count = parseInt(matched[1], 10);
    const domainRaw = matched[2].toLowerCase();
    const isSoil = domainRaw.includes('soil') || domainRaw.includes('tanah');
    const domain: 'soil' | 'water' = isSoil ? 'soil' : 'water';

    const paramsStr = matched[3].trim().replace(/[.:;,]+$/, '');
    const rawParams = paramsStr
      .split(/(?:,\s*(?:dan\s+|and\s+)?|\s+(?:dan|and)\s+)/i)
      .map((p) => p.trim())
      .filter(Boolean);

    const localizedParams = rawParams.map((p) => formatSummaryParameter(p, domain, locale));
    const formattedList = formatLocalizedList(localizedParams, locale);

    if (domain === 'water') {
      if (isEn) {
        const noun = count === 1 ? 'parameter needs' : 'parameters need';
        return {
          text: `${count} water quality ${noun} attention: ${formattedList}.`,
          isTranslated: true,
        };
      }
      return {
        text: `${count} parameter kualitas air memerlukan perhatian: ${formattedList}.`,
        isTranslated: true,
      };
    } else {
      if (isEn) {
        const noun = count === 1 ? 'parameter needs' : 'parameters need';
        return {
          text: `${count} soil ${noun} attention: ${formattedList}.`,
          isTranslated: true,
        };
      }
      return {
        text: `${count} parameter tanah memerlukan perhatian: ${formattedList}.`,
        isTranslated: true,
      };
    }
  }

  // 3. Pattern: "Ditemukan N masalah kualitas air." or "Found N water quality issues."
  const waterIssuesMatch = summary.match(
    /^(?:Ditemukan|Found)\s+(\d+)\s+(?:masalah\s+kualitas\s+air|water\s+quality\s+issues?)\.?$/i
  );
  if (waterIssuesMatch) {
    const count = waterIssuesMatch[1];
    if (isEn) {
      const noun = count === '1' ? 'issue' : 'issues';
      return { text: `Found ${count} water quality ${noun}.`, isTranslated: true };
    }
    return { text: `Ditemukan ${count} masalah kualitas air.`, isTranslated: true };
  }

  // 4. Truly unknown message: return notice with disclosure metadata
  return {
    text: getUnavailableNotice(locale),
    isTranslated: false,
    originalText: summary,
  };
}

export function translateSummary(summary: string | undefined | null, locale: string): string {
  const res = translateSummaryWithMeta(summary, locale);
  return res.isTranslated ? res.text : res.originalText || res.text;
}

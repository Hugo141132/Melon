/**
 * Machine Learning Recommendation Internationalization & Translation Helper
 * Governed by TASK-0413 Phase D refinement (Soft Bento Dashboard / Bilingual Parity)
 *
 * Ensures full localization consistency between frontend interface and external
 * ML telemetry predictions (parameters, diagnostic problems, agronomic impacts,
 * recommended farmer actions, and summary assessments).
 */

const PARAMETER_TRANSLATIONS: Record<'en' | 'id', Record<string, string>> = {
  id: {
    'kelembaban tanah': 'Kelembapan Tanah',
    'kelembapan tanah': 'Kelembapan Tanah',
    moisture: 'Kelembapan Tanah',
    'soil moisture': 'Kelembapan Tanah',
    'suhu tanah': 'Suhu Tanah',
    temperature: 'Suhu Tanah',
    temp: 'Suhu Tanah',
    'soil temperature': 'Suhu Tanah',
    'ec tanah': 'EC Tanah',
    'soil ec': 'EC Tanah',
    ec: 'EC Tanah',
    phosphorus: 'Phosphorus',
    fosfor: 'Fosfor',
    'fosfor (p)': 'Fosfor (P)',
    p: 'Fosfor (P)',
    potassium: 'Potassium',
    kalium: 'Kalium',
    'kalium (k)': 'Kalium (K)',
    k: 'Kalium (K)',
    nitrogen: 'Nitrogen',
    'nitrogen (n)': 'Nitrogen (N)',
    n: 'Nitrogen (N)',
    ph: 'pH',
    'ph tanah': 'pH Tanah',
    'soil ph': 'pH Tanah',
    'ec air': 'EC air',
    'water ec': 'EC Air',
    'tds air': 'TDS air',
    'water tds': 'TDS Air',
    tds: 'TDS',
    'ph air': 'pH Air',
    'water ph': 'pH Air',
  },
  en: {
    'kelembaban tanah': 'Soil Moisture',
    'kelembapan tanah': 'Soil Moisture',
    moisture: 'Soil Moisture',
    'soil moisture': 'Soil Moisture',
    'suhu tanah': 'Soil Temperature',
    temperature: 'Soil Temperature',
    temp: 'Soil Temperature',
    'soil temperature': 'Soil Temperature',
    'ec tanah': 'Soil EC',
    'soil ec': 'Soil EC',
    ec: 'Soil EC',
    phosphorus: 'Phosphorus',
    fosfor: 'Phosphorus',
    'fosfor (p)': 'Phosphorus',
    p: 'Phosphorus',
    potassium: 'Potassium',
    kalium: 'Potassium',
    'kalium (k)': 'Potassium',
    k: 'Potassium',
    nitrogen: 'Nitrogen',
    'nitrogen (n)': 'Nitrogen',
    n: 'Nitrogen',
    ph: 'Soil pH',
    'ph tanah': 'Soil pH',
    'soil ph': 'Soil pH',
    'ec air': 'Water EC',
    'water ec': 'Water EC',
    'tds air': 'Water TDS',
    'water tds': 'Water TDS',
    tds: 'Water TDS',
    'ph air': 'Water pH',
    'water ph': 'Water pH',
  },
};

const PARAMETER_UNITS: Record<string, string> = {
  'kelembaban tanah': '%',
  'kelembapan tanah': '%',
  moisture: '%',
  'soil moisture': '%',
  'suhu tanah': '°C',
  temperature: '°C',
  temp: '°C',
  'soil temperature': '°C',
  'ec tanah': 'µS/cm',
  'soil ec': 'µS/cm',
  'ec air': 'µS/cm',
  'water ec': 'µS/cm',
  ec: 'µS/cm',
  'tds air': 'ppm',
  'water tds': 'ppm',
  tds: 'ppm',
  phosphorus: 'mg/kg',
  fosfor: 'mg/kg',
  'fosfor (p)': 'mg/kg',
  p: 'mg/kg',
  potassium: 'mg/kg',
  kalium: 'mg/kg',
  'kalium (k)': 'mg/kg',
  k: 'mg/kg',
  nitrogen: 'mg/kg',
  'nitrogen (n)': 'mg/kg',
  n: 'mg/kg',
};

const PROBLEM_TRANSLATIONS: Record<'en' | 'id', Record<string, string>> = {
  id: {
    'kelembaban tanah terlalu tinggi': 'Kelembapan tanah terlalu tinggi',
    'kelembapan tanah terlalu tinggi': 'Kelembapan tanah terlalu tinggi',
    'kelembaban tanah terlalu rendah': 'Kelembapan tanah terlalu rendah',
    'kelembapan tanah terlalu rendah': 'Kelembapan tanah terlalu rendah',
    'suhu tanah terlalu tinggi': 'Suhu tanah terlalu tinggi',
    'suhu tanah terlalu rendah': 'Suhu tanah terlalu rendah',
    'ec tanah terlalu tinggi': 'EC tanah terlalu tinggi',
    'ec tanah terlalu rendah': 'EC tanah terlalu rendah',
    'phosphorus berlebih': 'Fosfor berlebih',
    'fosfor berlebih': 'Fosfor berlebih',
    'kandungan fosfor di bawah ambang batas optimal':
      'Kandungan fosfor di bawah ambang batas optimal',
    'phosphorus rendah': 'Kandungan fosfor rendah',
    'fosfor rendah': 'Kandungan fosfor rendah',
    'potassium berlebih': 'Kalium berlebih',
    'kalium berlebih': 'Kalium berlebih',
    'potassium rendah': 'Kalium rendah',
    'kalium rendah': 'Kalium rendah',
    'nitrogen berlebih': 'Nitrogen berlebih',
    'nitrogen rendah': 'Nitrogen rendah',
    'ph tanah terlalu asam': 'pH tanah terlalu asam',
    'ph tanah terlalu basa': 'pH tanah terlalu basa',
    'kandungan garam/nutrisi terlalu tinggi': 'Kandungan garam/nutrisi terlalu tinggi',
    'zat terlarut terlalu tinggi': 'Zat terlarut terlalu tinggi',
    'ph air terlalu asam': 'pH air terlalu asam',
    'ph air terlalu basa': 'pH air terlalu basa',
  },
  en: {
    'kelembaban tanah terlalu tinggi': 'Soil moisture is too high',
    'kelembapan tanah terlalu tinggi': 'Soil moisture is too high',
    'kelembaban tanah terlalu rendah': 'Soil moisture is too low',
    'kelembapan tanah terlalu rendah': 'Soil moisture is too low',
    'suhu tanah terlalu tinggi': 'Soil temperature is too high',
    'suhu tanah terlalu rendah': 'Soil temperature is too low',
    'ec tanah terlalu tinggi': 'Soil EC is too high',
    'ec tanah terlalu rendah': 'Soil EC is too low',
    'phosphorus berlebih': 'Excessive phosphorus',
    'fosfor berlebih': 'Excessive phosphorus',
    'kandungan fosfor di bawah ambang batas optimal':
      'Phosphorus content is below optimal threshold',
    'phosphorus rendah': 'Low phosphorus',
    'fosfor rendah': 'Low phosphorus',
    'potassium berlebih': 'Excessive potassium',
    'kalium berlebih': 'Excessive potassium',
    'potassium rendah': 'Low potassium',
    'kalium rendah': 'Low potassium',
    'nitrogen berlebih': 'Excessive nitrogen',
    'nitrogen rendah': 'Low nitrogen',
    'ph tanah terlalu asam': 'Soil pH is too acidic',
    'ph tanah terlalu basa': 'Soil pH is too alkaline',
    'kandungan garam/nutrisi terlalu tinggi': 'Salinity/nutrient content is too high',
    'zat terlarut terlalu tinggi': 'Dissolved solids are too high',
    'ph air terlalu asam': 'Water pH is too acidic',
    'ph air terlalu basa': 'Water pH is too alkaline',
  },
};

const IMPACT_TRANSLATIONS: Record<'en' | 'id', Record<string, string>> = {
  id: {
    'akar berisiko kekurangan oksigen dan mengalami gangguan.':
      'Akar berisiko kekurangan oksigen dan mengalami gangguan.',
    'tanaman dapat mengalami stres panas.': 'Tanaman dapat mengalami stres panas.',
    'kadar garam tinggi dapat menghambat penyerapan air tanaman.':
      'Kadar garam tinggi dapat menghambat penyerapan air tanaman.',
    'keseimbangan nutrisi tanaman dapat terganggu.':
      'Keseimbangan nutrisi tanaman dapat terganggu.',
    'pertumbuhan akar dapat terhambat': 'Pertumbuhan akar dapat terhambat',
    'dapat menyebabkan tanaman stres': 'Dapat menyebabkan tanaman stres',
    'risiko akar sulit menyerap air': 'Risiko akar sulit menyerap air',
    'tanaman berisiko dehidrasi dan layu.': 'Tanaman berisiko dehidrasi dan layu.',
    'pertumbuhan tanaman dan penyerapan hara melambat.':
      'Pertumbuhan tanaman dan penyerapan hara melambat.',
    'daya tahan tanaman dan kualitas buah dapat menurun.':
      'Daya tahan tanaman dan kualitas buah dapat menurun.',
    'pertumbuhan vegetatif berlebihan dan rentan hama.':
      'Pertumbuhan vegetatif berlebihan dan rentan hama.',
    'daun menguning dan pertumbuhan tanaman terhambat.':
      'Daun menguning dan pertumbuhan tanaman terhambat.',
    'penyerapan unsur hara esensial terhambat dan toksisitas meningkat.':
      'Penyerapan unsur hara esensial terhambat dan toksisitas meningkat.',
    'ketersediaan unsur mikro seperti besi dan mangan menurun.':
      'Ketersediaan unsur mikro seperti besi dan mangan menurun.',
    'dapat merusak perakaran dan mengganggu penyerapan nutrisi.':
      'Dapat merusak perakaran dan mengganggu penyerapan nutrisi.',
  },
  en: {
    'akar berisiko kekurangan oksigen dan mengalami gangguan.':
      'Roots risk oxygen deficiency and impaired growth.',
    'tanaman dapat mengalami stres panas.': 'Plants may experience heat stress.',
    'kadar garam tinggi dapat menghambat penyerapan air tanaman.':
      'High salinity can inhibit plant water absorption.',
    'keseimbangan nutrisi tanaman dapat terganggu.': 'Plant nutrient balance may be disrupted.',
    'pertumbuhan akar dapat terhambat': 'Root growth may be inhibited',
    'dapat menyebabkan tanaman stres': 'Can cause plant stress',
    'risiko akar sulit menyerap air': 'Roots may struggle to absorb water',
    'tanaman berisiko dehidrasi dan layu.': 'Plants risk dehydration and wilting.',
    'pertumbuhan tanaman dan penyerapan hara melambat.':
      'Plant growth and nutrient absorption slow down.',
    'daya tahan tanaman dan kualitas buah dapat menurun.':
      'Plant resilience and fruit quality may decrease.',
    'pertumbuhan vegetatif berlebihan dan rentan hama.':
      'Excessive vegetative growth and higher pest vulnerability.',
    'daun menguning dan pertumbuhan tanaman terhambat.':
      'Leaves turn yellow and plant growth is stunted.',
    'penyerapan unsur hara esensial terhambat dan toksisitas meningkat.':
      'Essential nutrient absorption is inhibited and toxicity increases.',
    'ketersediaan unsur mikro seperti besi dan mangan menurun.':
      'Micronutrient availability like iron and manganese decreases.',
    'dapat merusak perakaran dan mengganggu penyerapan nutrisi.':
      'Can damage root system and disrupt nutrient absorption.',
  },
};

const ACTION_TRANSLATIONS: Record<'en' | 'id', Record<string, string>> = {
  id: {
    'kurangi penyiraman dan perbaiki drainase.': 'Kurangi penyiraman dan perbaiki drainase.',
    'jaga kelembaban tanah dan kurangi paparan panas.':
      'Jaga kelembapan tanah dan kurangi paparan panas.',
    'kurangi pupuk dan lakukan pencucian tanah.': 'Kurangi pupuk dan lakukan pencucian tanah.',
    'kurangi pemberian pupuk phosphorus.': 'Kurangi pemberian pupuk Phosphorus.',
    'kurangi pemberian pupuk potassium.': 'Kurangi pemberian pupuk Potassium.',
    'kurangi pemberian pupuk nitrogen.': 'Kurangi pemberian pupuk Nitrogen.',
    'tambahkan pupuk sp-36 10 mg/kg minggu ini': 'Tambahkan pupuk SP-36 10 mg/kg minggu ini',
    'pantau kelembapan tanah': 'Pantau kelembapan tanah',
    'kurangi konsentrasi pupuk nutrisi': 'Kurangi konsentrasi pupuk nutrisi',
    'tambahkan air bersih untuk pengenceran': 'Tambahkan air bersih untuk pengenceran',
    'tingkatkan frekuensi penyiraman secukupnya.': 'Tingkatkan frekuensi penyiraman secukupnya.',
    'tambahkan kapur dolomit untuk menaikkan ph.': 'Tambahkan kapur dolomit untuk menaikkan pH.',
    'tambahkan belerang atau bahan organik untuk menurunkan ph.':
      'Tambahkan belerang atau bahan organik untuk menurunkan pH.',
    'pertahankan pola perawatan saat ini.': 'Pertahankan pola perawatan saat ini.',
    'pertahankan pola perawatan.': 'Pertahankan pola perawatan saat ini.',
    'netralkan ph larutan': 'Netralkan pH larutan',
    'pertahankan kelembapan': 'Pertahankan kelembapan',
  },
  en: {
    'kurangi penyiraman dan perbaiki drainase.': 'Reduce watering and improve drainage.',
    'jaga kelembaban tanah dan kurangi paparan panas.':
      'Maintain soil moisture and reduce heat exposure.',
    'kurangi pupuk dan lakukan pencucian tanah.': 'Reduce fertilizer and flush the soil.',
    'kurangi pemberian pupuk phosphorus.': 'Reduce Phosphorus fertilizer application.',
    'kurangi pemberian pupuk potassium.': 'Reduce Potassium fertilizer application.',
    'kurangi pemberian pupuk nitrogen.': 'Reduce Nitrogen fertilizer application.',
    'tambahkan pupuk sp-36 10 mg/kg minggu ini': 'Add 10 mg/kg SP-36 fertilizer this week',
    'pantau kelembapan tanah': 'Monitor soil moisture',
    'kurangi konsentrasi pupuk nutrisi': 'Reduce nutrient fertilizer concentration',
    'tambahkan air bersih untuk pengenceran': 'Add clean water for dilution',
    'tingkatkan frekuensi penyiraman secukupnya.': 'Increase watering frequency moderately.',
    'tambahkan kapur dolomit untuk menaikkan ph.': 'Add dolomite lime to raise pH.',
    'tambahkan belerang atau bahan organik untuk menurunkan ph.':
      'Add sulfur or organic matter to lower pH.',
    'pertahankan pola perawatan saat ini.': 'Maintain current care pattern.',
    'pertahankan pola perawatan.': 'Maintain current care pattern.',
    'netralkan ph larutan': 'Neutralize solution pH',
    'pertahankan kelembapan': 'Maintain moisture level',
  },
};

const SUMMARY_EXACT_TRANSLATIONS: Record<'en' | 'id', Record<string, string>> = {
  id: {
    'kondisi tanah baik. pertahankan pola perawatan saat ini.':
      'Kondisi tanah baik. Pertahankan pola perawatan saat ini.',
    'kualitas air optimal. pertahankan pola perawatan saat ini.':
      'Kualitas air optimal. Pertahankan pola perawatan saat ini.',
    'nutrisi fosfor rendah, perlu pemupukan tambahan.':
      'Nutrisi Fosfor rendah, perlu pemupukan tambahan.',
    'ditemukan masalah keasaman air.': 'Ditemukan masalah keasaman air.',
  },
  en: {
    'kondisi tanah baik. pertahankan pola perawatan saat ini.':
      'Soil condition is optimal. Maintain current care pattern.',
    'kualitas air optimal. pertahankan pola perawatan saat ini.':
      'Water quality is optimal. Maintain current care pattern.',
    'nutrisi fosfor rendah, perlu pemupukan tambahan.':
      'Low phosphorus nutrient, additional fertilization needed.',
    'ditemukan masalah keasaman air.': 'Water acidity issue detected.',
  },
};

/**
 * Translate parameter name according to active locale.
 */
export function translateParameter(param: string | undefined | null, locale: string): string {
  if (!param) return '-';
  const normKey = param.trim().toLowerCase();
  const targetLocale = locale === 'en' ? 'en' : 'id';
  const table = PARAMETER_TRANSLATIONS[targetLocale];
  return table[normKey] ?? param;
}

/**
 * Return parameter unit if known.
 */
export function getParameterUnit(param: string | undefined | null): string | null {
  if (!param) return null;
  const normKey = param.trim().toLowerCase();
  return PARAMETER_UNITS[normKey] ?? null;
}

/**
 * Translate diagnostic problem text according to active locale.
 */
export function translateProblem(problem: string | undefined | null, locale: string): string {
  if (!problem) return '';
  const normKey = problem.trim().toLowerCase();
  const targetLocale = locale === 'en' ? 'en' : 'id';
  const table = PROBLEM_TRANSLATIONS[targetLocale];
  return table[normKey] ?? problem;
}

/**
 * Translate agronomic impact text according to active locale.
 */
export function translateImpact(impact: string | undefined | null, locale: string): string {
  if (!impact) return '';
  const normKey = impact.trim().toLowerCase();
  const targetLocale = locale === 'en' ? 'en' : 'id';
  const table = IMPACT_TRANSLATIONS[targetLocale];
  return table[normKey] ?? impact;
}

/**
 * Translate farmer action item according to active locale.
 */
export function translateAction(action: string | undefined | null, locale: string): string {
  if (!action) return '';
  const normKey = action.trim().toLowerCase();
  const targetLocale = locale === 'en' ? 'en' : 'id';
  const table = ACTION_TRANSLATIONS[targetLocale];
  return table[normKey] ?? action;
}

/**
 * Translate summary statement, handling structured patterns and direct matches.
 */
export function translateSummary(summary: string | undefined | null, locale: string): string {
  if (!summary) return '';
  const normKey = summary.trim().toLowerCase();
  const targetLocale = locale === 'en' ? 'en' : 'id';

  // Check exact lookup first
  const exact = SUMMARY_EXACT_TRANSLATIONS[targetLocale][normKey];
  if (exact) return exact;

  // Pattern: "Ditemukan N parameter soil/tanah yang membutuhkan perhatian: P1, P2, ..."
  const soilParamsMatch = summary.match(
    /^Ditemukan\s+(\d+)\s+parameter\s+(?:soil|tanah)\s+yang\s+membutuhkan\s+perhatian:\s*(.*)$/i
  );
  if (soilParamsMatch) {
    const count = soilParamsMatch[1];
    const rawParams = soilParamsMatch[2].split(',').map((p) => p.trim());
    const translatedParams = rawParams.map((p) => translateParameter(p, targetLocale)).join(', ');

    if (targetLocale === 'en') {
      const noun = count === '1' ? 'parameter' : 'parameters';
      return `Found ${count} soil ${noun} requiring attention: ${translatedParams}.`;
    }
    return `Ditemukan ${count} parameter tanah yang membutuhkan perhatian: ${translatedParams}.`;
  }

  // Pattern: "Ditemukan N masalah kualitas air."
  const waterIssuesMatch = summary.match(/^Ditemukan\s+(\d+)\s+masalah\s+kualitas\s+air\.?$/i);
  if (waterIssuesMatch) {
    const count = waterIssuesMatch[1];
    if (targetLocale === 'en') {
      const noun = count === '1' ? 'issue' : 'issues';
      return `Found ${count} water quality ${noun}.`;
    }
    return `Ditemukan ${count} masalah kualitas air.`;
  }

  // Pattern: "Ditemukan N parameter air yang membutuhkan perhatian: P1, P2, ..."
  const waterParamsMatch = summary.match(
    /^Ditemukan\s+(\d+)\s+parameter\s+air\s+yang\s+membutuhkan\s+perhatian:\s*(.*)$/i
  );
  if (waterParamsMatch) {
    const count = waterParamsMatch[1];
    const rawParams = waterParamsMatch[2].split(',').map((p) => p.trim());
    const translatedParams = rawParams.map((p) => translateParameter(p, targetLocale)).join(', ');

    if (targetLocale === 'en') {
      const noun = count === '1' ? 'parameter' : 'parameters';
      return `Found ${count} water ${noun} requiring attention: ${translatedParams}.`;
    }
    return `Ditemukan ${count} parameter air yang membutuhkan perhatian: ${translatedParams}.`;
  }

  return summary;
}

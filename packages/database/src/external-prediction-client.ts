import {
  SoilPredictionDto,
  SoilPredictionDtoSchema,
  WaterPredictionDto,
  WaterPredictionDtoSchema,
  OutboundRecommendationPayload,
  OutboundRecommendationPayloadSchema,
  PredictionIssue,
} from '@kebun-melon/contracts';

/**
 * Fallback device aliases mapping Melon device identifiers / MQTT client IDs
 * to external ML database device_id values.
 *
 * ARCHITECTURAL NOTICE:
 * Production callers MUST pass the dynamically resolved externalDeviceId
 * from Melon's `device_external_mappings` table. These hard-coded aliases
 * are strictly a secondary fallback for local development and unit tests.
 */
const DEFAULT_ML_DEVICE_ALIASES: Record<string, string> = {
  'melon-esp32-tanah1': 'melon002',
  'soil-node-jvbkdbv': 'melon002',
  'melon-esp32-air1': 'water001',
  'water-quality-node-quiua': 'water001',
};

export interface ExternalPredictionClientConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
  deviceAliases?: Record<string, string>;
  fetchFn?: typeof fetch;
}

export interface FetchPredictionOptions {
  forceRefresh?: boolean;
}

interface CacheItem<T> {
  data: T | null;
  expiresAt: number;
}

/**
 * ExternalPredictionClient
 * Read-only adapter for consuming ML prediction tables (soil_predictions, water_predictions)
 * from the external ML Supabase project via PostgREST HTTPS API.
 * Reference: TASK-0413, docs/DECISIONS.md DEC-MON-090
 */
export class ExternalPredictionClient {
  private readonly supabaseUrl?: string;
  private readonly supabaseKey?: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly deviceAliases: Record<string, string>;
  private readonly fetchFn: typeof fetch;
  private readonly cache = new Map<string, CacheItem<any>>();

  constructor(config: ExternalPredictionClientConfig = {}) {
    this.supabaseUrl = config.supabaseUrl?.replace(/\/+$/, '');
    this.supabaseKey = config.supabaseKey;
    this.timeoutMs = config.timeoutMs ?? 3000;
    this.cacheTtlMs = config.cacheTtlMs ?? 30000;
    this.deviceAliases = {
      ...DEFAULT_ML_DEVICE_ALIASES,
      ...(config.deviceAliases ?? {}),
    };
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
  }

  /**
   * Check if the external prediction client is configured with required credentials
   */
  public isConfigured(): boolean {
    return Boolean(this.supabaseUrl && this.supabaseKey);
  }

  /**
   * Clear the in-memory TTL cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size metrics
   */
  public getCacheStats(): { size: number } {
    return { size: this.cache.size };
  }

  /**
   * Fetch latest soil prediction for a device
   */
  public async getLatestSoilPrediction(
    deviceId: string,
    options?: FetchPredictionOptions
  ): Promise<SoilPredictionDto | null> {
    const cacheKey = `soil_predictions:${deviceId}`;
    if (!options?.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }
    }

    if (!this.isConfigured()) {
      return null;
    }

    let row = await this.queryLatestPredictionRow('soil_predictions', deviceId);

    // If query by deviceId returns no row, try configured device alias
    if (!row && this.deviceAliases[deviceId]) {
      row = await this.queryLatestPredictionRow('soil_predictions', this.deviceAliases[deviceId]);
    }

    if (!row) {
      this.cache.set(cacheKey, { data: null, expiresAt: Date.now() + this.cacheTtlMs });
      return null;
    }

    try {
      const dto = this.mapSoilPredictionRow(row, deviceId);
      this.cache.set(cacheKey, { data: dto, expiresAt: Date.now() + this.cacheTtlMs });
      return dto;
    } catch {
      this.cache.set(cacheKey, { data: null, expiresAt: Date.now() + this.cacheTtlMs });
      return null;
    }
  }

  /**
   * Fetch latest water quality prediction for a device
   */
  public async getLatestWaterPrediction(
    deviceId: string,
    options?: FetchPredictionOptions
  ): Promise<WaterPredictionDto | null> {
    const cacheKey = `water_predictions:${deviceId}`;
    if (!options?.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }
    }

    if (!this.isConfigured()) {
      return null;
    }

    let row = await this.queryLatestPredictionRow('water_predictions', deviceId);

    // If query by deviceId returns no row, try configured device alias
    if (!row && this.deviceAliases[deviceId]) {
      row = await this.queryLatestPredictionRow('water_predictions', this.deviceAliases[deviceId]);
    }

    if (!row) {
      this.cache.set(cacheKey, { data: null, expiresAt: Date.now() + this.cacheTtlMs });
      return null;
    }

    try {
      const dto = this.mapWaterPredictionRow(row, deviceId);
      this.cache.set(cacheKey, { data: dto, expiresAt: Date.now() + this.cacheTtlMs });
      return dto;
    } catch {
      this.cache.set(cacheKey, { data: null, expiresAt: Date.now() + this.cacheTtlMs });
      return null;
    }
  }

  /**
   * Internal query to PostgREST endpoint with timeout and column fallback handling
   */
  private async queryLatestPredictionRow(
    tableName: 'soil_predictions' | 'water_predictions',
    targetDeviceId: string
  ): Promise<Record<string, any> | null> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      return null;
    }

    const orderCandidates = ['created_at.desc', 'predicted_at.desc', 'timestamp.desc', ''];
    const deviceFilterCandidates = [
      `device_id=eq.${encodeURIComponent(targetDeviceId)}`,
      `deviceId=eq.${encodeURIComponent(targetDeviceId)}`,
      `client_id=eq.${encodeURIComponent(targetDeviceId)}`,
    ];

    for (const filter of deviceFilterCandidates) {
      for (const order of orderCandidates) {
        const queryParams = new URLSearchParams();
        queryParams.set('select', '*');
        queryParams.set('limit', '1');
        if (order) {
          queryParams.set('order', order);
        }

        const url = `${this.supabaseUrl}/rest/v1/${tableName}?${filter}&${queryParams.toString()}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const res = await this.fetchFn(url, {
            method: 'GET',
            headers: {
              apikey: this.supabaseKey,
              Authorization: `Bearer ${this.supabaseKey}`,
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json) && json.length > 0) {
              return json[0];
            }
            return null;
          }

          // If PostgREST responds with 400 Bad Request, inspect if column error to try next candidate
          if (res.status === 400) {
            const errText = await res.text();
            if (errText.includes('does not exist')) {
              continue;
            }
          }

          return null;
        } catch (_err) {
          clearTimeout(timeoutId);
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Defensive field mapping for Soil Prediction records
   */
  public mapSoilPredictionRow(
    row: Record<string, any>,
    fallbackDeviceId: string
  ): SoilPredictionDto {
    const resolvedDeviceId = String(
      row.device_id ?? row.deviceId ?? row.client_id ?? fallbackDeviceId
    );
    const createdAt = String(
      row.created_at ?? row.predicted_at ?? row.timestamp ?? new Date().toISOString()
    );

    // Attempt to parse JSON string in recommendation column (verified external ML format)
    let parsedRec: Record<string, any> | null = null;
    let rawRecommendation: string | null = null;

    if (typeof row.recommendation === 'string') {
      rawRecommendation = row.recommendation;
      try {
        const parsed = JSON.parse(row.recommendation);
        if (parsed && typeof parsed === 'object') {
          parsedRec = parsed;
        }
      } catch {
        parsedRec = null;
      }
    } else if (row.recommendation && typeof row.recommendation === 'object') {
      parsedRec = row.recommendation;
    }

    const predictedClass = String(
      row.classification ??
        parsedRec?.classification ??
        row.predicted_class ??
        row.predictedClass ??
        row.status ??
        row.condition ??
        row.prediction ??
        'UNKNOWN'
    );

    const confidence =
      typeof row.confidence === 'number'
        ? row.confidence
        : typeof row.score === 'number'
          ? row.score
          : typeof row.probability === 'number'
            ? row.probability
            : null;

    // Summary extraction: prefer parsed summary, then direct summary, advice, keterangan, or raw text
    const summary = String(
      parsedRec?.summary ??
        row.summary ??
        row.advice ??
        row.keterangan ??
        row.deskripsi ??
        (typeof row.recommendation === 'string' && !parsedRec ? row.recommendation : '')
    );

    const farmerAction: string[] | null = Array.isArray(parsedRec?.farmer_action)
      ? parsedRec.farmer_action.map(String)
      : null;

    const issues: PredictionIssue[] | null = Array.isArray(parsedRec?.issues)
      ? parsedRec.issues.map((it: any) => ({
          parameter: it.parameter !== undefined ? String(it.parameter) : undefined,
          value: typeof it.value === 'number' ? it.value : null,
          problem: it.problem !== undefined ? String(it.problem) : undefined,
          impact: it.impact !== undefined ? String(it.impact) : undefined,
        }))
      : null;

    // Actions / Recommendations resolution
    let actions: Record<string, unknown> | null = null;
    if (parsedRec) {
      actions = {
        ...parsedRec,
        ...(row.actions && typeof row.actions === 'object' ? row.actions : {}),
      };
    } else if (row.actions && typeof row.actions === 'object') {
      actions = row.actions;
    } else if (row.recommendations && typeof row.recommendations === 'object') {
      actions = row.recommendations;
    } else if (
      row.rec_nitrogen !== undefined ||
      row.rec_phosphorus !== undefined ||
      row.rec_potassium !== undefined ||
      row.rec_n !== undefined ||
      row.rec_p !== undefined ||
      row.rec_k !== undefined
    ) {
      actions = {
        nitrogen: row.rec_nitrogen ?? row.rec_n ?? null,
        phosphorus: row.rec_phosphorus ?? row.rec_p ?? null,
        potassium: row.rec_potassium ?? row.rec_k ?? null,
      };
    }

    // Feature attributes resolution
    const features = {
      n: this.parseNumericOrNull(
        row.n ?? row.nitrogen ?? row.features?.n ?? row.features?.nitrogen
      ),
      p: this.parseNumericOrNull(
        row.p ?? row.phosphorus ?? row.features?.p ?? row.features?.phosphorus
      ),
      k: this.parseNumericOrNull(
        row.k ?? row.potassium ?? row.features?.k ?? row.features?.potassium
      ),
      temp: this.parseNumericOrNull(
        row.temp ?? row.temperature ?? row.features?.temp ?? row.features?.temperature
      ),
      moisture: this.parseNumericOrNull(row.moisture ?? row.kelembapan ?? row.features?.moisture),
      ph: this.parseNumericOrNull(row.ph ?? row.features?.ph),
      ec: this.parseNumericOrNull(row.ec ?? row.features?.ec),
    };

    return SoilPredictionDtoSchema.parse({
      id: row.id !== undefined && row.id !== null ? String(row.id) : null,
      deviceId: resolvedDeviceId,
      readingId:
        row.reading_id !== undefined && row.reading_id !== null
          ? String(row.reading_id)
          : row.readingId !== undefined && row.readingId !== null
            ? String(row.readingId)
            : null,
      predictedClass,
      confidence,
      features,
      actions,
      summary,
      farmerAction,
      issues,
      rawRecommendation,
      modelVersion:
        row.model_version !== undefined && row.model_version !== null
          ? String(row.model_version)
          : row.modelVersion !== undefined && row.modelVersion !== null
            ? String(row.modelVersion)
            : null,
      createdAt,
    });
  }

  /**
   * Defensive field mapping for Water Quality Prediction records
   */
  public mapWaterPredictionRow(
    row: Record<string, any>,
    fallbackDeviceId: string
  ): WaterPredictionDto {
    const resolvedDeviceId = String(
      row.device_id ?? row.deviceId ?? row.client_id ?? fallbackDeviceId
    );
    const createdAt = String(
      row.created_at ?? row.predicted_at ?? row.timestamp ?? new Date().toISOString()
    );

    // Attempt to parse JSON string in recommendation column (verified external ML format)
    let parsedRec: Record<string, any> | null = null;
    let rawRecommendation: string | null = null;

    if (typeof row.recommendation === 'string') {
      rawRecommendation = row.recommendation;
      try {
        const parsed = JSON.parse(row.recommendation);
        if (parsed && typeof parsed === 'object') {
          parsedRec = parsed;
        }
      } catch {
        parsedRec = null;
      }
    } else if (row.recommendation && typeof row.recommendation === 'object') {
      parsedRec = row.recommendation;
    }

    const predictedClass = String(
      row.classification ??
        parsedRec?.classification ??
        row.predicted_class ??
        row.predictedClass ??
        row.status ??
        row.condition ??
        row.prediction ??
        'UNKNOWN'
    );

    const confidence =
      typeof row.confidence === 'number'
        ? row.confidence
        : typeof row.score === 'number'
          ? row.score
          : typeof row.probability === 'number'
            ? row.probability
            : null;

    // Summary extraction: prefer parsed summary, then direct summary, advice, keterangan, or raw text
    const summary = String(
      parsedRec?.summary ??
        row.summary ??
        row.advice ??
        row.keterangan ??
        row.deskripsi ??
        (typeof row.recommendation === 'string' && !parsedRec ? row.recommendation : '')
    );

    const farmerAction: string[] | null = Array.isArray(parsedRec?.farmer_action)
      ? parsedRec.farmer_action.map(String)
      : null;

    const issues: PredictionIssue[] | null = Array.isArray(parsedRec?.issues)
      ? parsedRec.issues.map((it: any) => ({
          parameter: it.parameter !== undefined ? String(it.parameter) : undefined,
          value: typeof it.value === 'number' ? it.value : null,
          problem: it.problem !== undefined ? String(it.problem) : undefined,
          impact: it.impact !== undefined ? String(it.impact) : undefined,
        }))
      : null;

    // Actions / Recommendations resolution
    let actions: Record<string, unknown> | null = null;
    if (parsedRec) {
      actions = {
        ...parsedRec,
        ...(row.actions && typeof row.actions === 'object' ? row.actions : {}),
      };
    } else if (row.actions && typeof row.actions === 'object') {
      actions = row.actions;
    } else if (row.recommendations && typeof row.recommendations === 'object') {
      actions = row.recommendations;
    } else if (row.rec_ph !== undefined || row.rec_tds !== undefined || row.rec_ec !== undefined) {
      actions = {
        ph: row.rec_ph ?? null,
        tds: row.rec_tds ?? null,
        ec: row.rec_ec ?? null,
      };
    }

    // Feature attributes resolution (can also extract from issues if not present directly)
    let featurePh = this.parseNumericOrNull(row.ph ?? row.features?.ph);
    let featureTds = this.parseNumericOrNull(row.tds ?? row.features?.tds);
    let featureEc = this.parseNumericOrNull(row.ec ?? row.features?.ec);

    if (issues) {
      for (const issue of issues) {
        if (!issue.parameter || typeof issue.value !== 'number') continue;
        const pLower = issue.parameter.toLowerCase();
        if (pLower.includes('ph') && featurePh === null) {
          featurePh = issue.value;
        } else if (pLower.includes('tds') && featureTds === null) {
          featureTds = issue.value;
        } else if (pLower.includes('ec') && featureEc === null) {
          featureEc = issue.value;
        }
      }
    }

    const features = {
      ph: featurePh,
      tds: featureTds,
      ec: featureEc,
    };

    return WaterPredictionDtoSchema.parse({
      id: row.id !== undefined && row.id !== null ? String(row.id) : null,
      deviceId: resolvedDeviceId,
      readingId:
        row.reading_id !== undefined && row.reading_id !== null
          ? String(row.reading_id)
          : row.readingId !== undefined && row.readingId !== null
            ? String(row.readingId)
            : null,
      predictedClass,
      confidence,
      features,
      actions,
      summary,
      farmerAction,
      issues,
      rawRecommendation,
      modelVersion:
        row.model_version !== undefined && row.model_version !== null
          ? String(row.model_version)
          : row.modelVersion !== undefined && row.modelVersion !== null
            ? String(row.modelVersion)
            : null,
      createdAt,
    });
  }

  private parseNumericOrNull(val: unknown): number | null {
    if (val === undefined || val === null || val === '') {
      return null;
    }
    const num = Number(val);
    return Number.isFinite(num) ? num : null;
  }
}

/**
 * Helper to build an OutboundRecommendationPayload from prediction DTO
 */
export function buildOutboundRecommendationPayload(params: {
  prediction: SoilPredictionDto | WaterPredictionDto;
  domain: 'SOIL' | 'WATER';
  clientId: string;
  messageId?: string;
  canonicalDeviceId?: string;
}): OutboundRecommendationPayload {
  const { prediction, domain, clientId, messageId, canonicalDeviceId } = params;

  // Derive stable messageId: prefer explicit messageId, else derive deterministically from prediction ID or timestamp
  const fallbackStableSuffix =
    prediction.createdAt && !isNaN(new Date(prediction.createdAt).getTime())
      ? String(new Date(prediction.createdAt).getTime())
      : String(Date.now());
  const stableMessageId =
    messageId ?? `rec-${domain.toLowerCase()}-${prediction.id ?? fallbackStableSuffix}`;

  return OutboundRecommendationPayloadSchema.parse({
    messageId: stableMessageId,
    predictionId: prediction.id ?? null,
    clientId,
    deviceId: canonicalDeviceId ?? prediction.deviceId,
    timestamp: prediction.createdAt,
    domain,
    status: (prediction.actions as any)?.status ?? null,
    predictedClass: prediction.predictedClass,
    confidence: prediction.confidence ?? null,
    actions: prediction.actions ?? null,
    farmerAction: prediction.farmerAction ?? null,
    issues: prediction.issues ?? null,
    summary: prediction.summary ?? '',
    modelVersion: prediction.modelVersion ?? null,
  });
}

/**
 * Factory helper to construct client from environment variables
 */
export function createExternalPredictionClientFromEnv(
  env: Record<string, string | undefined> = process.env
): ExternalPredictionClient {
  const supabaseUrl = env.EXTERNAL_ML_SUPABASE_URL;
  const supabaseKey =
    env.EXTERNAL_ML_SUPABASE_SECRET_KEY || env.EXTERNAL_ML_SUPABASE_PUBLISHABLE_KEY;

  let deviceAliases: Record<string, string> | undefined;
  if (env.EXTERNAL_ML_DEVICE_ALIASES) {
    try {
      deviceAliases = JSON.parse(env.EXTERNAL_ML_DEVICE_ALIASES);
    } catch {
      // Ignore JSON parse error and fallback to default aliases
    }
  }

  return new ExternalPredictionClient({
    supabaseUrl,
    supabaseKey,
    deviceAliases,
  });
}

declare global {
  // eslint-disable-next-line no-var
  var globalPredictionClient: ExternalPredictionClient | undefined;
}

/**
 * Get or initialize the global shared instance of ExternalPredictionClient
 */
export function getExternalPredictionClient(
  env: Record<string, string | undefined> = process.env
): ExternalPredictionClient {
  if (!global.globalPredictionClient) {
    global.globalPredictionClient = createExternalPredictionClientFromEnv(env);
  }
  return global.globalPredictionClient;
}

/**
 * Reset or set the global prediction client instance (useful for unit/integration testing)
 */
export function setGlobalPredictionClient(client?: ExternalPredictionClient): void {
  global.globalPredictionClient = client;
}

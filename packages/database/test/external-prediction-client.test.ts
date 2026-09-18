import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ExternalPredictionClient,
  buildOutboundRecommendationPayload,
  createExternalPredictionClientFromEnv,
  getExternalPredictionClient,
  setGlobalPredictionClient,
} from '../src/external-prediction-client';
import {
  SoilPredictionDtoSchema,
  WaterPredictionDtoSchema,
  OutboundRecommendationPayloadSchema,
} from '@kebun-melon/contracts';

describe('ExternalPredictionClient', () => {
  const mockSupabaseUrl = 'https://styjuynxuykvujnnqxos.supabase.co';
  const mockSupabaseKey = 'mock-external-token-key-12345';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration & Initialization', () => {
    it('reports isConfigured false when credentials are missing', async () => {
      const client = new ExternalPredictionClient();
      expect(client.isConfigured()).toBe(false);

      const result = await client.getLatestSoilPrediction('soil-node-01');
      expect(result).toBeNull();
    });

    it('reports isConfigured true when URL and key are provided', () => {
      const client = new ExternalPredictionClient({
        supabaseUrl: mockSupabaseUrl,
        supabaseKey: mockSupabaseKey,
      });
      expect(client.isConfigured()).toBe(true);
    });

    it('creates client from environment variables correctly', () => {
      const client = createExternalPredictionClientFromEnv({
        EXTERNAL_ML_SUPABASE_URL: mockSupabaseUrl,
        EXTERNAL_ML_SUPABASE_SECRET_KEY: mockSupabaseKey,
      });
      expect(client.isConfigured()).toBe(true);
    });

    it('falls back to publishable key if secret key is absent', () => {
      const client = createExternalPredictionClientFromEnv({
        EXTERNAL_ML_SUPABASE_URL: mockSupabaseUrl,
        EXTERNAL_ML_SUPABASE_PUBLISHABLE_KEY: 'mock-anon-key',
      });
      expect(client.isConfigured()).toBe(true);
    });
  });

  describe('Verified External ML Schema Mapping (Real Production Data)', () => {
    it('correctly parses real soil_predictions row with JSON recommendation string and alias resolution', async () => {
      const realSoilRow = {
        id: '834dff71-72b5-4353-ad12-48acf2acb7b8',
        device_id: 'melon002',
        classification: 'optimal',
        recommendation: JSON.stringify({
          module: 'soil',
          classification: 'optimal',
          summary: 'Kondisi tanah baik. Pertahankan pola perawatan.',
          issues: [],
          farmer_action: [],
        }),
        confidence: 0.905,
        created_at: '2026-09-18T00:33:06.431288+00:00',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [realSoilRow],
      } as Response);

      const client = new ExternalPredictionClient({
        supabaseUrl: mockSupabaseUrl,
        supabaseKey: mockSupabaseKey,
        fetchFn: mockFetch as any,
      });

      // Query using Melon device identifier: melon-esp32-tanah1 -> maps to melon002
      const prediction = await client.getLatestSoilPrediction('melon002');

      expect(prediction).not.toBeNull();
      expect(prediction?.id).toBe('834dff71-72b5-4353-ad12-48acf2acb7b8');
      expect(prediction?.deviceId).toBe('melon002');
      expect(prediction?.predictedClass).toBe('optimal');
      expect(prediction?.confidence).toBe(0.905);
      expect(prediction?.summary).toBe('Kondisi tanah baik. Pertahankan pola perawatan.');
      expect(prediction?.farmerAction).toEqual([]);
      expect(prediction?.issues).toEqual([]);
      expect(prediction?.createdAt).toBe('2026-09-18T00:33:06.431288+00:00');

      expect(SoilPredictionDtoSchema.safeParse(prediction).success).toBe(true);
    });

    it('correctly parses real water_predictions row with detailed issues and farmer_action', async () => {
      const realWaterRow = {
        id: 'e3b7733e-42cc-4d9e-93e2-e4ae42d39475',
        device_id: 'water001',
        classification: 'kritis',
        recommendation: JSON.stringify({
          module: 'water',
          classification: 'kritis',
          summary: 'Ditemukan 2 masalah kualitas air.',
          issues: [
            {
              parameter: 'EC air',
              value: 5.8,
              problem: 'Kandungan garam/nutrisi terlalu tinggi',
              impact: 'Dapat menyebabkan tanaman stres',
            },
            {
              parameter: 'TDS air',
              value: 4900,
              problem: 'Zat terlarut terlalu tinggi',
              impact: 'Risiko akar sulit menyerap air',
            },
          ],
          farmer_action: [
            'Kurangi konsentrasi pupuk nutrisi',
            'Tambahkan air bersih untuk pengenceran',
          ],
        }),
        confidence: 0.895,
        created_at: '2026-09-18T01:43:44.798075+00:00',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [realWaterRow],
      } as Response);

      const client = new ExternalPredictionClient({
        supabaseUrl: mockSupabaseUrl,
        supabaseKey: mockSupabaseKey,
        fetchFn: mockFetch as any,
      });

      const prediction = await client.getLatestWaterPrediction('water001');

      expect(prediction).not.toBeNull();
      expect(prediction?.id).toBe('e3b7733e-42cc-4d9e-93e2-e4ae42d39475');
      expect(prediction?.deviceId).toBe('water001');
      expect(prediction?.predictedClass).toBe('kritis');
      expect(prediction?.confidence).toBe(0.895);
      expect(prediction?.summary).toBe('Ditemukan 2 masalah kualitas air.');
      expect(prediction?.farmerAction).toEqual([
        'Kurangi konsentrasi pupuk nutrisi',
        'Tambahkan air bersih untuk pengenceran',
      ]);
      expect(prediction?.issues).toHaveLength(2);
      expect(prediction?.issues?.[0].parameter).toBe('EC air');
      expect(prediction?.issues?.[0].value).toBe(5.8);
      // Verify feature extraction from issues
      expect(prediction?.features?.ec).toBe(5.8);
      expect(prediction?.features?.tds).toBe(4900);

      expect(WaterPredictionDtoSchema.safeParse(prediction).success).toBe(true);
    });

    it('transparently resolves Melon device IDs to external ML device aliases', async () => {
      const realSoilRow = {
        id: 'pred-alias-1',
        device_id: 'melon002',
        classification: 'optimal',
        recommendation: JSON.stringify({ summary: 'Kondisi baik.' }),
        confidence: 0.9,
        created_at: '2026-09-18T00:00:00.000Z',
      };

      const mockFetch = vi
        .fn()
        // First call with melon-esp32-tanah1 returns []
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        } as Response)
        // Second call with alias melon002 returns real row
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [realSoilRow],
        } as Response);

      const client = new ExternalPredictionClient({
        supabaseUrl: mockSupabaseUrl,
        supabaseKey: mockSupabaseKey,
        fetchFn: mockFetch as any,
      });

      const prediction = await client.getLatestSoilPrediction('melon-esp32-tanah1');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(prediction?.predictedClass).toBe('optimal');
      expect(prediction?.summary).toBe('Kondisi baik.');
    });
  });

  describe('Backward Compatibility with Pre-Structured or Flat Responses', () => {
    it('defensively maps alternate field names and flat recommendation columns', async () => {
      const mockRowWithAliases = {
        id: 1045,
        client_id: 'melon-esp32-tanah1',
        readingId: 'uuid-read-99',
        status: 'DEFICIENT_N',
        score: 0.88,
        nitrogen: 15.0,
        phosphorus: 28.5,
        potassium: 55.0,
        temperature: 27.2,
        kelembapan: 68.4,
        ph: 6.2,
        ec: 1.2,
        rec_nitrogen: 'ADD_UREA',
        rec_phosphorus: 'MAINTAIN',
        rec_potassium: 'MAINTAIN',
        keterangan: 'Kadar nitrogen rendah. Tambahkan pupuk N.',
        modelVersion: 'v2.1',
        predicted_at: '2026-09-18T11:00:00.000Z',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [mockRowWithAliases],
      } as Response);

      const client = new ExternalPredictionClient({
        supabaseUrl: mockSupabaseUrl,
        supabaseKey: mockSupabaseKey,
        fetchFn: mockFetch as any,
      });

      const prediction = await client.getLatestSoilPrediction('melon-esp32-tanah1');

      expect(prediction).not.toBeNull();
      expect(prediction?.id).toBe('1045');
      expect(prediction?.deviceId).toBe('melon-esp32-tanah1');
      expect(prediction?.predictedClass).toBe('DEFICIENT_N');
      expect(prediction?.confidence).toBe(0.88);
      expect(prediction?.features?.n).toBe(15.0);
      expect(prediction?.features?.temp).toBe(27.2);
      expect(prediction?.features?.moisture).toBe(68.4);
      expect(prediction?.actions).toEqual({
        nitrogen: 'ADD_UREA',
        phosphorus: 'MAINTAIN',
        potassium: 'MAINTAIN',
      });
      expect(prediction?.summary).toBe('Kadar nitrogen rendah. Tambahkan pupuk N.');
      expect(prediction?.createdAt).toBe('2026-09-18T11:00:00.000Z');
      expect(prediction?.modelVersion).toBe('v2.1');

      expect(SoilPredictionDtoSchema.safeParse(prediction).success).toBe(true);
    });
  });

  describe('PostgREST Column Fallback Resolution', () => {
    it('retries with next candidate if PostgREST returns 400 indicating column does not exist', async () => {
      const mockFetch = vi
        .fn()
        // First call: order=created_at.desc fails with column does not exist
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => 'column "created_at" does not exist',
        } as Response)
        // Second call: order=predicted_at.desc succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [
            {
              device_id: 'melon002',
              predicted_class: 'NORMAL',
              predicted_at: '2026-09-18T12:00:00.000Z',
              summary: 'Optimal',
            },
          ],
        } as Response);

      const client = new ExternalPredictionClient({
        supabaseUrl: mockSupabaseUrl,
        supabaseKey: mockSupabaseKey,
        fetchFn: mockFetch as any,
      });

      const prediction = await client.getLatestSoilPrediction('melon002');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(prediction?.predictedClass).toBe('NORMAL');
      expect(prediction?.createdAt).toBe('2026-09-18T12:00:00.000Z');
    });
  });

  describe('TTL In-Memory Caching', () => {
    it('returns cached response on second call without repeating HTTP fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            device_id: 'melon002',
            predicted_class: 'OPTIMAL',
            created_at: '2026-09-18T10:00:00.000Z',
          },
        ],
      } as Response);

      const client = new ExternalPredictionClient({
        supabaseUrl: mockSupabaseUrl,
        supabaseKey: mockSupabaseKey,
        cacheTtlMs: 30000,
        fetchFn: mockFetch as any,
      });

      const firstResult = await client.getLatestSoilPrediction('melon002');
      expect(firstResult?.predictedClass).toBe('OPTIMAL');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const secondResult = await client.getLatestSoilPrediction('melon002');
      expect(secondResult?.predictedClass).toBe('OPTIMAL');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('bypasses cache when forceRefresh is true', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            device_id: 'melon002',
            predicted_class: 'OPTIMAL',
            created_at: '2026-09-18T10:00:00.000Z',
          },
        ],
      } as Response);

      const client = new ExternalPredictionClient({
        supabaseUrl: mockSupabaseUrl,
        supabaseKey: mockSupabaseKey,
        cacheTtlMs: 30000,
        fetchFn: mockFetch as any,
      });

      await client.getLatestSoilPrediction('melon002');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      await client.getLatestSoilPrediction('melon002', { forceRefresh: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('clears cache when clearCache() is invoked', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            device_id: 'melon002',
            predicted_class: 'OPTIMAL',
            created_at: '2026-09-18T10:00:00.000Z',
          },
        ],
      } as Response);

      const client = new ExternalPredictionClient({
        supabaseUrl: mockSupabaseUrl,
        supabaseKey: mockSupabaseKey,
        fetchFn: mockFetch as any,
      });

      await client.getLatestSoilPrediction('melon002');
      expect(client.getCacheStats().size).toBe(1);

      client.clearCache();
      expect(client.getCacheStats().size).toBe(0);

      await client.getLatestSoilPrediction('melon002');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Timeout and Error Resilience', () => {
    it('returns null gracefully when HTTP request fails or aborts', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network connection refused'));

      const client = new ExternalPredictionClient({
        supabaseUrl: mockSupabaseUrl,
        supabaseKey: mockSupabaseKey,
        fetchFn: mockFetch as any,
      });

      const result = await client.getLatestSoilPrediction('melon002');
      expect(result).toBeNull();
    });

    it('returns null gracefully when PostgREST returns 404 Not Found', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Table not found',
      } as Response);

      const client = new ExternalPredictionClient({
        supabaseUrl: mockSupabaseUrl,
        supabaseKey: mockSupabaseKey,
        fetchFn: mockFetch as any,
      });

      const result = await client.getLatestSoilPrediction('melon002');
      expect(result).toBeNull();
    });

    it('returns null when PostgREST returns empty array (no predictions yet)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      const client = new ExternalPredictionClient({
        supabaseUrl: mockSupabaseUrl,
        supabaseKey: mockSupabaseKey,
        fetchFn: mockFetch as any,
      });

      const result = await client.getLatestSoilPrediction('melon002');
      expect(result).toBeNull();
    });
  });

  describe('buildOutboundRecommendationPayload', () => {
    it('generates a valid OutboundRecommendationPayload with farmerAction and issues', () => {
      const soilDto = SoilPredictionDtoSchema.parse({
        id: 'pred-1',
        deviceId: 'melon002',
        predictedClass: 'optimal',
        confidence: 0.905,
        features: { n: 50, p: 30, k: 60 },
        actions: { nitrogen: 'MAINTAIN' },
        farmerAction: ['Pertahankan pola perawatan.'],
        issues: [],
        summary: 'Kondisi tanah baik.',
        modelVersion: 'v1.0',
        createdAt: '2026-09-18T10:00:00.000Z',
      });

      const payload = buildOutboundRecommendationPayload({
        prediction: soilDto,
        domain: 'SOIL',
        clientId: 'melon-esp32-tanah1',
        messageId: 'rec-soil-test-01',
      });

      expect(payload.messageId).toBe('rec-soil-test-01');
      expect(payload.predictionId).toBe('pred-1');
      expect(payload.clientId).toBe('melon-esp32-tanah1');
      expect(payload.deviceId).toBe('melon002');
      expect(payload.domain).toBe('SOIL');
      expect(payload.predictedClass).toBe('optimal');
      expect(payload.confidence).toBe(0.905);
      expect(payload.farmerAction).toEqual(['Pertahankan pola perawatan.']);
      expect(payload.summary).toBe('Kondisi tanah baik.');

      expect(OutboundRecommendationPayloadSchema.safeParse(payload).success).toBe(true);
    });

    it('derives stable messageId and predictionId from prediction when messageId is not passed', () => {
      const soilDto = SoilPredictionDtoSchema.parse({
        id: 'pred-soil-uuid-999',
        deviceId: 'melon002',
        predictedClass: 'optimal',
        createdAt: '2026-09-18T10:00:00.000Z',
      });

      const payload1 = buildOutboundRecommendationPayload({
        prediction: soilDto,
        domain: 'SOIL',
        clientId: 'melon-esp32-tanah1',
        canonicalDeviceId: 'soil-node-jvbkdbv',
      });

      const payload2 = buildOutboundRecommendationPayload({
        prediction: soilDto,
        domain: 'SOIL',
        clientId: 'melon-esp32-tanah1',
        canonicalDeviceId: 'soil-node-jvbkdbv',
      });

      // Verify stable predictionId and messageId across calls
      expect(payload1.predictionId).toBe('pred-soil-uuid-999');
      expect(payload1.messageId).toBe('rec-soil-pred-soil-uuid-999');
      expect(payload1.messageId).toBe(payload2.messageId);
      expect(payload1.predictionId).toBe(payload2.predictionId);
      expect(payload1.deviceId).toBe('soil-node-jvbkdbv');
      expect(OutboundRecommendationPayloadSchema.safeParse(payload1).success).toBe(true);
    });
  });

  describe('Dynamic Aliases & Global Singleton Provider', () => {
    it('parses dynamic EXTERNAL_ML_DEVICE_ALIASES from env', () => {
      const customAliases = JSON.stringify({ 'custom-device-1': 'melon999' });
      const client = createExternalPredictionClientFromEnv({
        EXTERNAL_ML_SUPABASE_URL: mockSupabaseUrl,
        EXTERNAL_ML_SUPABASE_SECRET_KEY: mockSupabaseKey,
        EXTERNAL_ML_DEVICE_ALIASES: customAliases,
      });

      expect(client.isConfigured()).toBe(true);
    });

    it('manages global singleton prediction client via getExternalPredictionClient and setGlobalPredictionClient', () => {
      const customClient = new ExternalPredictionClient({
        supabaseUrl: mockSupabaseUrl,
        supabaseKey: mockSupabaseKey,
      });

      setGlobalPredictionClient(customClient);
      expect(getExternalPredictionClient()).toBe(customClient);

      setGlobalPredictionClient(undefined);
    });

    it('returns null fail-safe when row mapping encounters malformed data', async () => {
      // Row with invalid schema values that violate canonical SoilPredictionDtoSchema (empty string violates .min(1))
      const malformedRow = {
        id: 'pred-1',
        classification: '',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [malformedRow],
      } as Response);

      const client = new ExternalPredictionClient({
        supabaseUrl: mockSupabaseUrl,
        supabaseKey: mockSupabaseKey,
        fetchFn: mockFetch as any,
      });

      const result = await client.getLatestSoilPrediction('melon002');
      expect(result).toBeNull();
    });
  });
});

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RecommendationCard from '@/components/monitoring/RecommendationCard';
import type { SoilPredictionDto, WaterPredictionDto } from '@kebun-melon/contracts';

const mockOptimalSoilPrediction: SoilPredictionDto = {
  id: 'pred-soil-001',
  deviceId: 'soil-node-001',
  readingId: null,
  predictedClass: 'optimal',
  confidence: 0.92,
  summary: 'Kondisi tanah baik. Pertahankan pola perawatan saat ini.',
  farmerAction: [],
  issues: [],
  createdAt: '2026-09-18T10:30:00.000Z',
};

const mockWarningSoilPrediction: SoilPredictionDto = {
  id: 'pred-soil-002',
  deviceId: 'soil-node-001',
  readingId: null,
  predictedClass: 'warning',
  confidence: 0.85,
  summary: 'Nutrisi Fosfor rendah, perlu pemupukan tambahan.',
  farmerAction: ['Tambahkan pupuk SP-36 10 mg/kg minggu ini', 'Pantau kelembapan tanah'],
  issues: [
    {
      parameter: 'Fosfor (P)',
      value: 18,
      problem: 'Kandungan fosfor di bawah ambang batas optimal',
      impact: 'Pertumbuhan akar dapat terhambat',
    },
  ],
  createdAt: '2026-09-18T11:00:00.000Z',
};

const mockCriticalWaterPrediction: WaterPredictionDto = {
  id: 'pred-water-001',
  deviceId: 'water-quality-node-001',
  readingId: null,
  predictedClass: 'kritis',
  confidence: 0.895,
  summary: 'Ditemukan 2 masalah kualitas air.',
  farmerAction: ['Kurangi konsentrasi pupuk nutrisi', 'Tambahkan air bersih untuk pengenceran'],
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
  createdAt: '2026-09-18T11:15:00.000Z',
};

const mockCriticalMultiSoilPrediction: SoilPredictionDto = {
  id: 'pred-soil-003',
  deviceId: 'soil-node-001',
  readingId: null,
  predictedClass: 'Critical',
  confidence: 0.96,
  summary:
    'Ditemukan 5 parameter soil yang membutuhkan perhatian: Kelembaban Tanah, Suhu Tanah, EC Tanah, Phosphorus, Potassium.',
  farmerAction: [
    'Kurangi penyiraman dan perbaiki drainase.',
    'Jaga kelembaban tanah dan kurangi paparan panas.',
    'Kurangi pupuk dan lakukan pencucian tanah.',
    'Kurangi pemberian pupuk Phosphorus.',
    'Kurangi pemberian pupuk Potassium.',
  ],
  issues: [
    {
      parameter: 'Kelembaban Tanah',
      value: 94.3,
      problem: 'Kelembaban tanah terlalu tinggi',
      impact: 'Akar berisiko kekurangan oksigen dan mengalami gangguan.',
    },
    {
      parameter: 'Suhu Tanah',
      value: 31.8,
      problem: 'Suhu tanah terlalu tinggi',
      impact: 'Tanaman dapat mengalami stres panas.',
    },
    {
      parameter: 'EC Tanah',
      value: 3101,
      problem: 'EC tanah terlalu tinggi',
      impact: 'Kadar garam tinggi dapat menghambat penyerapan air tanaman.',
    },
    {
      parameter: 'Phosphorus',
      value: 217,
      problem: 'Phosphorus berlebih',
      impact: 'Keseimbangan nutrisi tanaman dapat terganggu.',
    },
    {
      parameter: 'Potassium',
      value: 496,
      problem: 'Potassium berlebih',
      impact: 'Keseimbangan nutrisi tanaman dapat terganggu.',
    },
  ],
  createdAt: '2026-09-18T15:18:32.000Z',
};

describe('TASK-0413 Phase D — RecommendationCard Component Unit Tests', () => {
  it('1. renders loading skeleton with aria-busy="true" during data fetch', () => {
    render(<RecommendationCard domain="soil" prediction={null} isLoading={true} />);

    const skeleton = screen.getByTestId('recommendation-card-loading');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('recommendation-card')).not.toBeInTheDocument();
  });

  it('2. renders clean empty/unavailable state when prediction is null', () => {
    render(<RecommendationCard domain="soil" prediction={null} isLoading={false} />);

    expect(screen.getByTestId('recommendation-card-empty')).toBeInTheDocument();
    expect(screen.getByText('Rekomendasi Pemupukan & Tanah')).toBeInTheDocument();
    expect(screen.getByText('Belum Ada Rekomendasi')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Rekomendasi akan dibuat otomatis setelah telemetri dianalisis model prediksi.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Rekomendasi bersifat saran agronomi dan tidak mengontrol pompa air secara otomatis.'
      )
    ).toBeInTheDocument();
  });

  it('3. renders populated optimal state with badge, confidence, summary, and reassurance', () => {
    render(
      <RecommendationCard domain="soil" prediction={mockOptimalSoilPrediction} isLoading={false} />
    );

    expect(screen.getByTestId('recommendation-card')).toBeInTheDocument();
    expect(screen.getByText('Rekomendasi Pemupukan & Tanah')).toBeInTheDocument();

    const badge = screen.getByTestId('classification-badge-optimal');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Optimal');

    expect(screen.getByTestId('recommendation-confidence')).toHaveTextContent('Keyakinan 92%');
    expect(screen.getByTestId('recommendation-summary')).toHaveTextContent(
      'Kondisi tanah baik. Pertahankan pola perawatan saat ini.'
    );
    expect(screen.getByTestId('recommendation-optimal-desc')).toHaveTextContent(
      'Semua parameter dalam batas ideal. Pertahankan pola perawatan saat ini.'
    );

    // Advisory disclaimer preserved
    expect(screen.getByTestId('recommendation-disclaimer')).toHaveTextContent(
      'Rekomendasi bersifat saran agronomi dan tidak mengontrol pompa air secara otomatis.'
    );
    expect(screen.getByTestId('recommendation-timestamp')).toBeInTheDocument();
  });

  it('4. renders populated warning state with issues and farmer action checklist', () => {
    render(
      <RecommendationCard domain="soil" prediction={mockWarningSoilPrediction} isLoading={false} />
    );

    const badge = screen.getByTestId('classification-badge-warning');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Peringatan');

    expect(screen.getByTestId('recommendation-summary')).toHaveTextContent(
      'Nutrisi Fosfor rendah, perlu pemupukan tambahan.'
    );

    // Issues
    expect(screen.getByText('Masalah Terdeteksi')).toBeInTheDocument();
    expect(screen.getByTestId('recommendation-issue-0')).toBeInTheDocument();
    expect(screen.getByText('Fosfor (P)')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('Kandungan fosfor di bawah ambang batas optimal')).toBeInTheDocument();
    expect(screen.getByText('Dampak: Pertumbuhan akar dapat terhambat')).toBeInTheDocument();

    // Farmer actions
    expect(screen.getByText('Tindakan yang Disarankan')).toBeInTheDocument();
    expect(screen.getByTestId('recommendation-action-0')).toHaveTextContent(
      'Tambahkan pupuk SP-36 10 mg/kg minggu ini'
    );
    expect(screen.getByTestId('recommendation-action-1')).toHaveTextContent(
      'Pantau kelembapan tanah'
    );
  });

  it('5. renders populated critical state for water domain with multiple issues and actions', () => {
    render(
      <RecommendationCard
        domain="water"
        prediction={mockCriticalWaterPrediction}
        isLoading={false}
      />
    );

    expect(screen.getByText('Rekomendasi Kualitas Air')).toBeInTheDocument();
    const badge = screen.getByTestId('classification-badge-critical');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Kritis');

    expect(screen.getByTestId('recommendation-confidence')).toHaveTextContent('Keyakinan 90%');
    expect(screen.getByTestId('recommendation-summary')).toHaveTextContent(
      'Ditemukan 2 masalah kualitas air.'
    );

    expect(screen.getByTestId('recommendation-issue-0')).toHaveTextContent('EC air');
    expect(screen.getByTestId('recommendation-issue-0')).toHaveTextContent('5.8');
    expect(screen.getByTestId('recommendation-issue-1')).toHaveTextContent('TDS air');
    expect(screen.getByTestId('recommendation-issue-1')).toHaveTextContent('4900');

    expect(screen.getByTestId('recommendation-action-0')).toHaveTextContent(
      'Kurangi konsentrasi pupuk nutrisi'
    );
    expect(screen.getByTestId('recommendation-action-1')).toHaveTextContent(
      'Tambahkan air bersih untuk pengenceran'
    );
  });

  it('6. displays stale notice banner when telemetry is stale', () => {
    render(
      <RecommendationCard
        domain="soil"
        prediction={mockWarningSoilPrediction}
        isLoading={false}
        isStale={true}
      />
    );

    const notice = screen.getByTestId('recommendation-stale-notice');
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent(
      'Data telemetri kedaluwarsa — rekomendasi berdasarkan data sebelumnya.'
    );
  });

  it('7. displays offline notice banner when device is offline', () => {
    render(
      <RecommendationCard
        domain="water"
        prediction={mockCriticalWaterPrediction}
        isLoading={false}
        isOffline={true}
      />
    );

    const notice = screen.getByTestId('recommendation-stale-notice');
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent('Perangkat offline — rekomendasi mencerminkan data terakhir.');
  });

  it('8. renders complete localized English recommendation card with Soft Bento Dashboard layout and zero mixed-language text', () => {
    // Switch test cookie to English
    document.cookie = 'locale=en';

    try {
      render(
        <RecommendationCard
          domain="soil"
          prediction={mockCriticalMultiSoilPrediction}
          isLoading={false}
        />
      );

      // Card Title & Micro-badge in English
      expect(screen.getByText('Soil & Fertilization Recommendation')).toBeInTheDocument();
      expect(screen.getByText('Agronomic AI Intelligence')).toBeInTheDocument();

      // Confidence & Critical Severity Pill
      expect(screen.getByTestId('recommendation-confidence')).toHaveTextContent('Confidence 96%');
      const badge = screen.getByTestId('classification-badge-critical');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('Critical');

      // AI Summary localized without "parameter soil"
      expect(screen.getByTestId('recommendation-summary')).toHaveTextContent(
        'Found 5 soil parameters requiring attention: Soil Moisture, Soil Temperature, Soil EC, Phosphorus, Potassium.'
      );

      // Detected issues in English
      expect(screen.getByText('Detected Issues')).toBeInTheDocument();
      expect(screen.getByText('5 Issues')).toBeInTheDocument();

      // Parameter names translated
      expect(screen.getByText('Soil Moisture')).toBeInTheDocument();
      expect(screen.getByText('94.3')).toBeInTheDocument();
      expect(screen.getByText('Soil moisture is too high')).toBeInTheDocument();
      expect(
        screen.getByText('Impact: Roots risk oxygen deficiency and impaired growth.')
      ).toBeInTheDocument();

      expect(screen.getByText('Soil Temperature')).toBeInTheDocument();
      expect(screen.getByText('31.8')).toBeInTheDocument();
      expect(screen.getByText('Soil temperature is too high')).toBeInTheDocument();

      expect(screen.getByText('Soil EC')).toBeInTheDocument();
      expect(screen.getByText('3101')).toBeInTheDocument();

      // Suggested actions in English
      expect(screen.getByText('Suggested Actions')).toBeInTheDocument();
      expect(screen.getByText('5 Steps')).toBeInTheDocument();
      expect(screen.getByTestId('recommendation-action-0')).toHaveTextContent(
        'Reduce watering and improve drainage.'
      );
      expect(screen.getByTestId('recommendation-action-1')).toHaveTextContent(
        'Maintain soil moisture and reduce heat exposure.'
      );
      expect(screen.getByTestId('recommendation-action-2')).toHaveTextContent(
        'Reduce fertilizer and flush the soil.'
      );
      expect(screen.getByTestId('recommendation-action-3')).toHaveTextContent(
        'Reduce Phosphorus fertilizer application.'
      );
      expect(screen.getByTestId('recommendation-action-4')).toHaveTextContent(
        'Reduce Potassium fertilizer application.'
      );

      // Disclaimer
      expect(screen.getByTestId('recommendation-disclaimer')).toHaveTextContent(
        'Recommendations are agronomic advice and do not automatically control water pumps.'
      );
    } finally {
      // Reset test cookie back to Indonesian default
      document.cookie = 'locale=id';
    }
  });

  it('9. renders clean Indonesian recommendation card resolving mixed "parameter soil" text', () => {
    document.cookie = 'locale=id';

    render(
      <RecommendationCard
        domain="soil"
        prediction={mockCriticalMultiSoilPrediction}
        isLoading={false}
      />
    );

    // Card Title & Micro-badge in Indonesian
    expect(screen.getByText('Rekomendasi Pemupukan & Tanah')).toBeInTheDocument();
    expect(screen.getByText('Kecerdasan AI Agronomi')).toBeInTheDocument();

    // Confidence & Critical Severity Pill
    expect(screen.getByTestId('recommendation-confidence')).toHaveTextContent('Keyakinan 96%');
    const badge = screen.getByTestId('classification-badge-critical');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Kritis');

    // AI Summary localized cleanly to "parameter tanah"
    expect(screen.getByTestId('recommendation-summary')).toHaveTextContent(
      'Ditemukan 5 parameter tanah yang membutuhkan perhatian: Kelembapan Tanah, Suhu Tanah, EC Tanah, Phosphorus, Potassium.'
    );

    // Section headers & count badges
    expect(screen.getByText('Masalah Terdeteksi')).toBeInTheDocument();
    expect(screen.getByText('5 Masalah')).toBeInTheDocument();
    expect(screen.getByText('Tindakan yang Disarankan')).toBeInTheDocument();
    expect(screen.getByText('5 Langkah')).toBeInTheDocument();

    // Impact label rendered in Indonesian
    expect(
      screen.getByText('Dampak: Akar berisiko kekurangan oksigen dan mengalami gangguan.')
    ).toBeInTheDocument();
  });
});

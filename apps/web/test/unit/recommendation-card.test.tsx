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
});

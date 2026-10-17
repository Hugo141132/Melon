import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RecommendationCard from '@/components/monitoring/RecommendationCard';
import {
  translateProblemWithMeta,
  translateImpactWithMeta,
  translateActionWithMeta,
  translateSummaryWithMeta,
  translateProblem,
  translateImpact,
  translateAction,
} from '@/lib/recommendation-i18n';
import type { LatestPredictionData } from '@/hooks/useLatestPrediction';

describe('TASK-0413 Recommendation Localization Regression Suite', () => {
  describe('1. Exact Screenshot Issues Translation Coverage', () => {
    const cases = [
      {
        source: 'Kelembaban tanah rendah',
        expectedEn: 'Soil moisture is low',
        expectedId: 'Kelembapan tanah rendah',
      },
      {
        source: 'Kelembapan tanah rendah',
        expectedEn: 'Soil moisture is low',
        expectedId: 'Kelembapan tanah rendah',
      },
      {
        source: 'TDS air tinggi',
        expectedEn: 'Water TDS is high',
        expectedId: 'TDS air tinggi',
      },
    ];

    cases.forEach(({ source, expectedEn, expectedId }) => {
      it(`translates issue "${source}" to EN without fallback markers`, () => {
        const enRes = translateProblemWithMeta(source, 'en');
        expect(enRes.isTranslated).toBe(true);
        expect(enRes.text).toBe(expectedEn);
        expect(enRes.text).not.toContain('[Translation unavailable]');
        expect(enRes.text).not.toContain('Source:');

        const idRes = translateProblemWithMeta(source, 'id');
        expect(idRes.isTranslated).toBe(true);
        expect(idRes.text).toBe(expectedId);
      });
    });
  });

  describe('2. Exact Screenshot Impacts Translation Coverage', () => {
    const cases = [
      {
        source: 'Ketersediaan unsur mikro dapat menurun.',
        expectedEn: 'Micronutrient availability may decrease.',
        expectedId: 'Ketersediaan unsur mikro dapat menurun.',
      },
      {
        source: 'Tanaman berisiko mengalami kekurangan air.',
        expectedEn: 'Plants may experience water stress.',
        expectedId: 'Tanaman berisiko mengalami kekurangan air.',
      },
      {
        source: 'Kandungan nutrisi terlarut kemungkinan kurang.',
        expectedEn: 'Dissolved nutrient levels may be insufficient.',
        expectedId: 'Kandungan nutrisi terlarut kemungkinan kurang.',
      },
      {
        source: 'Ketersediaan nutrisi tanaman dapat terganggu.',
        expectedEn: 'Nutrient availability to plants may be affected.',
        expectedId: 'Ketersediaan nutrisi tanaman dapat terganggu.',
      },
      {
        source: 'Ketersediaan beberapa unsur nutrisi dapat menurun.',
        expectedEn: 'The availability of some nutrients may decrease.',
        expectedId: 'Ketersediaan beberapa unsur nutrisi dapat menurun.',
      },
      {
        source: 'Risiko salinitas dan stres tanaman meningkat.',
        expectedEn: 'The risk of salinity and plant stress increases.',
        expectedId: 'Risiko salinitas dan stres tanaman meningkat.',
      },
      {
        source: 'Larutan terlalu pekat dan dapat menyebabkan stres tanaman.',
        expectedEn: 'The solution is too concentrated and may stress plants.',
        expectedId: 'Larutan terlalu pekat dan dapat menyebabkan stres tanaman.',
      },
    ];

    cases.forEach(({ source, expectedEn, expectedId }) => {
      it(`translates impact "${source}" cleanly to EN and ID`, () => {
        const enRes = translateImpactWithMeta(source, 'en');
        expect(enRes.isTranslated).toBe(true);
        expect(enRes.text).toBe(expectedEn);
        expect(enRes.text).not.toContain('[Translation unavailable]');

        const idRes = translateImpactWithMeta(source, 'id');
        expect(idRes.isTranslated).toBe(true);
        expect(idRes.text).toBe(expectedId);
      });
    });
  });

  describe('3. Exact Screenshot Actions Translation Coverage', () => {
    const cases = [
      {
        source: 'Tambahkan bahan organik dan evaluasi media tanam.',
        expectedEn: 'Add organic matter and assess the growing medium.',
        expectedId: 'Tambahkan bahan organik dan evaluasi media tanam.',
      },
      {
        source: 'Lakukan penyiraman secara bertahap.',
        expectedEn: 'Water gradually.',
        expectedId: 'Lakukan penyiraman secara bertahap.',
      },
      {
        source: 'Evaluasi kebutuhan nutrisi tanaman.',
        expectedEn: 'Assess the plants’ nutrient needs.',
        expectedId: 'Evaluasi kebutuhan nutrisi tanaman.',
      },
      {
        source: 'Tambahkan pupuk Nitrogen sesuai kebutuhan.',
        expectedEn: 'Apply nitrogen fertilizer as needed.',
        expectedId: 'Tambahkan pupuk Nitrogen sesuai kebutuhan.',
      },
      {
        source: 'Tambahkan pupuk Phosphorus sesuai kebutuhan.',
        expectedEn: 'Apply phosphorus fertilizer as needed.',
        expectedId: 'Tambahkan pupuk Phosphorus sesuai kebutuhan.',
      },
      {
        source: 'Tambahkan pupuk Potassium sesuai kebutuhan.',
        expectedEn: 'Apply potassium fertilizer as needed.',
        expectedId: 'Tambahkan pupuk Potassium sesuai kebutuhan.',
      },
      {
        source: 'Lakukan penyesuaian pH air.',
        expectedEn: 'Adjust the water pH.',
        expectedId: 'Lakukan penyesuaian pH air.',
      },
      {
        source: 'Kurangi konsentrasi nutrisi atau lakukan pengenceran.',
        expectedEn: 'Reduce the nutrient concentration or dilute the solution.',
        expectedId: 'Kurangi konsentrasi nutrisi atau lakukan pengenceran.',
      },
      {
        source: 'Lakukan pengenceran menggunakan air bersih.',
        expectedEn: 'Dilute with clean water.',
        expectedId: 'Lakukan pengenceran menggunakan air bersih.',
      },
    ];

    cases.forEach(({ source, expectedEn, expectedId }) => {
      it(`translates action "${source}" cleanly to EN and ID`, () => {
        const enRes = translateActionWithMeta(source, 'en');
        expect(enRes.isTranslated).toBe(true);
        expect(enRes.text).toBe(expectedEn);
        expect(enRes.text).not.toContain('[Translation unavailable]');

        const idRes = translateActionWithMeta(source, 'id');
        expect(idRes.isTranslated).toBe(true);
        expect(idRes.text).toBe(expectedId);
      });
    });
  });

  describe('4. Preserved Bidirectional Translations', () => {
    it('translates heat stress impact bidirectionally', () => {
      const fromId = translateImpactWithMeta('Tanaman dapat mengalami stres akibat panas.', 'en');
      expect(fromId.isTranslated).toBe(true);
      expect(fromId.text).toBe('Plants may experience heat stress.');

      const fromEn = translateImpactWithMeta('Plants may experience heat stress.', 'id');
      expect(fromEn.isTranslated).toBe(true);
      expect(fromEn.text).toBe('Tanaman dapat mengalami stres akibat panas.');
    });

    it('translates heat reduction action bidirectionally', () => {
      const fromId = translateActionWithMeta(
        'Jaga kelembapan tanah dan kurangi paparan panas.',
        'en'
      );
      expect(fromId.isTranslated).toBe(true);
      expect(fromId.text).toBe('Maintain soil moisture and reduce heat exposure.');

      const fromEn = translateActionWithMeta(
        'Maintain soil moisture and reduce heat exposure.',
        'id'
      );
      expect(fromEn.isTranslated).toBe(true);
      expect(fromEn.text).toBe('Jaga kelembapan tanah dan kurangi paparan panas.');
    });
  });

  describe('5. Punctuation, Whitespace, and Spelling Normalization', () => {
    it('normalizes trailing periods, question marks, and exclamation marks', () => {
      expect(translateProblem('TDS air tinggi...', 'en')).toBe('Water TDS is high');
      expect(translateProblem('Kelembaban tanah rendah!', 'en')).toBe('Soil moisture is low');
      expect(translateImpact('Tanaman berisiko mengalami kekurangan air???', 'en')).toBe(
        'Plants may experience water stress.'
      );
    });

    it('normalizes multiple spaces, tabs, and newlines', () => {
      expect(translateAction('  Lakukan   penyiraman  \n secara\tbertahap.  ', 'en')).toBe(
        'Water gradually.'
      );
    });

    it('normalizes quotes and Indonesian kelembaban/kelembapan spelling variants', () => {
      expect(translateProblem('“Kelembaban tanah rendah”', 'en')).toBe('Soil moisture is low');
      expect(translateProblem('"Kelembapan tanah rendah"', 'en')).toBe('Soil moisture is low');
    });
  });

  describe('6. Dynamic Parameterized Summary Localization', () => {
    it('translates screenshot water summary with 3 parameters to EN and ID', () => {
      const summarySource =
        'Ditemukan 3 parameter water yang membutuhkan perhatian: pH Air, EC Air, TDS Air.';

      const enRes = translateSummaryWithMeta(summarySource, 'en');
      expect(enRes.isTranslated).toBe(true);
      expect(enRes.text).toBe(
        '3 water quality parameters need attention: water pH, water EC, and water TDS.'
      );

      const idRes = translateSummaryWithMeta(summarySource, 'id');
      expect(idRes.isTranslated).toBe(true);
      expect(idRes.text).toBe(
        '3 parameter kualitas air memerlukan perhatian: pH air, EC air, dan TDS air.'
      );
    });

    it('translates single water parameter summary (singular grammar)', () => {
      const summarySource = 'Ditemukan 1 parameter water yang membutuhkan perhatian: pH Air.';

      const enRes = translateSummaryWithMeta(summarySource, 'en');
      expect(enRes.isTranslated).toBe(true);
      expect(enRes.text).toBe('1 water quality parameter needs attention: water pH.');

      const idRes = translateSummaryWithMeta(summarySource, 'id');
      expect(idRes.isTranslated).toBe(true);
      expect(idRes.text).toBe('1 parameter kualitas air memerlukan perhatian: pH air.');
    });

    it('translates dynamic soil summaries accurately for both locales', () => {
      const summarySource =
        'Ditemukan 2 parameter soil yang membutuhkan perhatian: Kelembaban Tanah, Suhu Tanah.';

      const enRes = translateSummaryWithMeta(summarySource, 'en');
      expect(enRes.isTranslated).toBe(true);
      expect(enRes.text).toBe(
        '2 soil parameters need attention: soil moisture and soil temperature.'
      );

      const idRes = translateSummaryWithMeta(summarySource, 'id');
      expect(idRes.isTranslated).toBe(true);
      expect(idRes.text).toBe(
        '2 parameter tanah memerlukan perhatian: kelembapan tanah dan suhu tanah.'
      );
    });

    it('translates dynamic summary starting from English source input to Indonesian', () => {
      const enSource =
        '3 water quality parameters need attention: water pH, water EC, and water TDS.';
      const idRes = translateSummaryWithMeta(enSource, 'id');
      expect(idRes.isTranslated).toBe(true);
      expect(idRes.text).toBe(
        '3 parameter kualitas air memerlukan perhatian: pH air, EC air, dan TDS air.'
      );
    });
  });

  describe('7. Genuinely Unknown Message Fallback Disclosure', () => {
    it('returns isTranslated: false and preserves raw text for unknown messages', () => {
      const unknownMsg = 'Gejala agronomi misterius dari sensor eksperimental X99.';

      const probRes = translateProblemWithMeta(unknownMsg, 'en');
      expect(probRes.isTranslated).toBe(false);
      expect(probRes.text).toBe('Translation unavailable');
      expect(probRes.originalText).toBe(unknownMsg);

      const idProbRes = translateProblemWithMeta(unknownMsg, 'id');
      expect(idProbRes.isTranslated).toBe(false);
      expect(idProbRes.text).toBe('Terjemahan tidak tersedia');
      expect(idProbRes.originalText).toBe(unknownMsg);
    });

    it('renders unknown message disclosure in RecommendationCard without crashing or dumping ugly wrappers in primary text', () => {
      const unknownPrediction: LatestPredictionData = {
        id: 'pred-unknown-99',
        deviceId: 'device-unknown',
        readingId: null,
        predictedClass: 'warning',
        confidence: 0.88,
        summary: 'Ringkasan diagnosis eksperimental belum terdaftar di kamus.',
        issues: [
          {
            parameter: 'ParameterX',
            value: 42,
            problem: 'Masalah misterius tidak terdaftar',
            impact: 'Dampak tidak terduga pada tanaman melon',
          },
        ],
        farmerAction: ['Tindakan eksperimental non-standar'],
        createdAt: '2026-10-17T10:00:00.000Z',
      };

      document.cookie = 'locale=en';
      render(
        <RecommendationCard domain="water" prediction={unknownPrediction} isLoading={false} />
      );

      // Primary cards should render "Translation unavailable" badge, NOT "[Translation unavailable] Source: ..."
      expect(screen.queryByText(/\[Translation unavailable\] Source:/)).not.toBeInTheDocument();
      expect(screen.getAllByText('Translation unavailable').length).toBeGreaterThan(0);

      // Should render the disclosure button
      const disclosures = screen.getAllByText('View original text');
      expect(disclosures.length).toBeGreaterThan(0);

      // The original text should be intact in the DOM inside disclosure containers
      expect(
        screen.getByText('Ringkasan diagnosis eksperimental belum terdaftar di kamus.')
      ).toBeInTheDocument();
      expect(screen.getByText('Masalah misterius tidak terdaftar')).toBeInTheDocument();
    });
  });

  describe('8. RecommendationCard Locale Switching with Screenshot Messages', () => {
    const screenshotWaterPrediction: LatestPredictionData = {
      id: 'pred-water-screenshot',
      deviceId: 'water-node-01',
      readingId: null,
      predictedClass: 'warning',
      confidence: 0.85,
      summary: 'Ditemukan 3 parameter water yang membutuhkan perhatian: pH Air, EC Air, TDS Air.',
      issues: [
        {
          parameter: 'TDS air',
          value: 3200,
          problem: 'TDS air tinggi',
          impact: 'Ketersediaan unsur mikro dapat menurun.',
        },
      ],
      farmerAction: [
        'Lakukan penyesuaian pH air.',
        'Kurangi konsentrasi nutrisi atau lakukan pengenceran.',
        'Lakukan pengenceran menggunakan air bersih.',
      ],
      createdAt: '2026-10-17T12:00:00.000Z',
    };

    it('renders clean English recommendation card without fallback wrappers for screenshot payload', () => {
      document.cookie = 'locale=en';

      const { unmount } = render(
        <RecommendationCard
          domain="water"
          prediction={screenshotWaterPrediction}
          isLoading={false}
        />
      );

      // Summary
      expect(screen.getByTestId('recommendation-summary')).toHaveTextContent(
        '3 water quality parameters need attention: water pH, water EC, and water TDS.'
      );
      expect(screen.queryByText(/\[Translation unavailable\]/)).not.toBeInTheDocument();

      // Issue: problem and impact
      expect(screen.getByText('Water TDS is high')).toBeInTheDocument();
      expect(
        screen.getByText((_, element) => {
          return (
            element?.tagName.toLowerCase() === 'div' &&
            element?.textContent === 'Impact: Micronutrient availability may decrease.'
          );
        })
      ).toBeInTheDocument();

      // Actions
      expect(screen.getByTestId('recommendation-action-0')).toHaveTextContent(
        'Adjust the water pH.'
      );
      expect(screen.getByTestId('recommendation-action-1')).toHaveTextContent(
        'Reduce the nutrient concentration or dilute the solution.'
      );
      expect(screen.getByTestId('recommendation-action-2')).toHaveTextContent(
        'Dilute with clean water.'
      );

      unmount();

      // Switch to Indonesian
      document.cookie = 'locale=id';
      render(
        <RecommendationCard
          domain="water"
          prediction={screenshotWaterPrediction}
          isLoading={false}
        />
      );

      // Summary in ID
      expect(screen.getByTestId('recommendation-summary')).toHaveTextContent(
        '3 parameter kualitas air memerlukan perhatian: pH air, EC air, dan TDS air.'
      );

      // Issue in ID
      expect(screen.getByText('TDS air tinggi')).toBeInTheDocument();
      expect(
        screen.getByText((_, element) => {
          return (
            element?.tagName.toLowerCase() === 'div' &&
            element?.textContent === 'Dampak: Ketersediaan unsur mikro dapat menurun.'
          );
        })
      ).toBeInTheDocument();

      // Actions in ID
      expect(screen.getByTestId('recommendation-action-0')).toHaveTextContent(
        'Lakukan penyesuaian pH air.'
      );
      expect(screen.getByTestId('recommendation-action-1')).toHaveTextContent(
        'Kurangi konsentrasi nutrisi atau lakukan pengenceran.'
      );
      expect(screen.getByTestId('recommendation-action-2')).toHaveTextContent(
        'Lakukan pengenceran menggunakan air bersih.'
      );
    });
  });
});

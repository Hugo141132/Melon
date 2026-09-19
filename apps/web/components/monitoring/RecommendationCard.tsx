'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, Clock, Sparkles } from 'lucide-react';
import type { LatestPredictionData } from '@/hooks/useLatestPrediction';

export interface RecommendationCardProps {
  prediction: LatestPredictionData | null;
  domain: 'soil' | 'water';
  isLoading?: boolean;
  isStale?: boolean;
  isOffline?: boolean;
  className?: string;
}

// Format ISO date string into Indonesian/local time
function formatTimestamp(isoString: string | null | undefined): string | null {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return null;
  }
}

export default function RecommendationCard({
  prediction,
  domain,
  isLoading = false,
  isStale = false,
  isOffline = false,
  className = '',
}: RecommendationCardProps) {
  const t = useTranslations('recommendation');

  const cardTitle = domain === 'soil' ? t('titleSoil') : t('titleWater');

  // 1. Loading Skeleton State (adheres to Skeleton loading motion effect)
  if (isLoading) {
    return (
      <section
        data-testid="recommendation-card-loading"
        className={`bg-app-surface-container-lowest rounded-xl p-5 soft-elevation border border-app-outline-variant/20 animate-fade-in ${className}`}
        aria-busy="true"
        aria-label={cardTitle}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-app-surface-container animate-pulse" />
            <div className="h-6 w-48 bg-app-surface-container rounded animate-pulse" />
          </div>
          <div className="h-6 w-20 bg-app-surface-container rounded-full animate-pulse" />
        </div>
        <div className="space-y-3 mt-4">
          <div className="h-4 w-full bg-app-surface-container rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-app-surface-container rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-app-surface-container rounded animate-pulse" />
        </div>
      </section>
    );
  }

  // 2. Empty / Unavailable State
  if (!prediction) {
    return (
      <section
        data-testid="recommendation-card-empty"
        className={`bg-app-surface-container-lowest rounded-xl p-5 soft-elevation border border-app-outline-variant/20 animate-fade-in ${className}`}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={20} className="text-app-primary mt-0.5 shrink-0" />
          <h3 className="text-[18px] leading-6 font-bold text-app-on-surface">{cardTitle}</h3>
        </div>

        {/* Stale / Offline Notice if applicable */}
        {(isStale || isOffline) && (
          <div
            data-testid="recommendation-stale-notice"
            className="mb-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center gap-2 text-[12px] text-amber-800 dark:text-amber-300 font-medium"
          >
            <AlertTriangle size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{isOffline ? t('offlineNotice') : t('staleNotice')}</span>
          </div>
        )}

        <div className="flex items-start gap-3 py-2 text-app-on-surface-variant">
          <Info size={18} className="shrink-0 mt-0.5 text-app-on-surface-variant" />
          <div>
            <p className="text-[14px] font-semibold text-app-on-surface">{t('noDataTitle')}</p>
            <p className="text-[12px] text-app-on-surface-variant mt-0.5">{t('noDataDesc')}</p>
          </div>
        </div>

        {/* Advisory Safety Disclaimer */}
        <p className="text-[11px] leading-4 text-app-on-surface-variant/70 border-t border-app-outline-variant/15 pt-3 mt-4">
          {t('advisoryDisclaimer')}
        </p>
      </section>
    );
  }

  // 3. Populated State
  const classification = (prediction.predictedClass || '').toLowerCase();
  const isOptimal = classification === 'optimal';
  const isCritical = classification === 'kritis' || classification === 'critical';
  const isWarning = !isOptimal && !isCritical;

  const formattedTime = formatTimestamp(prediction.createdAt);
  const confidencePercent =
    typeof prediction.confidence === 'number'
      ? Math.round(prediction.confidence <= 1 ? prediction.confidence * 100 : prediction.confidence)
      : null;

  const issues = prediction.issues || [];
  const farmerActions = prediction.farmerAction || [];

  return (
    <section
      data-testid="recommendation-card"
      className={`bg-app-surface-container-lowest rounded-xl p-5 soft-elevation border border-app-outline-variant/20 transition-all hover:border-app-primary/30 animate-fade-in ${className}`}
    >
      {/* Header with Title & Classification Badge */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-app-primary shrink-0" />
          <h3 className="text-[18px] leading-6 font-bold text-app-on-surface">{cardTitle}</h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {confidencePercent !== null && (
            <span
              data-testid="recommendation-confidence"
              className="text-[11px] font-medium text-app-on-surface-variant bg-app-surface-container px-2.5 py-0.5 rounded-full"
            >
              {t('confidence', { value: confidencePercent })}
            </span>
          )}

          {/* Classification Pill Badge */}
          {isOptimal && (
            <span
              data-testid="classification-badge-optimal"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
            >
              <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
              {t('optimal')}
            </span>
          )}
          {isWarning && (
            <span
              data-testid="classification-badge-warning"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20"
            >
              <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
              {t('warning')}
            </span>
          )}
          {isCritical && (
            <span
              data-testid="classification-badge-critical"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
            >
              <AlertCircle size={13} className="text-rose-600 dark:text-rose-400" />
              {t('critical')}
            </span>
          )}
        </div>
      </div>

      {/* Stale / Offline Notice Banner */}
      {(isStale || isOffline) && (
        <div
          data-testid="recommendation-stale-notice"
          className="mb-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex items-center gap-2 text-[12px] text-amber-800 dark:text-amber-300 font-medium"
        >
          <AlertTriangle size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{isOffline ? t('offlineNotice') : t('staleNotice')}</span>
        </div>
      )}

      {/* Summary Statement */}
      {prediction.summary && (
        <div className="mb-3 py-1">
          <p
            data-testid="recommendation-summary"
            className="text-[15px] leading-6 font-semibold text-app-on-surface"
          >
            {prediction.summary}
          </p>
        </div>
      )}

      {/* Diagnostic Issues Section */}
      {issues.length > 0 && (
        <div className="space-y-2 mb-4">
          <h4 className="text-[12px] font-bold text-app-on-surface-variant tracking-wider uppercase">
            {t('issuesTitle')}
          </h4>
          <div className="space-y-2">
            {issues.map((issue, idx) => (
              <div
                key={idx}
                data-testid={`recommendation-issue-${idx}`}
                className="bg-app-surface-container/50 border border-app-outline-variant/15 rounded-lg p-3 text-[13px] leading-5 space-y-1"
              >
                <div className="flex items-center justify-between font-semibold text-app-on-surface">
                  <span>{issue.parameter || '-'}</span>
                  {issue.value !== null && issue.value !== undefined && (
                    <span className="text-[12px] text-app-on-surface-variant font-mono">
                      {issue.value}
                    </span>
                  )}
                </div>
                {issue.problem && (
                  <p className="text-rose-700 dark:text-rose-400 text-[12px]">{issue.problem}</p>
                )}
                {issue.impact && (
                  <p className="text-app-on-surface-variant text-[12px] italic">
                    Dampak: {issue.impact}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Farmer Actions Section */}
      <div className="space-y-2 mb-4">
        <h4 className="text-[12px] font-bold text-app-on-surface-variant tracking-wider uppercase">
          {t('actionsTitle')}
        </h4>
        {farmerActions.length > 0 ? (
          <div className="space-y-2">
            {farmerActions.map((action, idx) => (
              <div
                key={idx}
                data-testid={`recommendation-action-${idx}`}
                className="flex items-start gap-2.5 text-[13px] leading-5 text-app-on-surface"
              >
                <CheckCircle2 size={16} className="text-app-primary mt-0.5 shrink-0" />
                <span>{action}</span>
              </div>
            ))}
          </div>
        ) : (
          <p
            data-testid="recommendation-optimal-desc"
            className="text-[13px] leading-5 text-app-on-surface-variant flex items-center gap-2"
          >
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            {t('optimalStatusDesc')}
          </p>
        )}
      </div>

      {/* Card Footer: Timestamp & Physical Safety Disclaimer */}
      <div className="border-t border-app-outline-variant/15 pt-3 space-y-1.5">
        {formattedTime && (
          <div
            data-testid="recommendation-timestamp"
            className="flex items-center gap-1.5 text-[11px] text-app-on-surface-variant"
          >
            <Clock size={12} className="shrink-0" />
            <span>{t('lastUpdated', { time: formattedTime })}</span>
          </div>
        )}
        <p
          data-testid="recommendation-disclaimer"
          className="text-[11px] leading-4 text-app-on-surface-variant/70"
        >
          {t('advisoryDisclaimer')}
        </p>
      </div>
    </section>
  );
}

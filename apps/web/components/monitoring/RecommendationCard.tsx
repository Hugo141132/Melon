'use client';

import React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  Sparkles,
  Activity,
  ListChecks,
} from 'lucide-react';
import type { LatestPredictionData } from '@/hooks/useLatestPrediction';
import {
  translateParameter,
  translateProblem,
  translateImpact,
  translateAction,
  translateSummary,
  getParameterUnit,
} from '@/lib/recommendation-i18n';

export interface RecommendationCardProps {
  prediction: LatestPredictionData | null;
  domain: 'soil' | 'water';
  isLoading?: boolean;
  isStale?: boolean;
  isOffline?: boolean;
  className?: string;
}

// Format ISO date string into locale-aware formatted time
function formatTimestamp(
  isoString: string | null | undefined,
  locale: string = 'id'
): string | null {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleTimeString(locale === 'en' ? 'en-US' : 'id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
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
  const locale = useLocale();

  const cardTitle = domain === 'soil' ? t('titleSoil') : t('titleWater');

  // 1. Loading Skeleton State (Soft Bento Dashboard skeleton loading)
  if (isLoading) {
    return (
      <section
        data-testid="recommendation-card-loading"
        className={`bg-app-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-app-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.25)] animate-fade-in ${className}`}
        aria-busy="true"
        aria-label={cardTitle}
      >
        {/* Skeleton Header */}
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-app-surface-container rounded-full animate-pulse" />
            <div className="h-6 w-56 sm:w-72 bg-app-surface-container rounded-lg animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-24 bg-app-surface-container rounded-full animate-pulse" />
            <div className="h-7 w-20 bg-app-surface-container rounded-full animate-pulse" />
          </div>
        </div>

        {/* Skeleton AI Summary Card */}
        <div className="h-16 w-full bg-app-surface-container/60 rounded-xl mb-5 animate-pulse" />

        {/* Skeleton Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 space-y-3">
            <div className="h-5 w-36 bg-app-surface-container rounded animate-pulse" />
            <div className="h-20 w-full bg-app-surface-container/50 rounded-xl animate-pulse" />
            <div className="h-20 w-full bg-app-surface-container/50 rounded-xl animate-pulse" />
          </div>
          <div className="lg:col-span-5 space-y-3">
            <div className="h-5 w-44 bg-app-surface-container rounded animate-pulse" />
            <div className="h-12 w-full bg-app-surface-container/50 rounded-xl animate-pulse" />
            <div className="h-12 w-full bg-app-surface-container/50 rounded-xl animate-pulse" />
          </div>
        </div>
      </section>
    );
  }

  // 2. Empty / Unavailable State (Soft Bento Dashboard empty state)
  if (!prediction) {
    return (
      <section
        data-testid="recommendation-card-empty"
        className={`bg-app-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-app-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.25)] animate-fade-in ${className}`}
      >
        {/* Micro-badge & Title */}
        <div className="mb-4">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-app-primary/10 border border-app-primary/20 text-app-primary text-[11px] font-semibold tracking-wide mb-1.5">
            <Sparkles size={12} className="text-app-primary shrink-0" />
            <span>{t('badgeAiIntelligence')}</span>
          </div>
          <h3 className="text-[18px] sm:text-[20px] font-bold text-app-on-surface tracking-tight">
            {cardTitle}
          </h3>
        </div>

        {/* Stale / Offline Notice Banner */}
        {(isStale || isOffline) && (
          <div
            data-testid="recommendation-stale-notice"
            className="mb-4 bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex items-center gap-2.5 text-[12px] text-amber-900 dark:text-amber-200 font-medium"
          >
            <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{isOffline ? t('offlineNotice') : t('staleNotice')}</span>
          </div>
        )}

        {/* Empty Bento Content Box */}
        <div className="flex items-start gap-3.5 p-4 rounded-xl bg-app-surface-container-low/70 border border-app-outline-variant/20">
          <div className="w-8 h-8 rounded-lg bg-app-primary/10 text-app-primary flex items-center justify-center shrink-0 mt-0.5">
            <Info size={18} className="text-app-primary" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-app-on-surface">{t('noDataTitle')}</p>
            <p className="text-[12px] text-app-on-surface-variant leading-relaxed mt-1">
              {t('noDataDesc')}
            </p>
          </div>
        </div>

        {/* Advisory Safety Disclaimer */}
        <p
          data-testid="recommendation-disclaimer"
          className="text-[11px] leading-relaxed text-app-on-surface-variant/80 border-t border-app-outline-variant/20 pt-3.5 mt-5 font-normal"
        >
          {t('advisoryDisclaimer')}
        </p>
      </section>
    );
  }

  // 3. Populated State (Soft Bento Dashboard Direction)
  const classification = (prediction.predictedClass || '').toLowerCase();
  const isOptimal = classification === 'optimal' || classification === 'baik';
  const isCritical = classification === 'kritis' || classification === 'critical';
  const isWarning = !isOptimal && !isCritical;

  const formattedTime = formatTimestamp(prediction.createdAt, locale);
  const confidencePercent =
    typeof prediction.confidence === 'number'
      ? Math.round(prediction.confidence <= 1 ? prediction.confidence * 100 : prediction.confidence)
      : null;

  const issues = prediction.issues || [];
  const farmerActions = prediction.farmerAction || [];
  const translatedSummary = translateSummary(prediction.summary, locale);

  return (
    <section
      data-testid="recommendation-card"
      className={`bg-app-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-app-outline-variant/30 shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)] transition-all duration-200 hover:border-app-primary/30 animate-fade-in ${className}`}
    >
      {/* Header with Domain Micro-Badge, Title & Pill Cluster */}
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-app-primary/10 border border-app-primary/20 text-app-primary text-[11px] font-semibold tracking-wide mb-1.5">
            <Sparkles size={12} className="text-app-primary shrink-0" />
            <span>{t('badgeAiIntelligence')}</span>
          </div>
          <h3 className="text-[18px] sm:text-[20px] font-bold text-app-on-surface tracking-tight">
            {cardTitle}
          </h3>
        </div>

        {/* Status Pill Cluster */}
        <div className="flex items-center gap-2 shrink-0">
          {confidencePercent !== null && (
            <div
              data-testid="recommendation-confidence"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-app-surface-container-low border border-app-outline-variant/20 text-app-on-surface-variant shadow-xs"
            >
              <Activity size={13} className="text-app-primary shrink-0" />
              <span>{t('confidence', { value: confidencePercent })}</span>
            </div>
          )}

          {/* Classification Pill Badge */}
          {isOptimal && (
            <span
              data-testid="classification-badge-optimal"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shadow-xs"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
              {t('optimal')}
            </span>
          )}
          {isWarning && (
            <span
              data-testid="classification-badge-warning"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/25 shadow-xs"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
              {t('warning')}
            </span>
          )}
          {isCritical && (
            <span
              data-testid="classification-badge-critical"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25 shadow-xs"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
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
          className="mb-4 bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex items-center gap-2.5 text-[12px] text-amber-900 dark:text-amber-200 font-medium"
        >
          <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{isOffline ? t('offlineNotice') : t('staleNotice')}</span>
        </div>
      )}

      {/* AI Diagnostic Summary Bento Card */}
      {translatedSummary && (
        <div
          className={`mb-5 p-4 rounded-xl border border-app-outline-variant/20 border-l-4 ${
            isCritical
              ? 'bg-rose-500/5 border-l-rose-500'
              : isWarning
                ? 'bg-amber-500/5 border-l-amber-500'
                : 'bg-emerald-500/5 border-l-emerald-500'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-app-on-surface-variant">
            <span>{t('summaryTitle')}</span>
          </div>
          <p
            data-testid="recommendation-summary"
            className="text-[14px] sm:text-[15px] font-semibold text-app-on-surface leading-relaxed"
          >
            {translatedSummary}
          </p>
        </div>
      )}

      {/* Bento Grid: Issues Diagnostics & Suggested Actions */}
      <div className={`grid grid-cols-1 ${issues.length > 0 ? 'lg:grid-cols-12' : ''} gap-5 mb-5`}>
        {/* Detected Issues Sub-Grid */}
        {issues.length > 0 && (
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between pb-0.5">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} className="text-rose-600 dark:text-rose-400 shrink-0" />
                <h4 className="text-[12px] sm:text-[13px] font-bold text-app-on-surface tracking-wider uppercase">
                  {t('issuesTitle')}
                </h4>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                {t('detectedCount', { count: issues.length })}
              </span>
            </div>

            <div className="space-y-2.5">
              {issues.map((issue, idx) => {
                const paramName = translateParameter(issue.parameter, locale);
                const problemText = translateProblem(issue.problem, locale);
                const impactText = translateImpact(issue.impact, locale);
                const unit = getParameterUnit(issue.parameter);
                const impactPrefix = t('impactPrefix');

                return (
                  <div
                    key={idx}
                    data-testid={`recommendation-issue-${idx}`}
                    className="bg-app-surface-container-low/70 border border-app-outline-variant/20 rounded-xl p-3.5 space-y-2 transition-all hover:bg-app-surface-container-low"
                  >
                    {/* Parameter Title & Value Pill */}
                    <div className="flex items-center justify-between gap-2 font-bold text-app-on-surface text-[13px]">
                      <span>{paramName}</span>
                      {issue.value !== null && issue.value !== undefined && (
                        <span className="font-mono text-[12px] font-bold px-2 py-0.5 rounded-md bg-app-surface-container text-app-on-surface border border-app-outline-variant/15 flex items-center gap-1 shrink-0">
                          <span>{issue.value}</span>
                          {unit && (
                            <span className="text-[10px] text-app-on-surface-variant font-normal">
                              {unit}
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Problem Description */}
                    {problemText && (
                      <p className="text-rose-700 dark:text-rose-400 text-[12px] font-semibold leading-snug">
                        {problemText}
                      </p>
                    )}

                    {/* Agronomic Impact Explanation */}
                    {impactText && (
                      <div className="text-app-on-surface-variant text-[12px] leading-relaxed italic bg-app-surface-container-lowest/80 border border-app-outline-variant/15 rounded-lg px-2.5 py-1.5">
                        {impactPrefix}: {impactText}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Suggested Actions Sub-Grid */}
        <div className={`${issues.length > 0 ? 'lg:col-span-5' : 'col-span-full'} space-y-3`}>
          <div className="flex items-center justify-between pb-0.5">
            <div className="flex items-center gap-2">
              <ListChecks size={15} className="text-app-primary shrink-0" />
              <h4 className="text-[12px] sm:text-[13px] font-bold text-app-on-surface tracking-wider uppercase">
                {t('actionsTitle')}
              </h4>
            </div>
            {farmerActions.length > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-app-primary/10 text-app-primary border border-app-primary/20">
                {t('actionsCount', { count: farmerActions.length })}
              </span>
            )}
          </div>

          {farmerActions.length > 0 ? (
            <div className="space-y-2.5">
              {farmerActions.map((action, idx) => {
                const translatedAction = translateAction(action, locale);
                return (
                  <div
                    key={idx}
                    data-testid={`recommendation-action-${idx}`}
                    className="flex items-start gap-3 p-3 rounded-xl bg-app-surface-container-low/70 border border-app-outline-variant/20 hover:border-app-primary/30 transition-all text-[13px] leading-snug text-app-on-surface"
                  >
                    <div className="w-5 h-5 rounded-full bg-app-primary/10 text-app-primary flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 size={13} className="text-app-primary" />
                    </div>
                    <span className="font-medium">{translatedAction}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              data-testid="recommendation-optimal-desc"
              className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[13px] text-emerald-800 dark:text-emerald-300 flex items-start gap-3"
            >
              <CheckCircle2
                size={18}
                className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
              />
              <p className="font-medium leading-relaxed">{t('optimalStatusDesc')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer: Timestamp & Physical Safety Disclaimer */}
      <div className="border-t border-app-outline-variant/20 pt-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-[11px] text-app-on-surface-variant">
        {formattedTime && (
          <div
            data-testid="recommendation-timestamp"
            className="flex items-center gap-1.5 font-medium shrink-0"
          >
            <Clock size={13} className="shrink-0 text-app-on-surface-variant/80" />
            <span>{t('lastUpdated', { time: formattedTime })}</span>
          </div>
        )}
        <p
          data-testid="recommendation-disclaimer"
          className="text-app-on-surface-variant/80 font-normal leading-normal"
        >
          {t('advisoryDisclaimer')}
        </p>
      </div>
    </section>
  );
}

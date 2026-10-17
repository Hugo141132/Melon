'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export interface CompactPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  prevTestId?: string;
  nextTestId?: string;
}

export function CompactPagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  className,
  ariaLabel,
  prevTestId,
  nextTestId,
}: CompactPaginationProps) {
  const tCommon = useTranslations('common');

  if (totalPages <= 1) {
    return null;
  }

  // Generate numbered items with ellipsis based on Image 2 visual design
  const getPaginationItems = (): Array<number | 'ellipsis'> => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [
        1,
        'ellipsis',
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
  };

  const items = getPaginationItems();

  return (
    <nav
      role="navigation"
      aria-label={ariaLabel || tCommon('pagination')}
      className={cn('inline-flex items-center gap-1 sm:gap-1.5 select-none', className)}
    >
      {/* Previous Chevron Button */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={disabled || currentPage <= 1}
        aria-label={tCommon('previousPage')}
        data-testid={prevTestId}
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
          'text-app-on-surface-variant hover:text-app-on-surface hover:bg-app-surface-container/60',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary/50',
          'disabled:opacity-30 disabled:pointer-events-none cursor-pointer'
        )}
      >
        <ChevronLeft size={16} strokeWidth={2.2} />
      </button>

      {/* Numbered Page Buttons & Ellipsis */}
      {items.map((item, idx) => {
        if (item === 'ellipsis') {
          return (
            <span
              key={`ellipsis-${idx}`}
              className="w-7 h-8 flex items-center justify-center text-app-on-surface-variant/70 text-xs tracking-widest font-bold select-none"
              aria-hidden="true"
            >
              ···
            </span>
          );
        }

        const isCurrent = item === currentPage;

        return (
          <button
            key={`page-${item}`}
            type="button"
            onClick={() => onPageChange(item)}
            disabled={disabled}
            aria-label={tCommon('pageNumber', { page: item })}
            aria-current={isCurrent ? 'page' : undefined}
            className={cn(
              'h-8 min-w-[2rem] px-2 rounded-xl text-xs sm:text-[13px] flex items-center justify-center transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary/50 cursor-pointer',
              isCurrent
                ? 'bg-app-surface-container-lowest text-app-on-surface font-bold border border-app-outline-variant/60 shadow-xs'
                : 'text-app-on-surface-variant hover:text-app-on-surface hover:bg-app-surface-container/60 font-medium'
            )}
          >
            {item}
          </button>
        );
      })}

      {/* Next Chevron Button */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={disabled || currentPage >= totalPages}
        aria-label={tCommon('nextPage')}
        data-testid={nextTestId}
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
          'text-app-on-surface-variant hover:text-app-on-surface hover:bg-app-surface-container/60',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary/50',
          'disabled:opacity-30 disabled:pointer-events-none cursor-pointer'
        )}
      >
        <ChevronRight size={16} strokeWidth={2.2} />
      </button>
    </nav>
  );
}

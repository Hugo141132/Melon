'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UserAvatarProps {
  name?: string | null;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  alt?: string;
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs border border-app-primary/20 ring-2 ring-app-primary/10',
  md: 'w-16 h-16 text-xl border-2 border-app-primary-fixed ring-2 ring-app-primary/10',
  lg: 'w-28 h-28 text-4xl border-4 border-white soft-elevation ring-2 ring-app-primary/10',
};

const ICON_SIZES = {
  sm: 16,
  md: 28,
  lg: 48,
};

const PIXEL_SIZES = {
  sm: 32,
  md: 64,
  lg: 112,
};

export default function UserAvatar({ name, src, size = 'sm', className, alt }: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const trimmed = name?.trim() || '';
  const initial = trimmed ? trimmed.charAt(0).toUpperCase() : null;
  const displayAlt = alt || trimmed || 'User Profile';

  // If a valid src is provided and hasn't errored, render Next.js Image
  const shouldRenderImage = Boolean(src && !imageError);

  return (
    <div
      className={cn(
        'rounded-full overflow-hidden flex items-center justify-center bg-app-primary text-on-primary font-bold select-none shrink-0',
        SIZE_CLASSES[size],
        className
      )}
      data-testid="user-avatar"
    >
      {shouldRenderImage ? (
        <Image
          src={src!}
          alt={displayAlt}
          width={PIXEL_SIZES[size]}
          height={PIXEL_SIZES[size]}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : initial ? (
        <span data-testid="user-avatar-initial">{initial}</span>
      ) : (
        <User size={ICON_SIZES[size]} className="text-on-primary shrink-0" aria-hidden="true" />
      )}
    </div>
  );
}

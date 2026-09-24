import React from 'react';

interface AppBackgroundProps {
  className?: string;
  variant?: 'default' | 'subtle' | 'vibrant';
}

/**
 * AppBackground
 * Reusable visual layer implementing a calm, refined organic green curves & gradient system.
 * Built with zero raster bloat, inlined lightweight vector SVG (<2KB), and 100% solid, blur-free layers.
 * Provides gentle depth and an authentic SaaS atmosphere while remaining strictly non-dominant.
 */
export default function AppBackground({ className = '', variant = 'default' }: AppBackgroundProps) {
  return (
    <div
      className={`fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none ${className}`}
      aria-hidden="true"
    >
      {/* Inlined Vector SVG Layer with calibrated, non-dominant organic curves */}
      <svg
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Calibrated calm agricultural palette - non-dominant, light, and elegant */}
          <linearGradient id="melon-base-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f3f7f0" />
            <stop offset="35%" stopColor="#e8f2e4" />
            <stop offset="70%" stopColor="#ddecd8" />
            <stop offset="100%" stopColor="#eaf4e6" />
          </linearGradient>

          {/* Gentle translucent organic shape fills */}
          <linearGradient id="shape-grad-1" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
          </linearGradient>

          <linearGradient id="shape-grad-2" x1="10%" y1="10%" x2="90%" y2="90%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.03" />
          </linearGradient>

          <linearGradient id="shape-grad-3" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.70" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.08" />
          </linearGradient>

          <linearGradient id="shape-grad-4" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.50" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.04" />
          </linearGradient>

          <radialGradient id="highlight-glow" cx="60%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background Base */}
        <rect width="1440" height="900" fill="url(#melon-base-grad)" />

        {/* Organic Shape 1: Far Left sweeping arc */}
        <path
          d="M 0,0 L 220,0 C 350,180 320,440 180,680 C 100,810 0,870 0,900 Z"
          fill="url(#shape-grad-1)"
        />

        {/* Organic Shape 2: Left-Center wide parabolic curve */}
        <path
          d="M 120,0 C 340,60 520,240 500,520 C 480,720 360,860 220,900 L 0,900 L 0,600 C 140,540 240,360 120,0 Z"
          fill="url(#shape-grad-2)"
        />

        {/* Organic Shape 3: Center sweeping undulating ribbon / petal */}
        <path
          d="M 720,0 C 650,140 630,320 680,500 C 720,650 820,800 920,900 L 520,900 C 420,780 360,620 400,420 C 440,220 580,60 720,0 Z"
          fill="url(#shape-grad-3)"
        />

        {/* Organic Shape 4: Top-right descending dome */}
        <path
          d="M 1020,0 C 980,180 1080,340 1220,440 C 1320,510 1440,530 1440,530 L 1440,0 Z"
          fill="url(#shape-grad-1)"
        />

        {/* Organic Shape 5: Bottom-right sweeping wave */}
        <path
          d="M 380,900 C 580,760 840,660 1140,640 C 1280,630 1380,580 1440,520 L 1440,900 Z"
          fill="url(#shape-grad-4)"
        />

        {/* Organic Shape 6: Right arc intersecting shape 4 */}
        <path
          d="M 1440,240 C 1320,260 1220,380 1200,540 C 1190,680 1260,820 1440,900 Z"
          fill="url(#shape-grad-2)"
          opacity="0.6"
        />

        {/* Soft ambient radial light to unify composition */}
        <rect width="1440" height="900" fill="url(#highlight-glow)" />
      </svg>

      {/* Subtle modern SaaS ambient wash ensuring optimal contrast & legibility without backdrop blur */}
      <div
        className={`absolute inset-0 ${
          variant === 'vibrant'
            ? 'bg-transparent'
            : variant === 'subtle'
              ? 'bg-white/40'
              : 'bg-white/10'
        }`}
      />

      {/* Subtle center-focused radial luminance to anchor the central card */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/30 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}

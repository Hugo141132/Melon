import React from 'react';
import DashboardView from '@/components/dashboard/DashboardView';

export const metadata = {
  title: {
    absolute: 'Melon Governance',
  },
  description: 'Sistem pemantauan tanah, kualitas air, dan kontrol irigasi tandon melon',
};

export default function DashboardDirectRoutePage() {
  return <DashboardView />;
}

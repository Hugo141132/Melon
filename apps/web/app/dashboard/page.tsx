import React from 'react';
import DashboardView from '@/components/dashboard/DashboardView';

export const metadata = {
  title: 'Dashboard | Kebun Melon',
  description: 'Sistem pemantauan tanah, kualitas air, dan kontrol irigasi tandon melon',
};

export default function DashboardDirectPage() {
  return <DashboardView />;
}

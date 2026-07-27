import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Kebun Melon - Smart Farming',
    template: '%s | Kebun Melon',
  },
  description:
    'Kelola lahan melon Anda dengan lebih mudah. Monitor NPK, air, dan kesehatan tanaman secara real-time.',
  keywords: ['kebun melon', 'smart farming', 'pertanian pintar', 'NPK sensor'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}

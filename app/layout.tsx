import type { Metadata, Viewport } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n';
import Header from '@/components/common/Header';
import OfflineBadge from '@/components/common/OfflineBadge';
import PwaRegister from '@/components/common/PwaRegister';
import LargeTextSync from '@/components/common/LargeTextSync';

export const metadata: Metadata = {
  title: 'MedKnow — Understand your medications from a photo',
  description:
    'MedKnow explains prescriptions and medication labels in plain language, with voice playback, in English, French and Spanish. Information tool, not medical advice.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  applicationName: 'MedKnow',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0F766E' },
    { media: '(prefers-color-scheme: dark)', color: '#134E4A' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <I18nProvider>
          <LargeTextSync />
          <Header />
          <OfflineBadge />
          <main className="mx-auto w-full max-w-xl px-4 pb-24 pt-4">{children}</main>
          <PwaRegister />
        </I18nProvider>
      </body>
    </html>
  );
}

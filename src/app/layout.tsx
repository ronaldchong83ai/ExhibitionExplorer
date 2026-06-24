import type { Metadata, Viewport } from 'next';
import './globals.css';
import StyledJsxRegistry from './registry';
import AddToHomeScreen from '@/components/AddToHomeScreen';

export const metadata: Metadata = {
  title: 'ExhibitionExplorer',
  description: 'Your premium exhibition companion app - explore stages, exhibitors, venue maps, and more.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ExhibitionExplorer',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0A1628',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png" />
        <script dangerouslySetInnerHTML={{__html: `
          window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            window.deferredPrompt = e;
          });
        `}} />
      </head>
      <body>
        <StyledJsxRegistry>{children}</StyledJsxRegistry>
        <AddToHomeScreen />
      </body>
    </html>
  );
}


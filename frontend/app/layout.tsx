import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/src/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'TrustRoute — AI-Powered Secure Cross-Border Payment Router',
  description:
    'Intelligent cross-border payment router with deterministic fraud risk engine, telecom signal auditing, and multi-objective graph routing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-[#f8f9fc] text-slate-900">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

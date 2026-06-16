import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EW Debate',
  description: 'Visual argumentation board for EW debate classes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased" style={{ background: '#F8F9FF', color: '#1E293B' }}>
        {children}
      </body>
    </html>
  );
}

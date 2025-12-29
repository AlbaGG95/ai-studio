import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Studio',
  description: 'Create and preview AI-generated games',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

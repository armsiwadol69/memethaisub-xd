import type { Metadata } from 'next';
import { Inter, Kanit } from 'next/font/google';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const kanit = Kanit({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-kanit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Meen Thaisub - Rhythm Game Songs Matcher',
  description: 'Manage and explore Thai translation covers matching maimai & CHUNITHM rhythm game databases.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${inter.variable} ${kanit.variable}`}>
      <body>{children}</body>
    </html>
  );
}

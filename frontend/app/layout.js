import { Inter } from 'next/font/google';
import './globals.css';
import { BetslipProvider } from '../contexts/BetslipContext';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata = {
  title: 'EVE — Value Edge Intelligence',
  description: 'Real-time sports pricing intelligence dashboard for UK bettors',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <BetslipProvider>
          {children}
        </BetslipProvider>
      </body>
    </html>
  );
}

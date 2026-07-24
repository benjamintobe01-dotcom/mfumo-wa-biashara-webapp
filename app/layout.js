import './globals.css';

export const metadata = {
  title: 'Mfumo wa Biashara',
  description: 'Bookkeeping ya biashara yako - Mauzo, Manunuzi, Madeni, Wateja',
};

export const viewport = {
  themeColor: '#16301F',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="sw">
      <body>{children}</body>
    </html>
  );
}

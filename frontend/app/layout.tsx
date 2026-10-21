import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teknopark Başvuru Asistanı",
  description: "NACE Rev.2.1 eşleştirme, karakter limiti kontrolü ve portala aktarım.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full">
      <body className="min-h-full bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}

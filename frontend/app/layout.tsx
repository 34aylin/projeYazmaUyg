import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Teknopark Başvuru Asistanı — AI Portalı",
  description: "NACE Rev.2.1 eşleştirme, 20 alan karakter limiti denetimi, Ar-Ge puanlama ve portala aktarım.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`h-full ${plusJakarta.variable}`}>
      <body className="min-h-full bg-[#0B0F19] text-[#E2E8F0] antialiased selection:bg-[#4F46E5] selection:text-white">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Cinzel, Playfair_Display, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});
import { Providers } from "@/providers";
import { ClientOnly } from "@/components/ClientOnly";
import { TerminalLayout } from "@/components/TerminalLayout";
import { Toaster } from "sonner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Secretariat | Thoroughbred RWA Marketplace",
  description: "Decentralized thoroughbred marketplace with fractional ownership and breeding advisor",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`min-h-screen antialiased ${cinzel.variable} ${playfair.variable} ${inter.variable} ${jetbrainsMono.variable} font-sans`} suppressHydrationWarning>
        <ClientOnly>
          <Providers>
            <TerminalLayout>{children}</TerminalLayout>
            <Toaster richColors position="top-right" />
          </Providers>
        </ClientOnly>
      </body>
    </html>
  );
}

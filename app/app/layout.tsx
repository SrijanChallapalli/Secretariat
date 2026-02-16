import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/providers";
import { Header } from "@/components/Header";
import { ClientOnly } from "@/components/ClientOnly";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Secretariat | Thoroughbred RWA Marketplace",
  description: "Decentralized thoroughbred marketplace with fractional ownership and breeding advisor",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-track-800 text-stone-100 antialiased">
        <ClientOnly>
          <Providers>
            <Header />
            <main className="container mx-auto px-4 py-8">{children}</main>
          </Providers>
        </ClientOnly>
      </body>
    </html>
  );
}

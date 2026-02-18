import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/providers";
import { ClientOnly } from "@/components/ClientOnly";
import { TerminalLayout } from "@/components/TerminalLayout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Secretariat | Thoroughbred RWA Marketplace",
  description: "Decentralized thoroughbred marketplace with fractional ownership and breeding advisor",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ClientOnly>
          <Providers>
            <TerminalLayout>{children}</TerminalLayout>
          </Providers>
        </ClientOnly>
      </body>
    </html>
  );
}

"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useChainId } from "wagmi";
import { ogGalileo, adiTestnet } from "@/lib/chains";

const chainNames: Record<number, string> = {
  [ogGalileo.id]: "0G Demo",
  [adiTestnet.id]: "ADI Institutional",
};

const needsWalletConnectId = typeof process.env.NEXT_PUBLIC_WALLETCONNECT_ID !== "string" || process.env.NEXT_PUBLIC_WALLETCONNECT_ID.length !== 32;

export function Header() {
  const chainId = useChainId();
  return (
    <>
      {needsWalletConnectId && (
        <div className="bg-terminal-amber/10 border-b border-terminal-amber/30 px-4 py-1.5 text-center text-xs text-terminal-amber">
          Connect button needs a WalletConnect project ID. Add{" "}
          <code className="bg-secondary px-1 rounded-sm">
            NEXT_PUBLIC_WALLETCONNECT_ID
          </code>{" "}
          (32 chars) from{" "}
          <a
            href="https://cloud.walletconnect.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            cloud.walletconnect.com
          </a>{" "}
          to your{" "}
          <code className="bg-secondary px-1 rounded-sm">.env</code> and
          rebuild. MetaMask still works via &quot;Injected&quot; in the modal.
        </div>
      )}
      <header className="border-b border-border bg-background/95 sticky top-0 z-50 backdrop-blur">
        <div className="container mx-auto px-4 flex items-center justify-between h-14">
          <Link
            href="/"
            className="text-lg font-semibold text-prestige-gold tracking-tight"
          >
            Secretariat
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/marketplace"
              className="text-muted-foreground hover:text-foreground"
            >
              Marketplace
            </Link>
            <Link
              href="/portfolio"
              className="text-muted-foreground hover:text-foreground"
            >
              Portfolio
            </Link>
            <Link
              href="/agent"
              className="text-muted-foreground hover:text-foreground"
            >
              Agent
            </Link>
            <Link
              href="/admin"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Admin
            </Link>
            <span className="text-xs text-muted-foreground font-mono">
              {chainNames[chainId] ?? `Chain ${chainId}`}
            </span>
            <div className="ml-2">
              <ConnectButton />
            </div>
          </nav>
        </div>
      </header>
    </>
  );
}

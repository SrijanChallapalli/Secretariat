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
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-1.5 text-center text-sm text-amber-200">
          Connect button needs a WalletConnect project ID. Add <code className="bg-black/20 px-1 rounded">NEXT_PUBLIC_WALLETCONNECT_ID</code> (32 chars) from{" "}
          <a href="https://cloud.walletconnect.com" target="_blank" rel="noopener noreferrer" className="underline">cloud.walletconnect.com</a> to your <code className="bg-black/20 px-1 rounded">.env</code> and rebuild. MetaMask still works via &quot;Injected&quot; in the modal.
        </div>
      )}
      <header className="border-b border-track-600 bg-track-800/80 sticky top-0 z-50 backdrop-blur">
        <div className="container mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-semibold text-gold-400 tracking-tight">
            Secretariat
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/marketplace" className="text-stone-300 hover:text-white">
              Marketplace
            </Link>
            <Link href="/portfolio" className="text-stone-300 hover:text-white">
              Portfolio
            </Link>
            <Link href="/agent" className="text-stone-300 hover:text-white">
              Agent
            </Link>
            <Link href="/admin" className="text-stone-500 hover:text-stone-400 text-sm">
              Admin
            </Link>
            <span className="text-sm text-stone-500">
              {chainNames[chainId] ?? `Chain ${chainId}`}
            </span>
            <ConnectButton />
          </nav>
        </div>
      </header>
    </>
  );
}

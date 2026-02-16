import Link from "next/link";

export default function Landing() {
  return (
    <div className="max-w-4xl mx-auto text-center py-16">
      <h1 className="text-4xl md:text-6xl font-bold text-gold-400 mb-6">
        Secretariat
      </h1>
      <p className="text-xl text-stone-300 mb-4">
        Decentralized thoroughbred RWA marketplace. Tokenize horses, trade breeding rights, and fractionalize ownership.
      </p>
      <p className="text-stone-500 mb-12">
        Powered by on-chain agent recommendations and dual deployment on 0G and ADI.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href="/marketplace"
          className="px-6 py-3 rounded-lg bg-gold-500 text-track-800 font-medium hover:bg-gold-400 transition"
        >
          Browse horses
        </Link>
        <Link
          href="/portfolio"
          className="px-6 py-3 rounded-lg border border-gold-500/50 text-gold-400 hover:bg-gold-500/10 transition"
        >
          My portfolio
        </Link>
        <Link
          href="/agent"
          className="px-6 py-3 rounded-lg border border-stone-500 text-stone-300 hover:bg-track-700 transition"
        >
          Breeding Advisor
        </Link>
      </div>
    </div>
  );
}

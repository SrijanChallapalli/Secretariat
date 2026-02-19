"use client";

const EmptyMessage = ({ children }: { children: string }) => (
  <p className="text-xs text-muted-foreground py-3">{children}</p>
);

export default function LiveFeed() {
  return (
    <div className="p-5 space-y-8 font-sans text-brand-ivory">
      <section>
        <h3 className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-prestige-gold" />
          Live Oracle Feed
        </h3>
        <EmptyMessage>No oracle events on chain yet.</EmptyMessage>
      </section>

      <section>
        <h3 className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Breeding Activity
        </h3>
        <EmptyMessage>No breeding activity on chain yet.</EmptyMessage>
      </section>

      <section>
        <h3 className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Revenue Events
        </h3>
        <EmptyMessage>No revenue events on chain yet.</EmptyMessage>
      </section>
    </div>
  );
}

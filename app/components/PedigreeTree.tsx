"use client";

import { useState, useEffect } from "react";
import { buildPedigreeTree, type PedigreeNode } from "@/lib/pedigree";
import { getPdfPedigreeByName, isPdfPedigreeId } from "@/lib/pdf-pedigree-data";
import Link from "next/link";

interface PedigreeTreeProps {
  tokenId?: number;
  pedigreeNode?: PedigreeNode | null;
  horseName?: string;
  maxDepth?: number;
}

export function PedigreeTree({
  tokenId = -1,
  pedigreeNode: pedigreeNodeProp,
  horseName,
  maxDepth = 5,
}: PedigreeTreeProps) {
  const [pedigree, setPedigree] = useState<PedigreeNode | null>(
    pedigreeNodeProp ?? null
  );
  const [loading, setLoading] = useState(!pedigreeNodeProp);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pedigreeNodeProp != null) {
      setPedigree(pedigreeNodeProp);
      setLoading(false);
      setError(null);
      return;
    }

    const pdfTree = horseName ? getPdfPedigreeByName(horseName) : null;
    if (pdfTree) {
      setPedigree(pdfTree);
      setLoading(false);
      setError(null);
      return;
    }

    async function loadPedigree() {
      setLoading(true);
      setError(null);
      try {
        const tree = await buildPedigreeTree(tokenId, maxDepth);
        setPedigree(tree);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load pedigree");
      } finally {
        setLoading(false);
      }
    }

    if (tokenId >= 0) {
      loadPedigree();
    } else {
      setLoading(false);
      setPedigree(null);
    }
  }, [tokenId, maxDepth, pedigreeNodeProp, horseName]);

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground p-4 text-center">
        Loading pedigree tree…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-destructive p-4 text-center">{error}</div>
    );
  }

  if (!pedigree) {
    return (
      <div className="text-xs text-muted-foreground p-4 text-center">
        No pedigree data found
      </div>
    );
  }

  const isStatic = pedigree ? isPdfPedigreeId(pedigree.tokenId) : false;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground tracking-wide">
          Pedigree Tree
          {isStatic && (
            <span className="ml-2 text-[10px] text-muted-foreground font-normal">
              (from PDF)
            </span>
          )}
        </h3>
        <span className="text-[10px] text-muted-foreground">
          ← scroll →
        </span>
      </div>
      <div className="overflow-x-auto overflow-y-auto max-h-[480px] pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="inline-flex min-w-max">
          <HorizontalNode node={pedigree} staticMode={isStatic} isRoot />
        </div>
      </div>
    </div>
  );
}

function NodeCard({
  node,
  staticMode,
  label,
  isRoot,
}: {
  node: PedigreeNode;
  staticMode: boolean;
  label?: string;
  isRoot?: boolean;
}) {
  const linkable =
    !staticMode && !isPdfPedigreeId(node.tokenId) && node.tokenId > 0;

  const rootStyle = isRoot
    ? "border-prestige-gold/50 bg-prestige-gold/5 ring-1 ring-prestige-gold/20"
    : "border-border bg-card";

  const inner = (
    <div className={`px-2.5 py-1.5 rounded border ${rootStyle} text-left w-[130px] shrink-0`}>
      {label && (
        <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70 block mb-0.5">
          {label}
        </span>
      )}
      <p className="text-[11px] font-medium text-foreground truncate leading-tight">
        {node.name || `Horse #${node.tokenId}`}
      </p>
      <p className="text-[9px] text-muted-foreground font-mono">
        #{node.tokenId}
      </p>
      <p className="text-[9px] text-muted-foreground">
        Ped {(node.pedigreeScore / 100).toFixed(0)}%
        {node.generation > 0 && <span className="ml-1">· G{node.generation}</span>}
      </p>
    </div>
  );

  if (linkable) {
    return (
      <Link
        href={`/horse/${node.tokenId}`}
        className="hover:brightness-125 transition-all block"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

function PlaceholderCard({ label, id }: { label: string; id?: number }) {
  return (
    <div className="px-2.5 py-1.5 rounded border border-dashed border-border bg-secondary/20 text-left w-[130px] shrink-0">
      <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70 block mb-0.5">
        {label}
      </span>
      <p className="text-[9px] text-muted-foreground">
        {id && id > 0 ? `#${id}` : "Founder"}
      </p>
    </div>
  );
}

function HorizontalNode({
  node,
  staticMode,
  isRoot,
  label,
}: {
  node: PedigreeNode;
  staticMode: boolean;
  isRoot?: boolean;
  label?: string;
}) {
  const hasAncestors = node.sire || node.dam || node.sireId > 0 || node.damId > 0;

  return (
    <div className="flex items-center">
      <NodeCard node={node} staticMode={staticMode} label={label} isRoot={isRoot} />

      {hasAncestors && (
        <>
          {/* Horizontal connector from card to branch */}
          <div className="w-4 h-px bg-border shrink-0" />

          {/* Vertical bracket + children */}
          <div className="flex flex-col gap-1 relative">
            {/* Vertical line connecting sire & dam rows */}
            <div className="absolute left-0 top-1/4 bottom-1/4 w-px bg-border" />

            {/* Sire branch */}
            <div className="flex items-center">
              <div className="w-3 h-px bg-border shrink-0" />
              {node.sire ? (
                <HorizontalNode
                  node={node.sire}
                  staticMode={staticMode}
                  label="Sire"
                />
              ) : (
                <PlaceholderCard label="Sire" id={node.sireId} />
              )}
            </div>

            {/* Dam branch */}
            <div className="flex items-center">
              <div className="w-3 h-px bg-border shrink-0" />
              {node.dam ? (
                <HorizontalNode
                  node={node.dam}
                  staticMode={staticMode}
                  label="Dam"
                />
              ) : (
                <PlaceholderCard label="Dam" id={node.damId} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

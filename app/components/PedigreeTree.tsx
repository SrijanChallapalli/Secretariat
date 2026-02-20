"use client";

import { useState, useEffect } from "react";
import { buildPedigreeTree, type PedigreeNode } from "@/lib/pedigree";
import { getPdfPedigreeByName, isPdfPedigreeId } from "@/lib/pdf-pedigree-data";
import Link from "next/link";

interface PedigreeTreeProps {
  /** On-chain token ID; used when pedigreeNode is not provided */
  tokenId?: number;
  /** Pre-built pedigree tree (e.g. from PDF data). When provided, tokenId is ignored. */
  pedigreeNode?: PedigreeNode | null;
  /** Horse name for PDF pedigree lookup when on-chain data is missing */
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
        Loading pedigree tree...
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
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-foreground tracking-wide">
        Pedigree Tree (Traces full inheritance lineage)
        {isStatic && (
          <span className="ml-2 text-[10px] text-muted-foreground font-normal">
            (from PDF)
          </span>
        )}
      </h3>
      <div className="overflow-x-auto">
        <PedigreeNodeComponent node={pedigree} staticMode={isStatic} />
      </div>
    </div>
  );
}

function PedigreeNodeComponent({
  node,
  staticMode = false,
}: {
  node: PedigreeNode;
  staticMode?: boolean;
}) {
  const hasAncestors = node.sire || node.dam;
  const linkable =
    !staticMode && !isPdfPedigreeId(node.tokenId) && node.tokenId > 0;

  const cardClass =
    "px-3 py-2 rounded-sm border border-border bg-card text-center min-w-[140px]";
  const cardInner = (
    <>
      <p className="text-xs font-medium text-foreground truncate">
        {node.name || `Horse #${node.tokenId}`}
      </p>
      <p className="text-[10px] text-muted-foreground font-mono">
        #{node.tokenId}
      </p>
      <p className="text-[10px] text-muted-foreground">
        Pedigree: {(node.pedigreeScore / 100).toFixed(1)}%
      </p>
      {node.generation > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Gen {node.generation}
        </p>
      )}
    </>
  );

  return (
    <div className="flex flex-col items-center space-y-2">
      {linkable ? (
        <Link
          href={`/horse/${node.tokenId}`}
          className={`${cardClass} hover:bg-secondary/80 transition-colors block`}
        >
          {cardInner}
        </Link>
      ) : (
        <div className={cardClass}>{cardInner}</div>
      )}

      {/* Ancestors */}
      {hasAncestors && (
        <div className="flex gap-4 items-start">
          {/* Sire (left) */}
          <div className="flex flex-col items-center space-y-2">
            {node.sire ? (
              <>
                <div className="w-px h-4 bg-border" />
                <div className="text-[10px] text-muted-foreground">Sire</div>
                <PedigreeNodeComponent
                  node={node.sire}
                  staticMode={staticMode}
                />
              </>
            ) : node.sireId > 0 ? (
              <div className="px-2 py-1 rounded-sm border border-dashed border-border bg-secondary/30 text-center min-w-[120px]">
                <p className="text-[10px] text-muted-foreground">
                  Sire #{node.sireId}
                </p>
                <p className="text-[9px] text-muted-foreground">Not loaded</p>
              </div>
            ) : (
              <div className="px-2 py-1 rounded-sm border border-dashed border-border bg-secondary/30 text-center min-w-[120px]">
                <p className="text-[10px] text-muted-foreground">Founder</p>
              </div>
            )}
          </div>

          {/* Dam (right) */}
          <div className="flex flex-col items-center space-y-2">
            {node.dam ? (
              <>
                <div className="w-px h-4 bg-border" />
                <div className="text-[10px] text-muted-foreground">Dam</div>
                <PedigreeNodeComponent
                  node={node.dam}
                  staticMode={staticMode}
                />
              </>
            ) : node.damId > 0 ? (
              <div className="px-2 py-1 rounded-sm border border-dashed border-border bg-secondary/30 text-center min-w-[120px]">
                <p className="text-[10px] text-muted-foreground">
                  Dam #{node.damId}
                </p>
                <p className="text-[9px] text-muted-foreground">Not loaded</p>
              </div>
            ) : (
              <div className="px-2 py-1 rounded-sm border border-dashed border-border bg-secondary/30 text-center min-w-[120px]">
                <p className="text-[10px] text-muted-foreground">Founder</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

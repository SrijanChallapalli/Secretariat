/**
 * Mint → Portfolio flow tests.
 * Verifies parseRawHorseData, isOnChainHorse, owner comparison, and Bred event decoding.
 */
import { describe, it, expect } from "vitest";
import { decodeEventLog, parseAbiItem, keccak256, toHex } from "viem";
import { isOnChainHorse } from "@/lib/on-chain-horses";
import { parseRawHorseData } from "@/lib/on-chain-mapping";

const BRED_EVENT = parseAbiItem(
  "event Bred(uint256 indexed stallionId, uint256 indexed mareId, uint256 indexed offspringId)"
);

describe("portfolio-mint", () => {
  describe("isOnChainHorse", () => {
    it("returns true for horse with non-empty name", () => {
      expect(isOnChainHorse({ name: "Secretariat", birthTimestamp: 0 })).toBe(true);
      expect(isOnChainHorse({ name: "  Storm Cat  ", birthTimestamp: 0n })).toBe(true);
    });

    it("returns true for horse with birthTimestamp > 0", () => {
      expect(isOnChainHorse({ name: "", birthTimestamp: 1 })).toBe(true);
      expect(isOnChainHorse({ name: "", birthTimestamp: 1735689600n })).toBe(true);
    });

    it("returns false for empty/default horse data", () => {
      expect(isOnChainHorse({ name: "", birthTimestamp: 0 })).toBe(false);
      expect(isOnChainHorse({})).toBe(false);
      expect(isOnChainHorse(null)).toBe(false);
    });

    it("handles tuple-style result (indexed fields)", () => {
      expect(isOnChainHorse({ 0: "Galileos Edge", 1: 1735689600 })).toBe(true);
      expect(isOnChainHorse({ 0: "", 1: 0 })).toBe(false);
    });
  });

  describe("parseRawHorseData", () => {
    it("parses valid horse data", () => {
      const result = parseRawHorseData({
        name: "Secretariat",
        birthTimestamp: 1735689600n,
        sireId: 0n,
        damId: 0n,
        traitVector: [85, 92, 78, 88, 95, 80, 90, 85],
        pedigreeScore: 9400,
        valuationADI: 8000n * BigInt(1e18),
        dnaHash: "0x1234",
        breedingAvailable: true,
        injured: false,
        retired: false,
      });
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Secretariat");
      expect(result?.birthTimestamp).toBe(1735689600n);
      expect(result?.pedigreeScore).toBe(9400);
    });

    it("returns null for empty/invalid data", () => {
      expect(parseRawHorseData({ name: "", birthTimestamp: 0n })).toBeNull();
      expect(parseRawHorseData(null)).toBeNull();
    });

    it("handles tuple-style (indexed) result", () => {
      const result = parseRawHorseData({
        0: "Offspring",
        1: 1735689600n,
        2: 0n,
        3: 1n,
      });
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Offspring");
      expect(result?.birthTimestamp).toBe(1735689600n);
    });
  });

  describe("owner comparison (lowercase)", () => {
    it("matches checksummed addresses when lowercased", () => {
      const owner = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      const me = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
      expect(String(owner).toLowerCase() === String(me).toLowerCase()).toBe(true);
    });

    it("rejects different addresses", () => {
      const owner = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      const me = "0x0000000000000000000000000000000000000001";
      expect(String(owner).toLowerCase() === String(me).toLowerCase()).toBe(false);
    });
  });

  describe("Bred event decoding", () => {
    it("decodes Bred event from log topics and data", () => {
      const eventSigHash = keccak256(toHex("Bred(uint256,uint256,uint256)"));
      const topics = [
        eventSigHash,
        "0x" + "00".repeat(31) + "01",
        "0x" + "00".repeat(31) + "02",
        "0x" + "00".repeat(31) + "03",
      ] as readonly `0x${string}`[];
      const data = "0x" as `0x${string}`;
      const decoded = decodeEventLog({
        abi: [BRED_EVENT],
        data,
        topics,
      });
      expect(decoded.eventName).toBe("Bred");
      expect(Number(decoded.args.stallionId)).toBe(1);
      expect(Number(decoded.args.mareId)).toBe(2);
      expect(Number(decoded.args.offspringId)).toBe(3);
    });
  });

  describe("portfolio includes minted horse", () => {
    it("myHorses includes tokenId when owner matches", () => {
      const existingHorseIds = [0, 1, 2, 3];
      const ownershipResults = [
        { status: "success" as const, result: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" },
        { status: "success" as const, result: "0x0000000000000000000000000000000000000001" },
        { status: "success" as const, result: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" },
        { status: "success" as const, result: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" },
      ];
      const address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      const myHorses = ownershipResults
        .map((c, i) => {
          if (c.status !== "success" || !c.result || !address) return -1;
          const owner = String(c.result).toLowerCase();
          const me = String(address).toLowerCase();
          return owner === me ? existingHorseIds[i] : -1;
        })
        .filter((i) => i >= 0);
      expect(myHorses).toContain(0);
      expect(myHorses).toContain(2);
      expect(myHorses).toContain(3);
      expect(myHorses).not.toContain(1);
    });
  });
});

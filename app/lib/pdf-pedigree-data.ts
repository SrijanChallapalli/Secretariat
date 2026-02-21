/**
 * Static pedigree data parsed from PDFs in pdf-data/.
 * Keyed by normalized horse name for lookup when on-chain data is missing.
 *
 * Data extracted from contracts/PDF-Data/ pedigree PDFs (SporthorseData format).
 * Synthetic tokenIds: 10000+ range to avoid collision with on-chain IDs.
 */

import type { PedigreeNode } from "./pedigree";

const SYNTHETIC_BASE = 10000;

function node(
  id: number,
  name: string,
  sire: PedigreeNode | null,
  dam: PedigreeNode | null,
  gen: number,
  score = 8500
): PedigreeNode {
  return {
    tokenId: SYNTHETIC_BASE + id,
    name,
    sireId: sire ? sire.tokenId : 0,
    damId: dam ? dam.tokenId : 0,
    pedigreeScore: score,
    generation: gen,
    sire: sire ?? null,
    dam: dam ?? null,
  };
}

function founder(id: number, name: string, gen: number): PedigreeNode {
  return node(id, name, null, null, gen, 7500);
}

// --- Secretariat (1970): Bold Ruler x Somethingroyal ---
const sec_1 = founder(101, "Nearco", 4);
const sec_2 = founder(102, "Mumtaz Begum", 4);
const sec_3 = founder(103, "Discovery", 4);
const sec_4 = founder(104, "Outdone", 4);
const sec_5 = founder(105, "Prince Rose", 4);
const sec_6 = founder(106, "Cosquilla", 4);
const sec_7 = founder(107, "Caruso", 4);
const sec_8 = founder(108, "Cinquepace", 4);

const sec_9 = node(109, "Nasrullah", sec_1, sec_2, 3);
const sec_10 = node(110, "Miss Disco", sec_3, sec_4, 3);
const sec_11 = node(111, "Princequillo", sec_5, sec_6, 3);
const sec_12 = node(112, "Imperatrice", sec_7, sec_8, 3);

const sec_13 = node(113, "Bold Ruler", sec_9, sec_10, 2, 9200);
const sec_14 = node(114, "Somethingroyal", sec_11, sec_12, 2, 8800);

const SECRETARIAT = node(100, "Secretariat", sec_13, sec_14, 1, 9800);

// --- Frankel (2008): Galileo x Kind ---
const fr_1 = founder(201, "Northern Dancer", 4);
const fr_2 = founder(202, "Fairy Bridge", 4);
const fr_3 = founder(203, "Mr. Prospector", 4);
const fr_4 = founder(204, "Hopespringseternal", 4);
const fr_5 = founder(205, "Danzig", 4);
const fr_6 = founder(206, "Razyana", 4);
const fr_7 = founder(207, "Rainbow Quest", 4);
const fr_8 = founder(208, "Rockfest", 4);

const fr_9 = node(209, "Sadler's Wells", fr_1, fr_2, 3);
const fr_10 = node(210, "Urban Sea", fr_3, fr_4, 3);
const fr_11 = node(211, "Danehill", fr_5, fr_6, 3);
const fr_12 = node(212, "Rainbow Lake", fr_7, fr_8, 3);

const fr_13 = node(213, "Galileo", fr_9, fr_10, 2, 9500);
const fr_14 = node(214, "Kind", fr_11, fr_12, 2, 8600);

const FRANKEL = node(200, "Frankel", fr_13, fr_14, 1, 9900);

// --- Galileo (1998): Sadler's Wells x Urban Sea ---
const gal_1 = founder(301, "Northern Dancer", 4);
const gal_2 = founder(302, "Fairy Bridge", 4);
const gal_3 = founder(303, "Miswaki", 4);
const gal_4 = founder(304, "Allegretta", 4);

const gal_7 = node(307, "Sadler's Wells", gal_1, gal_2, 3);
const gal_8 = node(308, "Urban Sea", gal_3, gal_4, 3);

const GALILEO = node(300, "Galileo", gal_7, gal_8, 1, 9600);

// --- Seabiscuit (1933): Hard Tack x Swing On ---
const sea_1 = founder(401, "Man o' War", 4);
const sea_2 = founder(402, "Tea Biscuit", 4);
const sea_3 = founder(403, "Whisk Broom II", 4);
const sea_4 = founder(404, "Balance", 4);

const sea_5 = node(405, "Hard Tack", sea_1, sea_2, 3);
const sea_6 = node(406, "Swing On", sea_3, sea_4, 3);

const SEABISCUIT = node(400, "Seabiscuit", sea_5, sea_6, 1, 9400);

// --- Smarty Jones (2001): Elusive Quality x I'll Get Along ---
const sm_1 = founder(501, "Mr. Prospector", 4);
const sm_2 = founder(502, "Secretariat", 4);
const sm_3 = founder(503, "Smile", 4);
const sm_4 = founder(504, "Dam Line", 4);

const sm_7 = node(507, "Elusive Quality", sm_1, sm_2, 3);
const sm_8 = node(508, "I'll Get Along", sm_3, sm_4, 3);

const SMARTY_JONES = node(500, "Smarty Jones", sm_7, sm_8, 1, 9300);

// --- Dullahan (2009): Even The Score x Mining My Own ---
const dul_1 = founder(601, "Unbridled's Song", 4);
const dul_2 = founder(602, "Rahy", 4);
const dul_3 = founder(603, "Mr. Prospector", 4);
const dul_4 = founder(604, "Smart Strike", 4);

const dul_5 = node(605, "Even The Score", dul_1, dul_2, 3);
const dul_6 = node(606, "Mining My Own", dul_3, dul_4, 3);

const DULLAHAN = node(600, "Dullahan", dul_5, dul_6, 1, 9000);

// --- AP (American Pharoah, 2012): Pioneerof the Nile x Littleprincessemma ---
const ap_1 = founder(701, "Empire Maker", 4);
const ap_2 = founder(702, "Star of Goshen", 4);
const ap_3 = founder(703, "Yankee Gentleman", 4);
const ap_4 = founder(704, "Storm Cat", 4);

const ap_5 = node(705, "Pioneerof the Nile", ap_1, ap_2, 3);
const ap_6 = node(706, "Littleprincessemma", ap_3, ap_4, 3);

const AMERICAN_PHAROAH = node(700, "American Pharoah", ap_5, ap_6, 1, 9700);

// --- Sandman (from PDF) ---
const sand_1 = founder(801, "Sire Line", 4);
const sand_2 = founder(802, "Dam Line", 4);

const SANDMAN = node(800, "Sandman", sand_1, sand_2, 1, 8200);

// --- War Emblem (2000): Our Emblem x Sweetest Lady ---
const war_1 = founder(901, "Mr. Prospector", 4);
const war_2 = founder(902, "Personal Ensign", 4);
const war_3 = founder(903, "Lord At War", 4);
const war_4 = founder(904, "Sweetest Lady", 4);

const war_5 = node(905, "Our Emblem", war_1, war_2, 3);
const war_6 = node(906, "Sweetest Lady", war_3, war_4, 3);

const WAR_EMBLEM = node(900, "War Emblem", war_5, war_6, 1, 9100);

// ---------------------------------------------------------------------------
// Demo horse pedigrees (2 generations: parents + grandparents)
// Root nodes use real on-chain tokenIds so isPdfPedigreeId returns false.
// ---------------------------------------------------------------------------

function demoRoot(
  tokenId: number,
  name: string,
  sire: PedigreeNode | null,
  dam: PedigreeNode | null,
  score = 8500
): PedigreeNode {
  return {
    tokenId,
    name,
    sireId: sire ? sire.tokenId : 0,
    damId: dam ? dam.tokenId : 0,
    pedigreeScore: score,
    generation: 0,
    sire,
    dam,
  };
}

// --- Galileos Edge (token 0): Galileo (IRE) x Midnight Queen ---
const ge_gp1 = founder(1101, "Sadler's Wells", 2);
const ge_gp2 = founder(1102, "Urban Sea", 2);
const ge_gp3 = founder(1103, "King's Best", 2);
const ge_gp4 = founder(1104, "Nocturne", 2);
const ge_s = node(1110, "Galileo (IRE)", ge_gp1, ge_gp2, 1, 9500);
const ge_d = node(1111, "Midnight Queen", ge_gp3, ge_gp4, 1, 8800);
const GALILEOS_EDGE = demoRoot(0, "Galileos Edge", ge_s, ge_d, 9400);

// --- Storm Cat Lady (token 1): Storm Cat (USA) x Royal Duchess ---
const sc_gp1 = founder(1121, "Storm Bird", 2);
const sc_gp2 = founder(1122, "Terlingua", 2);
const sc_gp3 = founder(1123, "Deputy Minister", 2);
const sc_gp4 = founder(1124, "Erin's Love", 2);
const sc_s = node(1130, "Storm Cat (USA)", sc_gp1, sc_gp2, 1, 9200);
const sc_d = node(1131, "Royal Duchess", sc_gp3, sc_gp4, 1, 8400);
const STORM_CAT_LADY = demoRoot(1, "Storm Cat Lady", sc_s, sc_d, 8600);

// --- First Mission Colt (token 2): First Mission (USA) x Celtic Dawn ---
const fm_gp1 = founder(1141, "Unbridled", 2);
const fm_gp2 = founder(1142, "Clever Trick", 2);
const fm_gp3 = founder(1143, "Danehill", 2);
const fm_gp4 = founder(1144, "Highland Lass", 2);
const fm_s = node(1150, "First Mission (USA)", fm_gp1, fm_gp2, 1, 8800);
const fm_d = node(1151, "Celtic Dawn", fm_gp3, fm_gp4, 1, 8200);
const FIRST_MISSION_COLT = demoRoot(2, "First Mission Colt", fm_s, fm_d, 8200);

// --- Thunder Strike (token 3): Frankel (GB) x Stormy Skies ---
const ts_gp1 = founder(1161, "Galileo (GB)", 2);
const ts_gp2 = founder(1162, "Kind", 2);
const ts_gp3 = founder(1163, "Monsun", 2);
const ts_gp4 = founder(1164, "Sky Goddess", 2);
const ts_s = node(1170, "Frankel (GB)", ts_gp1, ts_gp2, 1, 9900);
const ts_d = node(1171, "Stormy Skies", ts_gp3, ts_gp4, 1, 8600);
const THUNDER_STRIKE = demoRoot(3, "Thunder Strike", ts_s, ts_d, 9100);

// --- Midnight Runner (token 4): Dubawi (IRE) x Moonlight Sonata ---
const mr_gp1 = founder(1181, "Dubai Millennium", 2);
const mr_gp2 = founder(1182, "Zomaradah", 2);
const mr_gp3 = founder(1183, "Montjeu", 2);
const mr_gp4 = founder(1184, "Silver Dream", 2);
const mr_s = node(1190, "Dubawi (IRE)", mr_gp1, mr_gp2, 1, 9400);
const mr_d = node(1191, "Moonlight Sonata", mr_gp3, mr_gp4, 1, 8500);
const MIDNIGHT_RUNNER = demoRoot(4, "Midnight Runner", mr_s, mr_d, 8800);

// --- Golden Dawn (token 5): Medaglia d'Oro (USA) x Autumn Gold ---
const gd_gp1 = founder(1201, "El Prado", 2);
const gd_gp2 = founder(1202, "Cappucino Bay", 2);
const gd_gp3 = founder(1203, "Seeking the Gold", 2);
const gd_gp4 = founder(1204, "Harvest Dance", 2);
const gd_s = node(1210, "Medaglia d'Oro (USA)", gd_gp1, gd_gp2, 1, 9100);
const gd_d = node(1211, "Autumn Gold", gd_gp3, gd_gp4, 1, 8300);
const GOLDEN_DAWN = demoRoot(5, "Golden Dawn", gd_s, gd_d, 8500);

// --- Silver Bullet (token 6): Speightstown (USA) x Silver Lining ---
const sb_gp1 = founder(1221, "Gone West", 2);
const sb_gp2 = founder(1222, "Silken Cat", 2);
const sb_gp3 = founder(1223, "Silver Hawk", 2);
const sb_gp4 = founder(1224, "Crystal Clear", 2);
const sb_s = node(1230, "Speightstown (USA)", sb_gp1, sb_gp2, 1, 9000);
const sb_d = node(1231, "Silver Lining", sb_gp3, sb_gp4, 1, 8400);
const SILVER_BULLET = demoRoot(6, "Silver Bullet", sb_s, sb_d, 8700);

// --- Ocean Breeze (token 7): Sea The Stars (IRE) x Coral Reef ---
const ob_gp1 = founder(1241, "Cape Cross", 2);
const ob_gp2 = founder(1242, "Urban Sea", 2);
const ob_gp3 = founder(1243, "Pivotal", 2);
const ob_gp4 = founder(1244, "Sea Coral", 2);
const ob_s = node(1250, "Sea The Stars (IRE)", ob_gp1, ob_gp2, 1, 9300);
const ob_d = node(1251, "Coral Reef", ob_gp3, ob_gp4, 1, 8100);
const OCEAN_BREEZE = demoRoot(7, "Ocean Breeze", ob_s, ob_d, 8300);

/** All PDF pedigrees keyed by normalized name */
const PEDIGREES: Record<string, PedigreeNode> = {
  secretariat: SECRETARIAT,
  frankel: FRANKEL,
  galileo: GALILEO,
  seabiscuit: SEABISCUIT,
  "smarty jones": SMARTY_JONES,
  smartyjones: SMARTY_JONES,
  dullahan: DULLAHAN,
  "american pharoah": AMERICAN_PHAROAH,
  americanpharoah: AMERICAN_PHAROAH,
  ap: AMERICAN_PHAROAH,
  sandman: SANDMAN,
  "war emblem": WAR_EMBLEM,
  waremblem: WAR_EMBLEM,
  // Demo horses (keys are normalized: lowercase, no spaces)
  galileosedge: GALILEOS_EDGE,
  stormcatlady: STORM_CAT_LADY,
  firstmissioncolt: FIRST_MISSION_COLT,
  thunderstrike: THUNDER_STRIKE,
  midnightrunner: MIDNIGHT_RUNNER,
  goldendawn: GOLDEN_DAWN,
  silverbullet: SILVER_BULLET,
  oceanbreeze: OCEAN_BREEZE,
};

/** Normalize horse name for lookup (lowercase, collapse spaces, handle typos) */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s/g, "")
    .trim();
}

/** Variant spellings (e.g. PDF filename "Secretairat") */
const NAME_ALIASES: Record<string, string> = {
  secretairat: "secretariat",
  secretiariat: "secretariat",
  calichrome: "california chrome",
  "cali chrome": "california chrome",
};

/**
 * Look up a pedigree tree by horse name.
 * Returns the root PedigreeNode if found, null otherwise.
 */
export function getPdfPedigreeByName(horseName: string): PedigreeNode | null {
  if (!horseName || typeof horseName !== "string") return null;
  const key = NAME_ALIASES[normalizeName(horseName)] ?? normalizeName(horseName);
  return PEDIGREES[key] ?? null;
}

/**
 * Check if a tokenId is from PDF pedigree (synthetic).
 */
export function isPdfPedigreeId(tokenId: number): boolean {
  return tokenId >= SYNTHETIC_BASE && tokenId < SYNTHETIC_BASE + 2000;
}

/**
 * List all horse names that have PDF pedigree data.
 */
export function getPdfPedigreeHorseNames(): string[] {
  const seen = new Set<string>();
  return [
    "Secretariat",
    "Frankel",
    "Galileo",
    "Seabiscuit",
    "Smarty Jones",
    "Dullahan",
    "American Pharoah",
    "Sandman",
    "War Emblem",
  ].filter((n) => {
    const k = normalizeName(n);
    if (seen.has(k)) return false;
    seen.add(k);
    return PEDIGREES[k] != null;
  });
}

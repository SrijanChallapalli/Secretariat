/**
 * Lightweight XGBoost tree-walking predictor for Node.js.
 * Reads the model.json and feature_config.json exported by train_xgboost.py.
 * No native dependencies — pure TypeScript.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface TreeNode {
  leftChildren: number[];
  rightChildren: number[];
  splitIndices: number[];
  splitConditions: number[];
  baseWeights: number[];
}

interface XGBModel {
  trees: TreeNode[];
  baseScore: number;
}

export interface FeatureConfig {
  features: string[];
  target: string;
  targetTransform: string;
  sexMap: Record<string, number>;
  sireClasses: string[];
  damsireClasses: string[];
  sireTargetEncoding: Record<string, number>;
  damsireTargetEncoding: Record<string, number>;
}

let cachedModel: XGBModel | null = null;
let cachedConfig: FeatureConfig | null = null;

function loadModel(modelPath: string): XGBModel {
  const raw = JSON.parse(fs.readFileSync(modelPath, "utf-8"));
  const learner = raw.learner;
  const baseScoreStr = learner.learner_model_param.base_score;
  const baseScore = parseFloat(baseScoreStr.replace(/[\[\]E]/g, (m: string) => m === "E" ? "e" : ""));

  const rawTrees = learner.gradient_booster.model.trees;
  const trees: TreeNode[] = rawTrees.map((t: any) => ({
    leftChildren: t.left_children,
    rightChildren: t.right_children,
    splitIndices: t.split_indices,
    splitConditions: t.split_conditions,
    baseWeights: t.base_weights,
  }));

  return { trees, baseScore };
}

function loadConfig(configPath: string): FeatureConfig {
  const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  return {
    features: raw.features,
    target: raw.target,
    targetTransform: raw.target_transform,
    sexMap: raw.sex_map,
    sireClasses: raw.sire_classes,
    damsireClasses: raw.damsire_classes,
    sireTargetEncoding: raw.sire_target_encoding,
    damsireTargetEncoding: raw.damsire_target_encoding,
  };
}

function predictTree(tree: TreeNode, features: number[]): number {
  let nodeIdx = 0;
  while (tree.leftChildren[nodeIdx] !== -1) {
    const featureIdx = tree.splitIndices[nodeIdx];
    const threshold = tree.splitConditions[nodeIdx];
    const featureVal = features[featureIdx] ?? 0;

    if (featureVal < threshold) {
      nodeIdx = tree.leftChildren[nodeIdx];
    } else {
      nodeIdx = tree.rightChildren[nodeIdx];
    }
  }
  return tree.baseWeights[nodeIdx];
}

function predictRaw(model: XGBModel, features: number[]): number {
  let sum = model.baseScore;
  for (const tree of model.trees) {
    sum += predictTree(tree, features);
  }
  return sum;
}

export interface HorseInput {
  raceCount?: number;
  winCount?: number;
  placeCount?: number;
  avgPosition?: number;
  stdPosition?: number;
  bestPosition?: number;
  worstPosition?: number;
  avgNormPosition?: number;
  avgFieldSize?: number;
  avgSp?: number;
  minSp?: number;
  avgWeight?: number;
  avgDistance?: number;
  stdDistance?: number;
  avgOfficialRating?: number;
  maxOfficialRating?: number;
  age?: number;
  winRate?: number;
  placeRate?: number;
  avgClass?: number;
  bestClass?: number;
  goingPctFirm?: number;
  goingPctGood?: number;
  goingPctGoodToFirm?: number;
  goingPctGoodToSoft?: number;
  goingPctSoft?: number;
  surfacePctTurf?: number;
  sex?: string;
  sire?: string;
  damsire?: string;
}

function encodeSire(name: string | undefined, config: FeatureConfig): { encoded: number; avgPrize: number } {
  if (!name) return { encoded: config.sireClasses.indexOf("OTHER"), avgPrize: config.sireTargetEncoding["OTHER"] ?? 0 };
  const idx = config.sireClasses.indexOf(name);
  if (idx >= 0) {
    return { encoded: idx, avgPrize: config.sireTargetEncoding[name] ?? 0 };
  }
  const otherIdx = config.sireClasses.indexOf("OTHER");
  return { encoded: otherIdx >= 0 ? otherIdx : 0, avgPrize: config.sireTargetEncoding["OTHER"] ?? 0 };
}

function encodeDamsire(name: string | undefined, config: FeatureConfig): { encoded: number; avgPrize: number } {
  if (!name) return { encoded: config.damsireClasses.indexOf("OTHER"), avgPrize: config.damsireTargetEncoding["OTHER"] ?? 0 };
  const idx = config.damsireClasses.indexOf(name);
  if (idx >= 0) {
    return { encoded: idx, avgPrize: config.damsireTargetEncoding[name] ?? 0 };
  }
  const otherIdx = config.damsireClasses.indexOf("OTHER");
  return { encoded: otherIdx >= 0 ? otherIdx : 0, avgPrize: config.damsireTargetEncoding["OTHER"] ?? 0 };
}

function buildFeatureVector(input: HorseInput, config: FeatureConfig): number[] {
  const sexCode = config.sexMap[input.sex ?? "G"] ?? 2;
  const sire = encodeSire(input.sire, config);
  const damsire = encodeDamsire(input.damsire, config);

  const races = input.raceCount ?? 0;
  const wins = input.winCount ?? 0;
  const places = input.placeCount ?? 0;

  return [
    races,
    wins,
    places,
    input.avgPosition ?? 0,
    input.stdPosition ?? 0,
    input.bestPosition ?? 0,
    input.worstPosition ?? 0,
    input.avgNormPosition ?? 0,
    input.avgFieldSize ?? 0,
    input.avgSp ?? 0,
    input.minSp ?? 0,
    input.avgWeight ?? 0,
    input.avgDistance ?? 0,
    input.stdDistance ?? 0,
    input.avgOfficialRating ?? 0,
    input.maxOfficialRating ?? 0,
    input.age ?? 3,
    races > 0 ? (input.winRate ?? wins / Math.max(races, 1)) : 0,
    races > 0 ? (input.placeRate ?? places / Math.max(races, 1)) : 0,
    input.avgClass ?? 5,
    input.bestClass ?? 6,
    input.goingPctFirm ?? 0,
    input.goingPctGood ?? 0,
    input.goingPctGoodToFirm ?? 0,
    input.goingPctGoodToSoft ?? 0,
    input.goingPctSoft ?? 0,
    input.surfacePctTurf ?? 1,
    sexCode,
    sire.encoded,
    damsire.encoded,
    sire.avgPrize,
    damsire.avgPrize,
  ];
}

export class XGBoostPredictor {
  private model: XGBModel;
  private config: FeatureConfig;

  constructor(dataDir?: string) {
    const dir = dataDir ?? path.resolve(__dirname, "..", "data");
    const modelPath = path.join(dir, "model.json");
    const configPath = path.join(dir, "feature_config.json");

    if (!fs.existsSync(modelPath) || !fs.existsSync(configPath)) {
      throw new Error(`XGBoost model files not found in ${dir}`);
    }

    if (cachedModel && cachedConfig) {
      this.model = cachedModel;
      this.config = cachedConfig;
    } else {
      console.log(`Loading XGBoost model from ${dir}...`);
      this.model = loadModel(modelPath);
      this.config = loadConfig(configPath);
      cachedModel = this.model;
      cachedConfig = this.config;
      console.log(`  ${this.model.trees.length} trees loaded, base_score=${this.model.baseScore.toFixed(4)}`);
    }
  }

  predict(input: HorseInput): number {
    const features = buildFeatureVector(input, this.config);
    const logPred = predictRaw(this.model, features);
    return Math.expm1(logPred);
  }

  getConfig(): FeatureConfig {
    return this.config;
  }

  treeCount(): number {
    return this.model.trees.length;
  }
}

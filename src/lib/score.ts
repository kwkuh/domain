// Deterministic, no-LLM scoring heuristics for brandability / liquidity.

const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

const PREMIUM_TLDS = new Set(["com", "ai", "io", "co", "app"]);
const GOOD_TLDS = new Set(["net", "org", "dev", "xyz", "id", "so", "bot", "md"]);

const HOT_KEYWORDS = [
  "ai", "gpt", "llm", "agent", "bot", "cloud", "crypto", "web3", "nft",
  "defi", "fin", "pay", "bank", "wallet", "chain", "shop", "store", "buy",
  "sell", "market", "trade", "data", "lab", "studio", "hub", "app", "io",
  "dev", "cyber", "secure", "vault", "stack", "code", "soft", "media",
];

export type Score = {
  total: number;
  length: number;
  brandability: number;
  vowelRatio: number;
  pronounce: number;
  tld: number;
  keyword: number;
  hasHyphen: boolean;
  hasNumber: boolean;
};

export function scoreDomain(domain: string): Score {
  const lc = domain.toLowerCase();
  const [sld, ...tldParts] = lc.split(".");
  const tld = tldParts.join(".");

  const hasHyphen = sld.includes("-");
  const hasNumber = /[0-9]/.test(sld);

  // Length score: 4-7 chars best
  const len = sld.length;
  let lengthScore = 0;
  if (len >= 4 && len <= 7) lengthScore = 100;
  else if (len === 3 || len === 8) lengthScore = 80;
  else if (len <= 10) lengthScore = 60;
  else if (len <= 12) lengthScore = 40;
  else lengthScore = 20;

  // Vowel ratio: 0.3-0.5 ideal
  const letters = sld.replace(/[^a-z]/g, "");
  const vowels = [...letters].filter((c) => VOWELS.has(c)).length;
  const vowelRatio = letters.length ? vowels / letters.length : 0;
  let vowelScore = 0;
  if (vowelRatio >= 0.3 && vowelRatio <= 0.5) vowelScore = 100;
  else if (vowelRatio >= 0.25 && vowelRatio <= 0.55) vowelScore = 70;
  else if (vowelRatio >= 0.2 && vowelRatio <= 0.6) vowelScore = 50;
  else vowelScore = 25;

  // Pronounceability: penalize consonant clusters >3
  let maxClust = 0;
  let clust = 0;
  for (const c of letters) {
    if (!VOWELS.has(c)) {
      clust++;
      maxClust = Math.max(maxClust, clust);
    } else clust = 0;
  }
  let pronounceScore = 100;
  if (maxClust >= 4) pronounceScore = 30;
  else if (maxClust === 3) pronounceScore = 60;
  else if (maxClust === 2) pronounceScore = 85;

  // TLD weight
  let tldScore = 30;
  if (PREMIUM_TLDS.has(tld)) tldScore = 100;
  else if (GOOD_TLDS.has(tld)) tldScore = 70;

  // Keyword presence
  let keywordScore = 0;
  for (const kw of HOT_KEYWORDS) {
    if (sld.includes(kw)) {
      keywordScore = Math.max(keywordScore, 100 - Math.min(80, (sld.length - kw.length) * 5));
    }
  }

  // Hyphen/number penalty
  const penalty = (hasHyphen ? 25 : 0) + (hasNumber ? 15 : 0);

  // Brandability = pronounceability + vowel balance + short length
  const brandability = Math.round(
    (pronounceScore * 0.4 + vowelScore * 0.3 + lengthScore * 0.3) - penalty,
  );

  const total = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        lengthScore * 0.2 +
          vowelScore * 0.1 +
          pronounceScore * 0.15 +
          tldScore * 0.25 +
          keywordScore * 0.15 +
          brandability * 0.15 -
          penalty,
      ),
    ),
  );

  return {
    total,
    length: lengthScore,
    brandability: Math.max(0, Math.min(100, brandability)),
    vowelRatio: Math.round(vowelRatio * 100) / 100,
    pronounce: pronounceScore,
    tld: tldScore,
    keyword: keywordScore,
    hasHyphen,
    hasNumber,
  };
}

// --- Similarity engine: typo / plural / hyphen variants ---

export function typoVariants(sld: string): string[] {
  const out = new Set<string>();
  const chars = [..."abcdefghijklmnopqrstuvwxyz"];
  for (let i = 0; i < sld.length; i++) {
    // deletion
    out.add(sld.slice(0, i) + sld.slice(i + 1));
    // transposition
    if (i < sld.length - 1) {
      out.add(sld.slice(0, i) + sld[i + 1] + sld[i] + sld.slice(i + 2));
    }
    // substitution
    for (const c of chars) {
      if (c !== sld[i]) out.add(sld.slice(0, i) + c + sld.slice(i + 1));
    }
  }
  // insertion
  for (let i = 0; i <= sld.length; i++) {
    for (const c of chars) out.add(sld.slice(0, i) + c + sld.slice(i));
  }
  out.delete(sld);
  return [...out].slice(0, 200);
}

export function pluralVariant(sld: string): string {
  if (sld.endsWith("s")) return sld;
  if (/[sxz]$|[cs]h$/.test(sld)) return sld + "es";
  return sld + "s";
}

export function singularVariant(sld: string): string {
  if (sld.endsWith("ies") && sld.length > 4) return sld.slice(0, -3) + "y";
  if (sld.endsWith("es") && sld.length > 3) return sld.slice(0, -2);
  if (sld.endsWith("s") && sld.length > 2) return sld.slice(0, -1);
  return sld;
}

export function hyphenVariants(sld: string): string[] {
  if (sld.includes("-")) return [sld.replace(/-/g, "")];
  const out: string[] = [];
  for (let i = 1; i < sld.length; i++) out.push(sld.slice(0, i) + "-" + sld.slice(i));
  return out;
}

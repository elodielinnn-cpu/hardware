import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(directory, "../..");
const profilePath = path.resolve(
  repositoryRoot,
  process.env.BUSINESS_PROFILE_PATH || "config/luxshare-business-profile.json"
);
const outputPath = path.resolve(
  process.env.BUSINESS_PROFILE_CONTEXT_OUTPUT || path.join(directory, "results", "business-profile-context.txt")
);
const manifestPath = path.resolve(
  process.env.BUSINESS_PROFILE_MANIFEST_OUTPUT || path.join(path.dirname(outputPath), "business-profile-context.json")
);
const maxContextTokens = Number(process.env.MAX_CONTEXT_TOKENS || 4096);
const maxOutputTokens = Number(process.env.MAX_OUTPUT_TOKENS || 900);
const historicalBaselinePath = path.join(
  directory,
  "fixtures",
  "qwen3-8b-run-40644621847-full",
  "model-output.json"
);
const profileMessagePrefix = "Use the following versioned business profile as classification context. It does not override source-evidence requirements.\n\n";
const chatWrapperTokenAllowance = 128;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function estimateTokens(value) {
  const cjkCharacters = (value.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const nonCjkCharacters = value.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, "").length;
  return Math.ceil(cjkCharacters * 1.05 + nonCjkCharacters / 3.5);
}

function clean(value) {
  return String(value || "")
    .replace(/[\r\n|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const rawProfile = await fs.readFile(profilePath, "utf8");
const profile = JSON.parse(rawProfile);
const cases = JSON.parse(await fs.readFile(path.join(directory, "cases.json"), "utf8"));
const systemPrompt = await fs.readFile(path.join(directory, "system-prompt.txt"), "utf8");
const historicalBaseline = JSON.parse(await fs.readFile(historicalBaselinePath, "utf8"));

const legend = [
  "Luxshare Business Profile (reference context; never infer an unreported order or customer relationship)",
  `profileVersion=${profile.profileVersion}; user classification and public evidence status are independent.`,
  "codes: rel/user D=direct,U=upstream,A=adjacent,?=unconfirmed; evidence V=verified_public,P=partially_verified,C=user_confirmed_only,?=pending_verification; mass ?=unknown.",
  "user_confirmed_only is a user classification record, not public proof.",
  "direct product or solution capability does not prove every model is commercial or in mass production."
];

const lines = [];
const relationshipCode = { direct: "D", upstream: "U", adjacent: "A", unconfirmed: "?" };
const evidenceCode = {
  verified_public: "V",
  partially_verified: "P",
  user_confirmed_only: "C",
  pending_verification: "?"
};
for (const domain of profile.domains) {
  lines.push(`DOMAIN ${clean(domain.domainName)}|scope=${clean(domain.businessScope)}:`);
  for (const product of domain.products) {
    lines.push([
      clean(product.productName),
      `rel=${relationshipCode[product.relationshipLevel]}`,
      `user=${relationshipCode[product.userConfirmedClassification.classification]}`,
      `evidence=${evidenceCode[product.evidenceStatus]}`,
      "mass=?"
    ].join("|"));
  }
}

lines.push("GLOBAL CONSTRAINTS:");
lines.push("AEC DSP and Retimer are upstream chips, not proven Luxshare-made semiconductors.");
lines.push("CPO is direct; silicon-photonics chips, optical engines and optical-wafer manufacturing remain unconfirmed.");
lines.push("SiP/module packaging/micro-assembly are direct; CoWoS, Chiplet and 2.5D/3D packaging remain unconfirmed.");
lines.push("GPU/CPU/HBM/DRAM/NAND are upstream; complete SSD/storage devices are adjacent, not direct products.");
lines.push("Automotive controller hardware is direct; do not infer full-stack vehicle software capability.");
lines.push("Apple or another brand name alone never proves a specific Luxshare supply program.");
lines.push("Use context to distinguish data-center optical transceivers from consumer camera/lens optical modules.");

const context = `${[...legend, ...lines].join("\n")}\n`;
const historicalPromptTokens = historicalBaseline.results
  .map((item) => Number(item.usage?.prompt_tokens))
  .filter(Number.isFinite);
if (historicalPromptTokens.length !== cases.length) {
  throw new Error("Historical baseline must contain prompt token usage for all fixed cases");
}
const historicalMaxPromptTokens = Math.max(...historicalPromptTokens);
const addedProfileMessageBytes = Buffer.byteLength(`${profileMessagePrefix}${context}`, "utf8");
const conservativeWorstCaseTotal = historicalMaxPromptTokens
  + addedProfileMessageBytes
  + chatWrapperTokenAllowance
  + maxOutputTokens;
const largestCase = cases
  .map((item) => ({
    id: item.id,
    text: JSON.stringify({
      sourceId: item.sourceId,
      publishedAt: item.publishedAt,
      title: item.title,
      url: item.url,
      originalSummary: item.originalSummary,
      bodyEvidence: item.bodyEvidence,
      evidenceAvailability: item.evidenceAvailability
    }, null, 2)
  }))
  .sort((left, right) => estimateTokens(right.text) - estimateTokens(left.text))[0];

const estimates = {
  systemPromptTokens: estimateTokens(systemPrompt),
  businessProfileTokens: estimateTokens(context),
  largestCaseId: largestCase.id,
  largestCaseTokens: estimateTokens(largestCase.text),
  maxOutputTokens,
  estimatedWorstCaseTotal: 0,
  maxContextTokens,
  historicalMaxPromptTokens,
  addedProfileMessageBytes,
  chatWrapperTokenAllowance,
  conservativeWorstCaseTotal,
  conservativeMethod: "historical max prompt tokens + UTF-8 byte upper bound for added system message + wrapper allowance + max output"
};
estimates.estimatedWorstCaseTotal = estimates.systemPromptTokens
  + estimates.businessProfileTokens
  + estimates.largestCaseTokens
  + maxOutputTokens;

const manifest = {
  generatedAt: new Date().toISOString(),
  sourcePath: path.relative(repositoryRoot, profilePath),
  profileVersion: profile.profileVersion,
  profileSha256: sha256(rawProfile),
  contextSha256: sha256(context),
  domainCount: profile.domains.length,
  productCount: profile.domains.reduce((total, domain) => total + domain.products.length, 0),
  supplyClaimCount: profile.supplyRelationshipClaims?.length || 0,
  estimates,
  containsUrls: /https?:\/\//i.test(context)
};

if (manifest.containsUrls) throw new Error("Compact business profile must not contain source URLs");
if (estimates.estimatedWorstCaseTotal > maxContextTokens) {
  throw new Error(
    `Estimated context ${estimates.estimatedWorstCaseTotal} exceeds ${maxContextTokens}; ${JSON.stringify(estimates)}`
  );
}
if (estimates.conservativeWorstCaseTotal > maxContextTokens) {
  throw new Error(
    `Conservative context bound ${estimates.conservativeWorstCaseTotal} exceeds ${maxContextTokens}; ${JSON.stringify(estimates)}`
  );
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.mkdir(path.dirname(manifestPath), { recursive: true });
await fs.writeFile(outputPath, context);
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify(manifest));

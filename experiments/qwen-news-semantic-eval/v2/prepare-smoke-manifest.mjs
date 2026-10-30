import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildCandidateProfileContext, loadBusinessProfile, retrieveProductCandidates } from "./profile-retriever.mjs";
import { createSourceBinding } from "./decision-engine.mjs";
import { smokeCaseIds } from "./smoke-cases.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const experimentRoot = path.resolve(directory, "..");
const repositoryRoot = path.resolve(directory, "../../..");
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function estimateTokens(value) {
  const cjk = (value.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const other = value.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, "").length;
  return Math.ceil(cjk * 1.1 + other / 3.2);
}

const [casesText, schemaText, promptText, profileData] = await Promise.all([
  fs.readFile(path.join(experimentRoot, "cases.json"), "utf8"),
  fs.readFile(path.join(directory, "response.schema.json"), "utf8"),
  fs.readFile(path.join(directory, "system-prompt.txt"), "utf8"),
  loadBusinessProfile(
    path.join(repositoryRoot, "config/luxshare-business-profile.json"),
    path.join(directory, "product-relations.json")
  )
]);
const cases = JSON.parse(casesText);
const selectedCases = smokeCaseIds.map((id) => cases.find((item) => item.id === id));
if (selectedCases.some((item) => !item)) throw new Error("A required V2 smoke case is missing from cases.json");

const caseEntries = selectedCases.map((item) => {
  const originalSourceDocument = {
    cohort: item.cohort,
    sourceId: item.sourceId,
    publishedAt: item.publishedAt,
    title: item.title,
    url: item.url,
    originalSummary: item.originalSummary,
    bodyEvidence: item.bodyEvidence,
    evidenceAvailability: item.evidenceAvailability
  };
  const sourceBinding = createSourceBinding(item.id, originalSourceDocument);
  const originalInput = {
    articleId: item.id,
    inputHash: sourceBinding.inputHash,
    originalSourceDocument
  };
  const retrieval = retrieveProductCandidates({
    title: item.title,
    summary: item.originalSummary,
    bodyEvidence: item.bodyEvidence.join("\n")
  }, profileData);
  const profileContext = buildCandidateProfileContext(retrieval, profileData);
  const modelMessagesText = `${promptText}\n${JSON.stringify(profileContext)}\n${JSON.stringify(originalInput)}`;
  return {
    id: item.id,
    inputSha256: sha256(JSON.stringify(originalInput)),
    retrievalMode: profileContext.selectionMode,
    candidateProductIds: profileContext.candidateProductIds,
    neighborProductIds: profileContext.neighborProductIds,
    profileContextSha256: sha256(JSON.stringify(profileContext)),
    estimatedPromptTokens: estimateTokens(modelMessagesText),
    promptUtf8Bytes: Buffer.byteLength(modelMessagesText, "utf8")
  };
});

const manifest = {
  generatedAt: new Date().toISOString(),
  smokeCaseIds,
  caseCount: smokeCaseIds.length,
  casesFileSha256: sha256(casesText),
  schemaSha256: sha256(schemaText),
  schemaEstimatedTokens: estimateTokens(schemaText),
  systemPromptSha256: sha256(promptText),
  systemPromptEstimatedTokens: estimateTokens(promptText),
  profileVersion: profileData.profile.profileVersion,
  profileHash: profileData.profileHash,
  relationGraphHash: profileData.relationGraphHash,
  contextSize: Number(process.env.CONTEXT_SIZE || 8192),
  maxOutputTokens: Number(process.env.MAX_OUTPUT_TOKENS || 1800),
  chatWrapperReserveTokens: Number(process.env.CHAT_WRAPPER_RESERVE_TOKENS || 256),
  tokenizerPreflightRequired: true,
  tokenEstimateMethod: "static estimate only; workflow must record llama.cpp /tokenize counts before inference",
  cases: caseEntries
};
const availablePromptTokens = manifest.contextSize - manifest.maxOutputTokens - manifest.chatWrapperReserveTokens;
for (const item of manifest.cases) {
  if (item.estimatedPromptTokens > availablePromptTokens) {
    throw new Error(`${item.id} estimated prompt exceeds context budget`);
  }
}

const outputPath = process.env.MANIFEST_PATH;
if (outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(JSON.stringify(manifest));

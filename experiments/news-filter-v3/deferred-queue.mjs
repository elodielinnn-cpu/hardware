import fs from "node:fs/promises";
import path from "node:path";

const QUEUE_VERSION = 1;
const MAX_AUTO_ATTEMPTS = 3;
const COMPLETED_RETENTION_DAYS = 45;
const MAX_QUEUE_ITEMS = 1200;

function baseArticle(candidate) {
  return {
    candidateId: candidate.candidateId,
    id: candidate.id || null,
    sourceId: candidate.sourceId,
    title: candidate.title,
    url: candidate.url || candidate.sourceUrl || "",
    publishedAt: candidate.publishedAt,
    summary: candidate.originalSummary || candidate.summary || ""
  };
}

export async function loadDeferredQueue(queuePath) {
  try {
    const parsed = JSON.parse(await fs.readFile(queuePath, "utf8"));
    if (parsed.version !== QUEUE_VERSION || !Array.isArray(parsed.items)) throw new Error("unsupported deferred queue format");
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") return { version: QUEUE_VERSION, updatedAt: null, items: [] };
    throw error;
  }
}

export function mergeDeferredQueue(previousQueue, deferredCandidates, now = new Date().toISOString()) {
  const byId = new Map(previousQueue.items.map((item) => [item.candidateId, item]));
  for (const candidate of deferredCandidates) {
    const existing = byId.get(candidate.candidateId);
    if (["completed", "manual_review"].includes(existing?.status)) {
      byId.set(candidate.candidateId, { ...existing, lastSeenAt: now });
      continue;
    }
    byId.set(candidate.candidateId, {
      ...baseArticle(candidate),
      firstDeferredAt: existing?.firstDeferredAt || now,
      lastDeferredAt: now,
      attempts: existing?.attempts || 0,
      status: "pending",
      deferredReason: candidate.deferredReason || "capacity"
    });
  }
  return compactQueue({ version: QUEUE_VERSION, updatedAt: now, items: [...byId.values()] }, now);
}

export function recordDeferredOutcomes(queue, outcomes, now = new Date().toISOString()) {
  const outcomeById = new Map(outcomes.map((outcome) => [outcome.candidateId, outcome]));
  const items = [];
  for (const item of queue.items) {
    const outcome = outcomeById.get(item.candidateId);
    if (!outcome) {
      items.push(item);
      continue;
    }
    if (outcome.status === "completed") {
      items.push({
        ...item,
        status: "completed",
        completedAt: now,
        lastAttemptAt: now,
        lastError: "",
        articleSnapshot: outcome.articleSnapshot || item.articleSnapshot || null
      });
      continue;
    }
    const attempts = item.attempts + 1;
    items.push({
      ...item,
      attempts,
      lastAttemptAt: now,
      status: attempts >= MAX_AUTO_ATTEMPTS ? "manual_review" : "pending",
      lastError: String(outcome.error || "detail_fetch_failed").slice(0, 300)
    });
  }
  return compactQueue({ version: QUEUE_VERSION, updatedAt: now, items }, now);
}

function compactQueue(queue, now = new Date().toISOString()) {
  const cutoff = Date.parse(now) - COMPLETED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const retained = queue.items.filter((item) => item.status !== "completed" || Date.parse(item.completedAt || 0) >= cutoff);
  retained.sort((left, right) => {
    const statusRank = { pending: 0, manual_review: 1, completed: 2 };
    return (statusRank[left.status] ?? 3) - (statusRank[right.status] ?? 3) ||
      String(right.lastDeferredAt || right.completedAt || "").localeCompare(String(left.lastDeferredAt || left.completedAt || ""));
  });
  return { ...queue, items: retained.slice(0, MAX_QUEUE_ITEMS) };
}

export async function saveDeferredQueue(queuePath, queue) {
  await fs.mkdir(path.dirname(queuePath), { recursive: true });
  const temporaryPath = `${queuePath}.tmp-${process.pid}`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, queuePath);
}

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { validateWorkflowRuntime } from "./runtime-config.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(directory, "../../..");

try {
  const runtime = await validateWorkflowRuntime(process.env, repositoryRoot);
  console.log(JSON.stringify({
    ok: true,
    modelId: runtime.modelId,
    modelPath: runtime.modelPath,
    modelBytes: runtime.modelBytes,
    llamaServer: runtime.llamaServer,
    endpoint: runtime.baseUrl,
    contextSize: runtime.contextSize,
    maxOutputTokens: runtime.maxOutputTokens,
    resultDirectory: runtime.resultDirectory,
    caseCount: runtime.caseIds.length
  }));
} catch (error) {
  console.error(`V2 runtime preflight failed: ${error.message}`);
  process.exitCode = 1;
}

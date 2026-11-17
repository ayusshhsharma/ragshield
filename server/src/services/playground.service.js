import { AI_TIMEOUTS, createAiClient } from './aiClient.js';

const ALL_DISABLED_DEFENSES = Object.freeze({
  inputScanner: { enabled: false, threshold: 0.5 },
  documentScanner: { enabled: false, threshold: 0.5 },
  instructionIsolation: { enabled: false },
  outputValidator: { enabled: false },
});

/**
 * Execute a single query through the RAG pipeline via the AI service.
 *
 * @param {object} params
 * @param {object} params.project - Mongoose Project document
 * @param {string} params.query - User question/prompt
 * @param {boolean} [params.useProjectDefenses=true] - Whether to use project's configured defenses
 * @returns {Promise<object>} Query result matching { answer, blocked, blockedBy, retrievedChunks, defensesTriggered, latencyMs }
 */
export async function runPlaygroundQuery({ project, query, useProjectDefenses = true }) {
  const aiClient = createAiClient();

  const ragConfig = project.ragConfig?.toObject
    ? project.ragConfig.toObject()
    : project.ragConfig;

  const defenseConfig = useProjectDefenses
    ? (project.defenseConfig?.toObject ? project.defenseConfig.toObject() : project.defenseConfig)
    : ALL_DISABLED_DEFENSES;

  const res = await aiClient.post(
    '/internal/rag/query',
    {
      projectId: project._id.toString(),
      query,
      ragConfig,
      defenseConfig,
    },
    {
      timeout: AI_TIMEOUTS.QUERY,
    },
  );

  return res.data;
}

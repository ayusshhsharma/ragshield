import { getOwnedProject } from '../utils/getOwnedProject.js';
import { runPlaygroundQuery } from '../services/playground.service.js';
import { querySchema } from '../validators/playground.validator.js';

export async function query(req, res) {
  const project = await getOwnedProject(req);
  const parsed = querySchema.parse(req.body);

  const result = await runPlaygroundQuery({
    project,
    query: parsed.query,
    useProjectDefenses: parsed.useProjectDefenses,
  });

  res.status(200).json(result);
}

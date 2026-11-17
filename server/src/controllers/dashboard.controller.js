import { getOwnedProject } from '../utils/getOwnedProject.js';
import { getProjectDashboard } from '../services/dashboard.service.js';

export async function getDashboard(req, res) {
  const project = await getOwnedProject(req);
  const data = await getProjectDashboard({ project, user: req.user });

  res.status(200).json(data);
}

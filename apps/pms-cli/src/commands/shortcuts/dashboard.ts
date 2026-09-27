import type { PmsClient } from "../../../../../packages/pms-client/src/index.js";
import { listResource } from "./resourceCommands.js";

export async function dashboardSummary(client: PmsClient) {
  const [projects, tasks] = await Promise.all([
    listResource(client, "project", { page: 1, pageSize: 100 }),
    listResource(client, "task", { page: 1, pageSize: 100 }),
  ]);
  return {
    projectTotal: projects.total,
    projectItems: projects.items,
    taskTotal: tasks.total,
    taskItems: tasks.items,
  };
}

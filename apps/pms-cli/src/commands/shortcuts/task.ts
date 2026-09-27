import type { PmsClient } from "../../../../../packages/pms-client/src/index.js";
import { getResourceById, listResource, writeResource, type ListOptions, type WriteOptions } from "./resourceCommands.js";

export const taskList = (client: PmsClient, options: ListOptions = {}) => listResource(client, "task", options);
export const taskGet = (client: PmsClient, id: number) => getResourceById(client, "task", id);
export const taskCreate = (client: PmsClient, options: WriteOptions = {}) => writeResource(client, "task.create", options);
export const taskUpdate = (client: PmsClient, options: WriteOptions = {}) => writeResource(client, "task.update", options);

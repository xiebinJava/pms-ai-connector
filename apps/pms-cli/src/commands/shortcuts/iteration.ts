import type { PmsClient } from "../../../../../packages/pms-client/src/index.js";
import { getResourceById, listResource, writeResource, type ListOptions, type WriteOptions } from "./resourceCommands.js";

export const iterationList = (client: PmsClient, options: ListOptions = {}) => listResource(client, "iteration_plan", options);
export const iterationGet = (client: PmsClient, id: number) => getResourceById(client, "iteration_plan", id);
export const iterationCreate = (client: PmsClient, options: WriteOptions = {}) => writeResource(client, "iteration-plan.create", options);
export const iterationUpdate = (client: PmsClient, options: WriteOptions = {}) => writeResource(client, "iteration-plan.update", options);

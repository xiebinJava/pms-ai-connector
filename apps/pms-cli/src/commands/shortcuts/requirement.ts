import type { PmsClient } from "../../../../../packages/pms-client/src/index.js";
import { getResourceById, listResource, writeResource, type ListOptions, type WriteOptions } from "./resourceCommands.js";

export const requirementList = (client: PmsClient, options: ListOptions = {}) => listResource(client, "requirement", options);
export const requirementGet = (client: PmsClient, id: number) => getResourceById(client, "requirement", id);
export const requirementCreate = (client: PmsClient, options: WriteOptions = {}) => writeResource(client, "requirement.create", options);
export const requirementUpdate = (client: PmsClient, options: WriteOptions = {}) => writeResource(client, "requirement.update", options);

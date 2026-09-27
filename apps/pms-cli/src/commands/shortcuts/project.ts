import type { PmsClient } from "../../../../../packages/pms-client/src/index.js";
import { getResourceById, listResource, writeResource, type ListOptions, type WriteOptions } from "./resourceCommands.js";

export const projectList = (client: PmsClient, options: ListOptions = {}) => listResource(client, "project", options);
export const projectGet = (client: PmsClient, id: number) => getResourceById(client, "project", id);
export const projectCreate = (client: PmsClient, options: WriteOptions = {}) => writeResource(client, "project.create", options);
export const projectUpdate = (client: PmsClient, options: WriteOptions = {}) => writeResource(client, "project.update", options);

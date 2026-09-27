import type { PmsClient } from "../../../../../packages/pms-client/src/index.js";
import { getResourceById, listResource, writeResource, type ListOptions, type WriteOptions } from "./resourceCommands.js";

export const topicList = (client: PmsClient, options: ListOptions = {}) => listResource(client, "topic", options);
export const topicGet = (client: PmsClient, id: number) => getResourceById(client, "topic", id);
export const topicCreate = (client: PmsClient, options: WriteOptions = {}) => writeResource(client, "topic.create", options);
export const topicUpdate = (client: PmsClient, options: WriteOptions = {}) => writeResource(client, "topic.update", options);

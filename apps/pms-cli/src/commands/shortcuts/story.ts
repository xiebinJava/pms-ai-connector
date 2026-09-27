import type { PmsClient } from "../../../../../packages/pms-client/src/index.js";
import { getResourceById, listResource, writeResource, type ListOptions, type WriteOptions } from "./resourceCommands.js";

export const storyList = (client: PmsClient, options: ListOptions = {}) => listResource(client, "story", options);
export const storyGet = (client: PmsClient, id: number) => getResourceById(client, "story", id);
export const storyCreate = (client: PmsClient, options: WriteOptions = {}) => writeResource(client, "story.create", options);
export const storyUpdate = (client: PmsClient, options: WriteOptions = {}) => writeResource(client, "story.update", options);

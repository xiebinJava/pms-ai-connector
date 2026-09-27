import * as z from "zod/v4";
import type { PmsClient } from "../../../../packages/pms-client/src/index.js";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { toolFailure, toolSuccess } from "./result.js";

export const capabilitiesInputSchema = z.object({});

export async function capabilitiesTool(client: PmsClient): Promise<CallToolResult> {
  try {
    return toolSuccess(await client.capabilities());
  } catch (error) {
    return toolFailure(error);
  }
}

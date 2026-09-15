"use server";

import { getResolvedAuthDestination } from "@/modules/auth/application/destination-loader.service";
import { successResponse, errorResponse } from "@/shared/utils/responses";

export async function getAuthDestinationAction() {
  try {
    const destination = await getResolvedAuthDestination();
    return successResponse({ destination });
  } catch (error) {
    return errorResponse("Failed to resolve destination");
  }
}

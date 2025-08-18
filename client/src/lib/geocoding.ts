import { apiRequest } from "./queryClient";
import { GeocodeSearch, ApiResponse } from "@shared/schema";

export async function lookupProperty(geocode: string): Promise<ApiResponse> {
  const searchData: GeocodeSearch = { geocode };
  
  const response = await apiRequest("POST", "/api/property/lookup", searchData);
  return response.json();
}

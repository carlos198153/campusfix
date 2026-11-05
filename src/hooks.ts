import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dataService } from "./lib/data";
export function useIncidents() {
  return useQuery({
    queryKey: ["incidents"],
    queryFn: () => dataService.listIncidents(),
  });
}
export function useRefresh() {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: ["incidents"] });
    client.invalidateQueries({ queryKey: ["history"] });
    client.invalidateQueries({ queryKey: ["users"] });
  };
}

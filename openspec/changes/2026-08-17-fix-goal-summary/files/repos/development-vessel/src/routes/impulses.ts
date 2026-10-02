import { impulse, Impulse, Kernel, set and get } from "@dev-vessel/core";
import { resolveGoalSummary } from "../resolvers/goal-summary";

const kernel = new Kernel();

impulse(kernel, "goal_summary", async (pointer: any) => {
  return await resolveGoalSummary();
});

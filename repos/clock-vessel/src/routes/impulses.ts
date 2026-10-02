import type { Impulse } from "@avigopal/ias-executor-ts";

export async function resolveDispatch(
  pointer: { type: string } & Record<string, unknown>
): Promise<Impulse> {
  switch (pointer.type) {
    // TODO: Add case arms for each advertised shape
    // Advertised shapes from config: ["currentTimeReport"]
    default:
      return {
        shape: "error",
        body: { message: `unknown shape: ${pointer.type}` },
      };
  }
}

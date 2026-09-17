/**
 * Which database Tables / Diff-history / Table Explorer is pointed at. The
 * list itself is server-controlled (`GET /api/schema/targets`, see
 * `schema-watch/targets.ts`) — this component never invents an ns/db pair,
 * it only offers what the server already knows how to reach safely.
 */
import type { ReactNode } from "react";
import { useDbTargets } from "../api/queries";
import type { DbTarget } from "../api/types";

export function useDefaultTargetKey(): string | undefined {
  const targets = useDbTargets();
  return targets.data?.[0]?.key;
}

export function DbTargetPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (key: string) => void;
}): ReactNode {
  const targets = useDbTargets();
  if (!targets.data || targets.data.length <= 1) return null;

  return (
    <select
      className="sf-input"
      aria-label="Database"
      value={value ?? targets.data[0]?.key}
      onChange={(e) => onChange(e.target.value)}
    >
      {targets.data.map((t: DbTarget) => (
        <option key={t.key} value={t.key}>
          {t.label}
        </option>
      ))}
    </select>
  );
}

/**
 * DB LESSON TEMPLATES — a curated curriculum, not a derived vocabulary.
 *
 * `StarterChips` (beside this) is generated FROM the live shape registry —
 * right by construction, but it can only ever suggest what the fleet already
 * advertises, which says nothing about database design specifically. This is
 * the opposite kind of list: a fixed, hand-picked set of prompts that push on
 * normalization, keys, and schema review — the actual curriculum a reader
 * teaching a agent good database habits keeps coming back to. Same P2 rule
 * as every other chip on this page: clicking INSERTS text, it never sends.
 */
import type { ReactNode } from "react";

interface Template {
  readonly label: string;
  readonly goal: string;
}

const TEMPLATES: readonly Template[] = [
  {
    label: "design a normalized schema",
    goal:
      "Design a schema for <describe the domain, e.g. a blog with posts, authors, comments, and tags>. " +
      "Normalize to at least 3NF, name every table and its primary/foreign keys explicitly, and explain " +
      "each normalization decision as you make it.",
  },
  {
    label: "review a table for violations",
    goal:
      "Review the `<table name>` table for normalization violations. For each one, name which normal " +
      "form it breaks and why, then propose the corrected schema — do not apply it yet, just propose it.",
  },
  {
    label: "explain a table's normal form",
    goal:
      "Is `<table name>` in 3NF? Walk through 1NF, 2NF, and 3NF in order, showing which the table " +
      "satisfies and which (if any) it fails, with the specific column(s) responsible.",
  },
  {
    label: "add a correct foreign key",
    goal:
      "Add a foreign-key relationship between `<table a>` and `<table b>` correctly: the right column, " +
      "the right direction, an index on the foreign key column, and referential-integrity handling on " +
      "delete/update. Explain the choice of ON DELETE behaviour.",
  },
  {
    label: "denormalization tradeoff",
    goal:
      "Would denormalizing `<table name>` (e.g. duplicating a column to avoid a join) help or hurt here? " +
      "Argue both sides using this table's actual row count and access pattern, then give a recommendation.",
  },
  {
    label: "audit the whole schema",
    goal:
      "Scan every table this vessel can see and list the ones that look like normalization mistakes — " +
      "duplicated data, missing keys, or columns that should be their own table — ranked by how bad " +
      "each one is, with the specific fix for the worst one.",
  },
];

export function DbLessonTemplates({ onInsert }: { onInsert: (text: string) => void }): ReactNode {
  return (
    <div className="sf-db-templates">
      <p className="sf-label">DB lessons</p>
      <div className="sf-chips">
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            className="sf-chip"
            onClick={() => onInsert(t.goal)}
            title={t.goal}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="sf-note sf-muted">
        A curated curriculum, not derived from the live fleet — clicking fills the box with a
        template; the parts in angle brackets are yours to fill in before you send it.
      </p>
    </div>
  );
}

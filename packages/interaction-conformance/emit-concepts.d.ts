/**
 * emit-concepts.ts — the second reader of the rule table.
 *
 * A guide only humans read teaches only the person who opened it. The surface is
 * substrate-editable, so the same patterns the checker refuses must reach the
 * drafter at prompt-build time — otherwise the first substrate-authored change to
 * the surface is written against them and the gate just says no, repeatedly,
 * without ever teaching anything.
 *
 * `check.ts --emit-concepts` prints class-grain concept payloads generated from
 * `rules.ts`. One source, two readers (design.md §3.4): a rule cannot be enforced
 * without also being taught, or taught without being enforced.
 *
 * The payloads are shaped for concept-db's `concept_create` and are recalled on
 * the existing compose-lesson channel. `not_covered` is carried into the lesson
 * ON PURPOSE — telling the drafter that a rule is only half-checked is more
 * useful than implying the gate will catch everything.
 */
export interface ConceptPayload {
    /** Stable key — regenerating must update, not duplicate. */
    key: string;
    name: string;
    kind: 'pattern';
    grain: 'class';
    /** The refusable condition, as the drafter should hold it. */
    statement: string;
    body: string;
    tags: string[];
    source: {
        package: '@avigopal/interaction-conformance';
        rule_table: 'rules.ts';
        rule_id: string;
    };
}
export declare function emitConcepts(): ConceptPayload[];
//# sourceMappingURL=emit-concepts.d.ts.map
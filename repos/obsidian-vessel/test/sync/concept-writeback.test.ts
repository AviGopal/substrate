/**
 * Regression tests for the concept-writeback envelope strip.
 *
 * The render path in `concept-formatter.ts` wraps `concept.content`
 * with a leading `# <title>` heading and a contiguous run of obsidian
 * callouts (`[!abstract] Summary`, `[!info] Stats`, `[!quote] Source`)
 * before the body, and appends a `## Related` section after it.
 *
 * Writeback must strip BOTH ends so that the next pull does not
 * accumulate another copy of the wrap into `concept.content`. The
 * load-bearing invariant is:
 *
 *   stripWritebackEnvelope(render(c)) === c.content
 *
 * when `c.content` is empty user prose (no leading rendered wrap).
 *
 * Cites concept_kxeA7gRK7NEW (writeback_echo_loop) and
 * concept_HqdWDywYZzK3 (round_trip_idempotence_contract).
 */

import { describe, expect, test } from 'bun:test';
import {
  stripRenderedWrap,
  stripWritebackEnvelope,
} from '../../src/sync/concept-writeback-strip';

describe('stripRenderedWrap', () => {
  test('strips heading + all three callouts + leaves user body', () => {
    const rendered = [
      '# Api Contract Validation Failure',
      '',
      '> [!abstract] Summary',
      '> A short summary line.',
      '',
      '> [!info] Stats',
      '> relevance 0.42 · loaded 3',
      '',
      '> [!quote] Source',
      '> `src/foo.ts` § bar',
      '',
      'This is the user-authored body.',
      '',
      'A second paragraph.',
    ].join('\n');

    expect(stripRenderedWrap(rendered)).toBe(
      'This is the user-authored body.\n\nA second paragraph.',
    );
  });

  test('is idempotent: running twice equals running once', () => {
    const rendered = [
      '# Title',
      '',
      '> [!abstract] Summary',
      '> Summary line.',
      '',
      '> [!info] Stats',
      '> loaded 1',
      '',
      'Body paragraph.',
    ].join('\n');

    const once = stripRenderedWrap(rendered);
    const twice = stripRenderedWrap(once);
    expect(twice).toBe(once);
  });

  test('preserves a user [!note] callout at the top of the body', () => {
    const rendered = [
      '# Title',
      '',
      '> [!abstract] Summary',
      '> Summary line.',
      '',
      '> [!note]',
      '> A user-authored note callout.',
      '',
      'Body text.',
    ].join('\n');

    const stripped = stripRenderedWrap(rendered);
    expect(stripped).toContain('> [!note]');
    expect(stripped).toContain('A user-authored note callout.');
    expect(stripped).toContain('Body text.');
    // The render-time heading + abstract must be gone.
    expect(stripped).not.toContain('# Title');
    expect(stripped).not.toContain('[!abstract]');
  });

  test('preserves a body that starts with `## SubHeading` (no `# ` wrap)', () => {
    const body = ['## SubHeading', '', 'Some content.'].join('\n');
    expect(stripRenderedWrap(body)).toBe(body);
  });

  test('empty input returns empty', () => {
    expect(stripRenderedWrap('')).toBe('');
    expect(stripRenderedWrap('\n\n\n')).toBe('');
  });

  test('preserves user [!warning] callout at top (not a renderer type)', () => {
    const body = [
      '> [!warning]',
      '> Heads up.',
      '',
      'Paragraph.',
    ].join('\n');
    expect(stripRenderedWrap(body)).toBe(body);
  });

  test('strips heading-only when there are no callouts', () => {
    const body = ['# Title', '', 'Body paragraph.'].join('\n');
    expect(stripRenderedWrap(body)).toBe('Body paragraph.');
  });

  test('does not strip deeper headings (## or ###)', () => {
    const body = ['## Section', '', 'Body.'].join('\n');
    expect(stripRenderedWrap(body)).toBe(body);
  });
});

describe('stripWritebackEnvelope (combined leading + trailing strip)', () => {
  test('multi-callout case: heading + abstract + stats + source + body + Related', () => {
    const rendered = [
      '# Api Contract Validation Failure',
      '',
      '> [!abstract] Summary',
      '> A short summary.',
      '',
      '> [!info] Stats',
      '> relevance 0.4',
      '',
      '> [!quote] Source',
      '> `src/foo.ts`',
      '',
      'Body paragraph.',
      '',
      '## Related',
      '### related_to',
      '- [[concept_abc]]',
    ].join('\n');

    expect(stripWritebackEnvelope(rendered)).toBe('Body paragraph.');
  });

  test('idempotence under the composed envelope strip', () => {
    const rendered = [
      '# T',
      '',
      '> [!abstract] Summary',
      '> s',
      '',
      'Body.',
      '',
      '## Related',
      '- [[x]]',
    ].join('\n');
    const once = stripWritebackEnvelope(rendered);
    const twice = stripWritebackEnvelope(once);
    expect(twice).toBe(once);
    expect(once).toBe('Body.');
  });

  test('empty content round-trip: render of empty body strips back to empty', () => {
    // Simulate a render where concept.content is empty: only the wrap
    // and (optionally) a Related section exist.
    const rendered = [
      '# Title',
      '',
      '> [!abstract] Summary',
      '> summary only',
      '',
      '## Related',
      '- [[x]]',
    ].join('\n');
    expect(stripWritebackEnvelope(rendered)).toBe('');
  });
});

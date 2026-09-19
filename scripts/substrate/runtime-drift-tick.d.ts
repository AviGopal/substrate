#!/usr/bin/env bun
type Drift = {
    vessel: string;
    files: string[];
    runtimeOnly: string[];
    cloneOnly: string[];
};
/** Files that differ, plus files present on only one side. */
export declare function compareTrees(cloneSrc: string, runtimeSrc: string): Omit<Drift, "vessel">;
/**
 * True when a compose currently holds a slot. A held slot means divergence is expected
 * (a compose edits the live tree in place), so nothing may be repaired.
 *
 * A SLOT FILE IS NOT A HELD SLOT. compose-slots.ts reaps two kinds of non-holder:
 * a slot whose holder pid is gone ("DEAD HOLDER = FREE SLOT") and one older than
 * SLOT_STALE_MS — and its own header notes that "every restart of this vessel leaks a slot
 * per in-flight" compose. Counting any file as a holder therefore lets ONE leaked slot
 * suppress every future repair, permanently and silently: the failure mode is a watchdog
 * that reports drift forever and never fixes it. Applying the owner's own two reaping
 * rules keeps suppression correct during real composes without inheriting its leaks.
 *
 * ABSENT SLOT DIRECTORY MEANS "NO SLOT HELD", NOT "UNKNOWN". The directory is created by
 * the first slot acquisition; treating its absence as "a compose might be running" would
 * disable the repair permanently on any substrate that has not composed since boot.
 *
 * Unreadable or malformed slots count as HELD: a slot we cannot interpret is the one case
 * where suppressing is the safe default.
 */
export declare function composeSlotHeld(slotDir: string, now?: number): boolean;
export {};
//# sourceMappingURL=runtime-drift-tick.d.ts.map
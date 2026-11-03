"use strict";
const workerScope = self;
workerScope.onmessage = (event) => {
    const { id, pattern, flags, sample } = event.data;
    if (!Number.isSafeInteger(id) || typeof pattern !== "string" ||
        typeof flags !== "string" || typeof sample !== "string")
        return;
    try {
        if (pattern.length === 0)
            throw new Error("Enter a regular expression.");
        if (pattern.length > 256 || sample.length > 32000) {
            throw new Error("Pattern or test input exceeds the limit.");
        }
        if (!/^[gimsu]*$/.test(flags) || new Set(flags).size !== flags.length) {
            throw new Error("Unsupported or duplicate regular expression flags.");
        }
        const regex = new RegExp(pattern, flags);
        const matches = [];
        let truncated = false;
        let match;
        while ((match = regex.exec(sample)) !== null) {
            if (matches.length === 200) {
                truncated = true;
                break;
            }
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                value: match[0].slice(0, 200),
                groups: match.slice(1, 11).map((group) => group === undefined ? null : group.slice(0, 200)),
            });
            if (!regex.global)
                break;
            if (match[0].length === 0) {
                const current = regex.lastIndex;
                // Advance a full code point under the Unicode flag, as the spec requires.
                regex.lastIndex += regex.unicode && current < sample.length &&
                    (sample.codePointAt(current) ?? 0) > 0xFFFF ? 2 : 1;
            }
        }
        workerScope.postMessage({ id, ok: true, matches, truncated });
    }
    catch (error) {
        workerScope.postMessage({
            id, ok: false,
            error: error instanceof Error ? error.message : "Regex failed.",
        });
    }
};

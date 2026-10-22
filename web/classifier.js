// Non-blocking local classifier. Suggestions are not facts.
const rules = [
    ["sueño", /dorm|acost|despert|siesta|levant/i],
    ["alimentación", /com[ií]|desayun|almorz|cen[ée]|merend/i],
    ["hidratación", /agua|hidrat|beb[ií]/i],
    ["salida", /sal[ií]|camin|pase|calle|viaj|compr/i],
    ["higiene", /duch|bañ|lav|dient/i],
    ["social", /habl|llam|charl|visit|mensaje|amig/i],
    ["descanso", /descans|pausa|relaj/i],
];
const words = s => new Set((s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(x => x.length > 2));
export function suggestCategory(text, entries) {
    const tokens = words(text);
    let winner = null, best = 0;
    for (const entry of entries) {
        if (!entry.category || !entry.description) continue;
        const other = words(entry.description);
        const overlap = [...tokens].filter(t => other.has(t)).length;
        const score = overlap / Math.max(tokens.size, other.size, 1) + (entry.categorySource === "manual" ? 0.15 : 0);
        if (score > best) { best = score; winner = entry.category; }
    }
    if (best >= 0.35) return { category: winner, source: "precedent", confidence: best };
    const rule = rules.find(([, test]) => test.test(text));
    return rule ? { category: rule[0], source: "rule", confidence: 0.3 } : null;
}

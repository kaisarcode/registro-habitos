// Classification is best effort; it must never block or alter capture.
// A native liblng adapter can pass ISO language codes when available.
const rulesByLanguage = {
    es: [
        ["sueño", /dorm|acost|despert|siesta|levant/i],
        ["alimentación", /com[ií]|desayun|almorz|cen[ée]|merend/i],
        ["hidratación", /agua|hidrat|beb[ií]/i],
        ["salida", /sal[ií]|camin|pase|calle|viaj|compr/i],
        ["higiene", /duch|bañ|lav|dient/i],
        ["social", /habl|llam|charl|visit|mensaje|amig/i],
        ["descanso", /descans|pausa|relaj/i],
    ],
};
const words = s => new Set((s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(x => x.length > 2));

export function suggestCategory(text, entries, language = null) {
    const tokens = words(text);
    if (!tokens.size) return null;
    let winner = null, best = 0;
    for (const entry of entries) {
        if (!entry.category || !entry.description) continue;
        // A known language must not borrow training examples from another one.
        if (language && entry.language && entry.language !== language) continue;
        const other = words(entry.description);
        const overlap = [...tokens].filter(t => other.has(t)).length;
        const score = overlap / Math.max(tokens.size, other.size, 1) + (entry.categorySource === "manual" ? 0.15 : 0);
        if (score > best) { best = score; winner = entry.category; }
    }
    if (best >= 0.35) return { category: winner, source: "precedent", confidence: Math.min(best, 1), language };
    // Spanish is the default UI language until native detection is connected.
    const rule = (rulesByLanguage[language || "es"] || []).find(([, test]) => test.test(text));
    return rule ? { category: rule[0], source: "rule", confidence: 0.3, language: language || "es" } : null;
}

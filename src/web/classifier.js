/**
 * classifier.js - Habit register capability.
 * Summary: Provides a browser capability for the habit register.
 *
 * Author:  KaisarCode
 * Website: https://kaisarcode.com
 * License: https://www.gnu.org/licenses/lgpl-3.0.html
 */

const rulesByLanguage = {
    es: [
        ["Vapeo", /\b(vapear|vapeo|vapeador|vaper|vapeando|vape[eéó]|cigarrillo\s+electr[oó]nico)(?=$|[\s.,;!?])/i],
        ["Ir al baño", /\b(baño|pis|orinar|orin[eéó]|orinado|micci[oó]n|defecar|defequ[eé]|defecaci[oó]n|evacu[eéó]|evacuaci[oó]n|caca|me[eé])(?=$|[\s.,;!?])/i],
        ["Tabaco", /\b(tabaco|cigarrillos?|cigarros?|puchos?|fum[eéó]|fumar|fumando)(?=$|[\s.,;!?])/i],
        ["Alcohol", /\b(alcohol|cervezas?|birras?|vinos?|fernet|whisk(?:e)?y|vodka|ginebra|gin|sidra|champ[aá]n|tragos?|ron)(?=$|[\s.,;!?])/i],
        ["Medicación", /\b(medicaci[oó]n|medicamentos?|medicinas?|pastillas?|remedios?|dosis)(?=$|[\s.,;!?])/i],
        ["Cafeína", /\b(caf[eé]|cafecito|mate|energizante|cafe[ií]na)(?=$|[\s.,;!?])/i],
        ["Sueño", /dorm|acost|despert|siesta|levant/i],
        ["Alimentación", /com[ií]|comida|desayun|almorz|cen[ée]|merend/i],
        ["Hidratación", /agua|hidrat|beb[ií]/i],
        ["Actividad física", /camin(?:ar|ando|é|o|ata|ó|amos)|ejercic|entren|corr[ií]|trot[eé]|biciclet/i],
        ["Salida", /sal[ií]|camin|pase|calle|viaj|compr/i],
        ["Higiene", /duch|bañ[aeé]|lav|dient/i],
        ["Social", /habl|llam|charl|visit|mensaje|amig/i],
        ["Descanso", /descans|pausa|relaj/i],
    ],};

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
const words = s => new Set((s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(x => x.length > 2));

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
export function suggestCategory(text, entries, language = null, profiles = []) {

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    const normal = value => String(value||"").toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
    const normalized = " "+normal(text)+" ";
    let keywordMatch = null, longest = 0;
    for (const profile of profiles) {
        if (!profile || profile.deleted || !profile.name || !Array.isArray(profile.keywords)) continue;
        for (const keyword of profile.keywords) {
            const term = normal(keyword);
            if (!term || term.length < 2) continue;
            const matched = normalized.includes(" "+term);
            if (matched && term.length > longest) {
                keywordMatch = profile.name; longest = term.length;
            }
        }
    }
    if (keywordMatch) return {
        category: keywordMatch, source: "keyword", confidence: 0.95, language: language || "es"
    };
    const tokens = words(text);
    if (!tokens.size) return null;
    let winner = null, best = 0;
    for (const entry of entries) {
        if (!entry.category || !entry.description) continue;
        if (language && entry.language && entry.language !== language) continue;
        const other = words(entry.description);
        const overlap = [...tokens].filter(t => other.has(t)).length;
        const score = overlap / Math.max(tokens.size, other.size, 1) + (entry.categorySource === "manual" ? 0.15 : 0);
        if (score > best) { best = score; winner = entry.category; }
    }
    if (best >= 0.8) return { category: winner, source: "precedent", confidence: Math.min(best, 1), language };

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    const rule = (rulesByLanguage[language || "es"] || []).find(([, test]) => test.test(text));
    if (rule) return { category: rule[0], source: "rule", confidence: 0.6, language: language || "es" };
    return best >= 0.35 ? { category: winner, source: "precedent", confidence: Math.min(best, 1), language } : null;
}

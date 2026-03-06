/**
 * ═══════════════════════════════════════════════════════════
 * MEDGUARD — AI Brain 🧠
 * ═══════════════════════════════════════════════════════════
 *
 * The central intelligence module. Analyzes patterns, assesses
 * risks, and makes autonomous decisions about user health.
 *
 * Three core functions:
 *   1. analyzePatterns()  — Adherence habits, streaks, timing
 *   2. assessRisk()       — Drug interactions, ADR, AMR, symptoms
 *   3. makeDecisions()    — Autonomous alerts & recommendations
 *   4. getInsight()       — Backend AI-powered natural language analysis
 *
 * SAFETY: This engine provides EDUCATIONAL risk awareness only.
 *         It does NOT diagnose, prescribe, or modify doses.
 */

import {
    checkAllInteractions,
    getAdverseReactions,
    isAntibiotic,
    getAmrRisk,
} from './drugInteractions';
import { getAIInsight } from './aiClient';

// ─── Indian ADR Symptom Map (matches Profile.jsx) ───────
const SYMPTOM_MAP = {
    'rash': { label: 'Skin Rash / Itching', type: 'allergy', severity: 'medium' },
    'gastritis': { label: 'Stomach Pain / Acidity', type: 'adr', severity: 'medium' },
    'swelling': { label: 'Swelling of Face/Lips', type: 'allergy', severity: 'high' },
    'dizziness': { label: 'Dizziness / Giddiness', type: 'adr', severity: 'medium' },
    'cough': { label: 'Dry Cough (Persistent)', type: 'adr', severity: 'low' },
    'fever_pers': { label: 'Fever not reducing (3+ days)', type: 'amr', severity: 'high' },
    'recur_inf': { label: 'Recurring Infection', type: 'amr', severity: 'high' },
    'fatigue': { label: 'Extreme Weakness', type: 'adr', severity: 'medium' },
};

// ═══════════════════════════════════════════════════════════
// 1. PATTERN ANALYZER
// ═══════════════════════════════════════════════════════════

/**
 * Analyze adherence patterns from medicine data and adherence log.
 *
 * @param {Object[]} medicines - Array of medicine objects from Supabase
 * @param {Object[]} adherenceLog - Array of { date, all_taken, total_meds, taken_meds }
 * @returns {Object} Pattern analysis results
 */
export function analyzePatterns(medicines = [], adherenceLog = []) {
    const total = medicines.length;
    const taken = medicines.filter(m => m?.status === 'taken').length;
    const skipped = medicines.filter(m => m?.status === 'skipped').length;
    const pending = medicines.filter(m => m?.status === 'pending').length;

    // Today's adherence rate
    const todayAdherence = total > 0 ? Math.round((taken / total) * 100) : 0;

    // Calculate streak from adherence log
    const streak = calculateStreak(adherenceLog);

    // Detect time patterns
    const timeAnalysis = analyzeTimePatterns(medicines);

    // Missed dose trend (last 7 days)
    const missedTrend = analyzeMissedTrend(adherenceLog);

    // Per-medicine miss count
    const medicineMissMap = {};
    for (const med of medicines) {
        if (med?.status === 'skipped') {
            medicineMissMap[med.id] = (medicineMissMap[med.id] || 0) + 1;
        }
    }

    return {
        todayAdherence,
        taken,
        skipped,
        pending,
        total,
        streak,
        bestTime: timeAnalysis.bestTime,
        worstTime: timeAnalysis.worstTime,
        missedTrend, // 'improving', 'worsening', 'stable'
        medicineMissMap,
        isAllDone: pending === 0 && total > 0,
    };
}

/**
 * Calculate consecutive days streak from adherence log.
 */
function calculateStreak(adherenceLog = []) {
    if (!adherenceLog || adherenceLog.length === 0) return 0;

    // Sort by date descending
    const sorted = [...adherenceLog].sort((a, b) =>
        new Date(b.date) - new Date(a.date)
    );

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < sorted.length; i++) {
        const logDate = new Date(sorted[i].date);
        logDate.setHours(0, 0, 0, 0);

        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - i);

        // Check if this log entry matches the expected date
        if (logDate.getTime() === expectedDate.getTime() && sorted[i].all_taken) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

/**
 * Analyze which time of day has best/worst adherence.
 */
function analyzeTimePatterns(medicines = []) {
    const timeBuckets = { morning: { taken: 0, total: 0 }, afternoon: { taken: 0, total: 0 }, evening: { taken: 0, total: 0 }, night: { taken: 0, total: 0 } };

    for (const med of medicines) {
        if (!med?.times?.[0]) continue;
        const hour = parseInt(med.times[0].split(':')[0], 10);
        let bucket = 'morning';
        if (hour >= 12 && hour < 15) bucket = 'afternoon';
        else if (hour >= 15 && hour < 19) bucket = 'evening';
        else if (hour >= 19 || hour < 5) bucket = 'night';

        timeBuckets[bucket].total++;
        if (med.status === 'taken') timeBuckets[bucket].taken++;
    }

    let bestTime = null;
    let worstTime = null;
    let bestRate = -1;
    let worstRate = 101;

    for (const [time, stats] of Object.entries(timeBuckets)) {
        if (stats.total === 0) continue;
        const rate = (stats.taken / stats.total) * 100;
        if (rate > bestRate) { bestRate = rate; bestTime = time; }
        if (rate < worstRate) { worstRate = rate; worstTime = time; }
    }

    return { bestTime, worstTime };
}

/**
 * Check if missed doses are trending up or down.
 */
function analyzeMissedTrend(adherenceLog = []) {
    if (adherenceLog.length < 3) return 'insufficient_data';

    const sorted = [...adherenceLog].sort((a, b) =>
        new Date(a.date) - new Date(b.date)
    );
    const recent = sorted.slice(-3);
    const rates = recent.map(l => l.total_meds > 0 ? l.taken_meds / l.total_meds : 1);

    if (rates[2] > rates[0]) return 'improving';
    if (rates[2] < rates[0]) return 'worsening';
    return 'stable';
}


// ═══════════════════════════════════════════════════════════
// 2. RISK ASSESSOR
// ═══════════════════════════════════════════════════════════

/**
 * Comprehensive risk assessment combining drug interactions,
 * ADR checks, AMR monitoring, symptom correlation, and
 * profile-based risks.
 *
 * @param {Object[]} medicines - User's medicines
 * @param {Object} profile - User profile { age, gender, weight, ... }
 * @param {string[]} symptomIds - Array of symptom IDs from Profile/DB
 * @returns {Promise<Object>} Risk assessment result
 */
export async function assessRisk(medicines = [], profile = {}, symptomIds = []) {
    const flags = [];
    let overallLevel = 'green';

    const medNames = medicines.map(m => m?.name).filter(Boolean);
    const age = parseInt(profile?.age, 10) || 0;

    // Map symptom IDs to labels
    const symptomLabels = symptomIds
        .map(id => SYMPTOM_MAP[id]?.label)
        .filter(Boolean);

    // 1. Drug-Drug Interactions
    try {
        const interactions = await checkAllInteractions(medNames);
        for (const inter of interactions) {
            flags.push(inter);
            overallLevel = higherRisk(overallLevel, inter.level);
        }
    } catch (err) {
        console.error('[Brain:interactions]', err);
    }

    // 2. ADR checks + Symptom correlation
    for (const med of medicines) {
        if (!med?.name) continue;
        const { adrs, matchedSymptoms } = getAdverseReactions(med.name, symptomLabels);

        // Flag matched symptoms (user reports a known side effect)
        for (const match of matchedSymptoms) {
            flags.push({
                type: 'symptom_match',
                level: match.severity === 'high' ? 'red' : 'yellow',
                drug: med.name,
                symptom: match.symptom,
                message: match.message,
                advice: match.severity === 'high'
                    ? 'This could be a serious side effect. Contact your doctor immediately.'
                    : 'Monitor this symptom. If it worsens, contact your doctor.',
            });
            overallLevel = higherRisk(overallLevel, match.severity === 'high' ? 'red' : 'yellow');
        }

        // 3. AMR monitoring for antibiotics
        if (isAntibiotic(med.name)) {
            const missedForThis = medicines.filter(
                m => m?.name === med.name && m?.status === 'skipped'
            ).length;
            const amr = getAmrRisk(med.name, missedForThis);
            for (const f of amr.flags) {
                flags.push({ ...f, drug: med.name });
                overallLevel = higherRisk(overallLevel, f.level);
            }
        }
    }

    // 4. Polypharmacy risk
    if (medNames.length >= 8) {
        flags.push({
            type: 'polypharmacy',
            level: 'red',
            message: `You are taking ${medNames.length} medicines. High pill burden increases risk of interactions and side effects.`,
            advice: 'Ask your doctor if any medicines can be consolidated or discontinued.',
        });
        overallLevel = higherRisk(overallLevel, 'red');
    } else if (medNames.length >= 5) {
        flags.push({
            type: 'polypharmacy',
            level: 'yellow',
            message: `You are taking ${medNames.length} medicines. Monitor for side effects carefully.`,
            advice: 'Ensure each medicine is still necessary at your next doctor visit.',
        });
        overallLevel = higherRisk(overallLevel, 'yellow');
    }

    // 5. Age-specific risks
    if (age >= 65) {
        const riskMeds = medicines.filter(m =>
            m?.name && ['ibuprofen', 'diclofenac', 'aspirin', 'alprazolam', 'diazepam'].some(
                d => m.name.toLowerCase().includes(d)
            )
        );
        for (const med of riskMeds) {
            flags.push({
                type: 'elderly_caution',
                level: 'yellow',
                drug: med.name,
                message: `${med.name} requires extra caution in patients aged 65+.`,
                advice: 'Monitor for dizziness, falls, and stomach problems. Consult doctor about alternatives.',
            });
            overallLevel = higherRisk(overallLevel, 'yellow');
        }
    }

    // 6. Symptom-only risks (high severity symptoms without medicine correlation)
    const highRiskSymptoms = symptomIds.filter(id => SYMPTOM_MAP[id]?.severity === 'high');
    if (highRiskSymptoms.length > 0) {
        for (const symId of highRiskSymptoms) {
            const sym = SYMPTOM_MAP[symId];
            const alreadyMatched = flags.some(f => f.type === 'symptom_match' && f.symptom?.includes(sym.label.split('/')[0]));
            if (!alreadyMatched) {
                flags.push({
                    type: 'symptom_high',
                    level: 'red',
                    symptom: sym.label,
                    message: `You reported: "${sym.label}" — this is a high-severity symptom.`,
                    advice: sym.type === 'amr'
                        ? 'This may indicate antimicrobial resistance. See your doctor urgently.'
                        : 'This may indicate a serious reaction. Seek medical attention.',
                });
                overallLevel = 'red';
            }
        }
    }

    return {
        level: overallLevel,
        flags,
        totalFlags: flags.length,
        redFlags: flags.filter(f => f.level === 'red').length,
        yellowFlags: flags.filter(f => f.level === 'yellow').length,
        disclaimer: '⚕️ This is educational risk information only. Always consult a qualified healthcare professional.',
    };
}


// ═══════════════════════════════════════════════════════════
// 3. DECISION MAKER
// ═══════════════════════════════════════════════════════════

/**
 * Makes autonomous decisions based on patterns + risks.
 * Returns proactive cards, alerts, and recommendations.
 *
 * @param {Object} patterns - Output of analyzePatterns()
 * @param {Object} risks - Output of assessRisk()
 * @param {Object} profile - User profile
 * @returns {Object} Decisions and proactive cards
 */
export function makeDecisions(patterns, risks, profile = {}) {
    const decisions = [];
    const alerts = [];
    const proactiveCards = [];

    if (!patterns || !risks) {
        return { decisions, alerts, proactiveCards };
    }

    // ── Decision 1: Streak Reward ──
    if (patterns.streak >= 7) {
        proactiveCards.push({
            id: 'streak_reward',
            level: 'green',
            title: '🏆 Incredible Streak!',
            message: `${patterns.streak} days of perfect adherence! You're doing amazing.`,
            priority: 1,
        });
    } else if (patterns.streak >= 3) {
        proactiveCards.push({
            id: 'streak_good',
            level: 'green',
            title: '🔥 Keep It Up!',
            message: `${patterns.streak}-day streak! You're building a healthy habit.`,
            priority: 2,
        });
    }

    // ── Decision 2: Red Risk Alerts (Urgent) ──
    const redFlags = risks.flags?.filter(f => f.level === 'red') || [];
    if (redFlags.length > 0) {
        // Group by type for cleaner display
        const interactionReds = redFlags.filter(f => f.type === 'interaction' || f.type === 'interaction_fda');
        const symptomReds = redFlags.filter(f => f.type === 'symptom_match' || f.type === 'symptom_high');
        const amrReds = redFlags.filter(f => f.type === 'amr_critical');

        if (interactionReds.length > 0) {
            alerts.push({
                id: 'interaction_alert',
                level: 'red',
                title: '⚠️ Drug Interaction Detected',
                message: interactionReds[0].message,
                advice: interactionReds[0].advice,
                priority: 0, // highest
            });
            decisions.push({ type: 'escalate', action: 'show_interaction_warning', data: interactionReds });
        }

        if (symptomReds.length > 0) {
            alerts.push({
                id: 'symptom_alert',
                level: 'red',
                title: '🚨 Serious Symptom Detected',
                message: symptomReds[0].message,
                advice: symptomReds[0].advice || 'Seek medical attention immediately.',
                priority: 0,
            });
            decisions.push({ type: 'escalate', action: 'suggest_doctor_visit', reason: 'serious_symptoms' });
        }

        if (amrReds.length > 0) {
            alerts.push({
                id: 'amr_alert',
                level: 'red',
                title: '🦠 Antibiotic Resistance Risk',
                message: amrReds[0].message,
                advice: 'Do NOT stop your antibiotic. Contact your doctor.',
                priority: 0,
            });
        }
    }

    // ── Decision 3: Yellow Warnings ──
    const yellowFlags = risks.flags?.filter(f => f.level === 'yellow') || [];
    if (yellowFlags.length > 0 && redFlags.length === 0) {
        proactiveCards.push({
            id: 'yellow_warning',
            level: 'yellow',
            title: '⚡ Health Notice',
            message: yellowFlags[0].message,
            advice: yellowFlags[0].advice,
            priority: 3,
        });
    }

    // ── Decision 4: Adherence Worsening ──
    if (patterns.missedTrend === 'worsening') {
        proactiveCards.push({
            id: 'adherence_declining',
            level: 'yellow',
            title: '📉 Adherence Declining',
            message: 'Your medication adherence has been dropping recently. Missing doses reduces treatment effectiveness.',
            advice: 'Set reminders or try rearranging your schedule.',
            priority: 4,
        });
        decisions.push({ type: 'intervene', action: 'increase_reminder_frequency' });
    } else if (patterns.missedTrend === 'improving') {
        proactiveCards.push({
            id: 'adherence_improving',
            level: 'green',
            title: '📈 Great Progress!',
            message: 'Your adherence is improving. Keep up the good work!',
            priority: 5,
        });
    }

    // ── Decision 5: Time Optimization ──
    if (patterns.worstTime && patterns.bestTime && patterns.worstTime !== patterns.bestTime) {
        const worstMeds = patterns.total > 3 ? ` Consider shifting some ${patterns.worstTime} medicines to ${patterns.bestTime}.` : '';
        proactiveCards.push({
            id: 'time_optimize',
            level: 'green',
            title: '⏰ Timing Insight',
            message: `You take medicines best in the ${patterns.bestTime}. ${patterns.worstTime} is your weakest time.${worstMeds}`,
            priority: 6,
        });
    }

    // ── Decision 6: Polypharmacy Advice ──
    if (risks.flags?.some(f => f.type === 'polypharmacy' && f.level === 'red')) {
        decisions.push({ type: 'suggest', action: 'polypharmacy_review', message: 'Too many medicines. Suggest doctor review.' });
    }

    // ── Decision 7: All Done Today! ──
    if (patterns.isAllDone) {
        proactiveCards.push({
            id: 'all_done',
            level: 'green',
            title: '✅ All Done for Today!',
            message: 'You\'ve taken all your medicines. Great job taking care of your health!',
            priority: 10,
        });
    }

    // Sort proactive cards by priority (lower = more urgent)
    proactiveCards.sort((a, b) => (a.priority || 99) - (b.priority || 99));

    return {
        decisions,
        alerts,
        proactiveCards,
        totalAlerts: alerts.length,
        hasUrgent: alerts.some(a => a.level === 'red'),
    };
}


// ═══════════════════════════════════════════════════════════
// 4. GEMINI-POWERED INSIGHT (Natural Language)
// ═══════════════════════════════════════════════════════════

/**
 * Generate a personalized health insight using backend AI.
 * Also analyzes symptoms in context of current medicines.
 *
 * @param {Object[]} medicines - User's medicines
 * @param {Object} profile - User profile
 * @param {string[]} symptomIds - User's symptom IDs
 * @param {string} [userQuestion] - Optional specific question
 * @returns {Promise<string>} Natural language insight
 */
export async function getInsight(medicines = [], profile = {}, symptomIds = [], userQuestion = null) {
    const insight = await getAIInsight({
        medicines,
        profile,
        symptomIds,
        userQuestion: userQuestion || '',
    });

    if (!insight) {
        return 'Unable to generate AI insight right now. Your safety analysis is still active based on built-in rules.';
    }
    return insight;
}


// ─── Helper: Risk Priority ──────────────────────────────

function higherRisk(current, incoming) {
    const priority = { red: 3, yellow: 2, green: 1 };
    return (priority[incoming] || 0) > (priority[current] || 0) ? incoming : current;
}

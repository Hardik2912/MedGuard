/**
 * ═══════════════════════════════════════════════════════════
 * MEDGUARD — useBrain() React Hook
 * ═══════════════════════════════════════════════════════════
 *
 * Runs the AI Brain on component mount. Provides:
 *   - patterns (adherence analysis)
 *   - risks (safety assessment)
 *   - decisions (proactive cards & alerts)
 *   - brainLoading state
 *   - refreshBrain() to re-run analysis
 */

import { useState, useEffect, useCallback } from 'react';
import { safeQuery } from './safeAsync';
import { analyzePatterns, assessRisk, makeDecisions } from './medBrain';

/**
 * @param {Object} user - Auth user object (must have .id)
 * @param {Object[]} medicines - Already fetched medicines array (optional)
 * @returns {{ patterns, risks, decisions, brainLoading, refreshBrain }}
 */
export function useBrain(user, medicines = null) {
    const [patterns, setPatterns] = useState(null);
    const [risks, setRisks] = useState(null);
    const [decisions, setDecisions] = useState(null);
    const [brainLoading, setBrainLoading] = useState(true);

    const think = useCallback(async (meds) => {
        if (!user?.id) {
            setBrainLoading(false);
            return;
        }

        setBrainLoading(true);

        try {
            // 1. Get medicines (use provided or fetch)
            const medsData = meds || await safeQuery(
                'medicines',
                (sb) => sb.from('medicines').select('*').eq('user_id', user.id),
                []
            );

            // 2. Get adherence log
            const adherenceLog = await safeQuery(
                'adherence_log',
                (sb) => sb.from('adherence_log')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('date', { ascending: false })
                    .limit(30),
                []
            );

            // 3. Get user profile
            const profile = await safeQuery(
                'profiles',
                (sb) => sb.from('profiles').select('*').eq('id', user.id).single(),
                {}
            );

            // 4. Get symptoms
            const symptomRows = await safeQuery(
                'symptoms',
                (sb) => sb.from('symptoms').select('symptom_id').eq('user_id', user.id),
                null // null to detect if table doesn't exist
            );

            // Fallback to localStorage if symptoms table doesn't exist yet
            let symptomIds = [];
            if (symptomRows === null) {
                try {
                    symptomIds = JSON.parse(localStorage.getItem('medguard_symptoms') || '[]');
                } catch (e) { /* empty */ }
            } else {
                symptomIds = symptomRows.map(s => s.symptom_id);
            }

            // 5. RUN THE BRAIN 🧠
            const patternResult = analyzePatterns(medsData, adherenceLog);
            const riskResult = await assessRisk(medsData, profile, symptomIds);
            const decisionResult = makeDecisions(patternResult, riskResult, profile);

            setPatterns(patternResult);
            setRisks(riskResult);
            setDecisions(decisionResult);
        } catch (err) {
            console.error('[Brain:useBrain] Error during analysis:', err);
            // Set safe defaults so UI never crashes
            setPatterns({ streak: 0, todayAdherence: 0, taken: 0, total: 0, skipped: 0, pending: 0, isAllDone: false });
            setRisks({ level: 'green', flags: [], totalFlags: 0, redFlags: 0, yellowFlags: 0 });
            setDecisions({ decisions: [], alerts: [], proactiveCards: [], totalAlerts: 0, hasUrgent: false });
        } finally {
            setBrainLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        think(medicines);
    }, [think, medicines]);

    const refreshBrain = useCallback((meds) => {
        think(meds || medicines);
    }, [think, medicines]);

    return { patterns, risks, decisions, brainLoading, refreshBrain };
}

/**
 * ═══════════════════════════════════════════════════════════
 * MEDGUARD — Crash-Proof Utilities
 * ═══════════════════════════════════════════════════════════
 *
 * Universal safety wrappers for all async operations.
 * These ensure the app NEVER crashes due to network errors,
 * API failures, or unexpected data.
 */

import { supabase } from './supabase';

// ─── Safe Async Wrapper ─────────────────────────────────
/**
 * Wraps any async function with try/catch + optional retry + fallback.
 * 
 * @param {Function} fn - The async function to execute
 * @param {Object} options
 * @param {*} options.fallback - Value to return on failure (default: null)
 * @param {number} options.retries - Number of retry attempts (default: 1)
 * @param {string} options.label - Label for console logging
 * @param {number} options.retryDelay - Delay between retries in ms (default: 500)
 * @returns {Promise<*>} Result of fn() or fallback value
 */
export async function safeAsync(fn, { fallback = null, retries = 1, label = '', retryDelay = 500 } = {}) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const isLastAttempt = attempt === retries;
            console.error(
                `[SafeAsync${label ? ':' + label : ''}] Attempt ${attempt + 1}/${retries + 1} failed:`,
                err?.message || err
            );
            if (isLastAttempt) return fallback;
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
    return fallback;
}

// ─── Safe Supabase Query ────────────────────────────────
/**
 * Wraps a Supabase query chain. Never throws.
 * 
 * Usage:
 *   const data = await safeQuery('profiles', (sb) =>
 *     sb.from('profiles').select('*').eq('id', userId).single()
 *   );
 *
 * @param {string} table - Table name (for logging)
 * @param {Function} queryFn - Function that receives supabase client and returns a query
 * @param {*} fallback - Fallback value on error (default: null)
 * @returns {Promise<*>} Query result data or fallback
 */
export async function safeQuery(table, queryFn, fallback = null) {
    try {
        const { data, error } = await queryFn(supabase);
        if (error) {
            console.error(`[DB:${table}]`, error.message || error);
            return fallback;
        }
        return data ?? fallback;
    } catch (err) {
        console.error(`[DB:${table}] Unexpected:`, err?.message || err);
        return fallback;
    }
}

// ─── Safe Supabase Mutation ─────────────────────────────
/**
 * Wraps a Supabase insert/update/delete. Returns { success, error }.
 * Never throws.
 * 
 * Usage:
 *   const { success, error } = await safeMutation('medicines', (sb) =>
 *     sb.from('medicines').update({ status: 'taken' }).eq('id', medId)
 *   );
 *
 * @param {string} table - Table name (for logging)
 * @param {Function} mutationFn - Function that receives supabase client
 * @returns {Promise<{success: boolean, error: string|null, data: *}>}
 */
export async function safeMutation(table, mutationFn) {
    try {
        const { data, error } = await mutationFn(supabase);
        if (error) {
            console.error(`[DB:${table}:mutate]`, error.message || error);
            return { success: false, error: error.message, data: null };
        }
        return { success: true, error: null, data };
    } catch (err) {
        console.error(`[DB:${table}:mutate] Unexpected:`, err?.message || err);
        return { success: false, error: err?.message || 'Unknown error', data: null };
    }
}

// ─── Safe JSON Parse ────────────────────────────────────
/**
 * Safely parses a JSON string. Returns fallback on failure.
 */
export function safeJsonParse(str, fallback = null) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return fallback;
    }
}

// ─── Safe LocalStorage ──────────────────────────────────
/**
 * Safely read from localStorage with JSON parsing.
 */
export function safeStorageGet(key, fallback = null) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
    } catch (e) {
        return fallback;
    }
}

/**
 * Safely write to localStorage with JSON stringification.
 */
export function safeStorageSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (err) {
        console.error(`[Storage:${key}]`, err?.message || err);
        return false;
    }
}

// ─── Safe Fetch (External APIs) ─────────────────────────
/**
 * Safe wrapper for fetch() with timeout, retry, and JSON parsing.
 * 
 * @param {string} url
 * @param {Object} options - fetch options + { timeout, retries, label }
 * @returns {Promise<{data: *, error: string|null}>}
 */
export async function safeFetch(url, { timeout = 15000, retries = 1, label = '', ...fetchOptions } = {}) {
    const result = await safeAsync(
        async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(url, {
                    ...fetchOptions,
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData?.error?.message || `HTTP ${response.status}`);
                }

                const data = await response.json();
                return { data, error: null };
            } catch (err) {
                clearTimeout(timeoutId);
                throw err;
            }
        },
        { fallback: { data: null, error: 'Request failed' }, retries, label }
    );

    return result;
}

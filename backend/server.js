import express from 'express';
import cors from 'cors';
import { assessMedicationRisk, normalizeMedicines } from './riskEngine.js';
import Fuse from 'fuse.js';
import Tesseract from 'tesseract.js';
import { CANONICAL_DRUGS, DRUG_SYNONYMS } from './riskKnowledge.js';
import { createVoiceService } from './voiceService.js';

const app = express();

const PORT = Number(process.env.PORT || 8787);
const AI_PROVIDER = (process.env.AI_PROVIDER || 'ollama').toLowerCase();
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || 'llama3.1:8b-instruct-q4_K_M';
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'llava:7b';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const OCR_STRATEGY = (process.env.OCR_STRATEGY || 'hybrid').toLowerCase(); // hybrid | tesseract_only
const VOICE_PROVIDER = (process.env.VOICE_PROVIDER || 'ollama').toLowerCase(); // ollama | bhashini | sarvam
const BHASHINI_BASE_URL = process.env.BHASHINI_BASE_URL || 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
const BHASHINI_TIMEOUT_MS = Number(process.env.BHASHINI_TIMEOUT_MS || 45000);
const BHASHINI_API_KEY = process.env.BHASHINI_API_KEY || '';
const BHASHINI_API_KEY_HEADER = process.env.BHASHINI_API_KEY_HEADER || 'x-api-key';
const BHASHINI_USER_ID = process.env.BHASHINI_USER_ID || '';
const BHASHINI_TRANSLATE_URL = process.env.BHASHINI_TRANSLATE_URL || BHASHINI_BASE_URL;
const BHASHINI_STT_URL = process.env.BHASHINI_STT_URL || BHASHINI_BASE_URL;
const BHASHINI_TTS_URL = process.env.BHASHINI_TTS_URL || BHASHINI_BASE_URL;
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';
const SARVAM_BASE_URL = process.env.SARVAM_BASE_URL || 'https://api.sarvam.ai';
const SARVAM_TIMEOUT_MS = Number(process.env.SARVAM_TIMEOUT_MS || 45000);
const SARVAM_TRANSLATE_URL = process.env.SARVAM_TRANSLATE_URL || `${SARVAM_BASE_URL}/translate`;
const SARVAM_TTS_URL = process.env.SARVAM_TTS_URL || `${SARVAM_BASE_URL}/text-to-speech`;
const SARVAM_STT_URL = process.env.SARVAM_STT_URL || `${SARVAM_BASE_URL}/speech-to-text-translate`;
const SARVAM_MODEL = process.env.SARVAM_TTS_MODEL || 'bulbul:v3';
const SARVAM_DEFAULT_SPEAKER = process.env.SARVAM_TTS_SPEAKER || '';

const VOICE_SUPPORTED_LANGUAGES = [
  { app: 'en-IN', bhashini: 'en', label: 'English (India)' },
  { app: 'hi-IN', bhashini: 'hi', label: 'Hindi' },
  { app: 'ta-IN', bhashini: 'ta', label: 'Tamil' },
  { app: 'te-IN', bhashini: 'te', label: 'Telugu' },
  { app: 'mr-IN', bhashini: 'mr', label: 'Marathi' },
  { app: 'kn-IN', bhashini: 'kn', label: 'Kannada' },
  { app: 'ml-IN', bhashini: 'ml', label: 'Malayalam' },
  { app: 'gu-IN', bhashini: 'gu', label: 'Gujarati' },
  { app: 'pa-IN', bhashini: 'pa', label: 'Punjabi' },
  { app: 'bn-IN', bhashini: 'bn', label: 'Bengali' },
  { app: 'or-IN', bhashini: 'or', label: 'Odia' },
  { app: 'as-IN', bhashini: 'as', label: 'Assamese' },
  { app: 'ur-IN', bhashini: 'ur', label: 'Urdu' },
  { app: 'ne-IN', bhashini: 'ne', label: 'Nepali' },
  { app: 'sa-IN', bhashini: 'sa', label: 'Sanskrit' },
];
const APP_LANGUAGE_LABELS = {
  'en-IN': 'English (India)',
  'hi-IN': 'Hindi',
  'bn-IN': 'Bengali',
  'ta-IN': 'Tamil',
  'te-IN': 'Telugu',
  'kn-IN': 'Kannada',
  'ml-IN': 'Malayalam',
  'mr-IN': 'Marathi',
  'gu-IN': 'Gujarati',
  'pa-IN': 'Punjabi',
  'od-IN': 'Odia',
};

app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN }));
app.use(express.json({ limit: '35mb' }));

const OCR_DEMO_FALLBACK = [
  {
    name: 'Amoxicillin',
    dosage: '500mg',
    type: 'antibiotic',
    frequency: 'Three Times Daily',
    times: ['08:00', '14:00', '20:00'],
  },
  {
    name: 'Paracetamol',
    dosage: '650mg',
    type: 'pain',
    frequency: 'Twice Daily',
    times: ['09:00', '21:00'],
  },
  {
    name: 'Pantoprazole',
    dosage: '40mg',
    type: 'other',
    frequency: 'Once Daily',
    times: ['07:00'],
  },
];

function jsonError(res, status, message) {
  res.status(status).json({ error: message });
}

async function postJson(url, body, timeoutMs = 30000, extraHeaders = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const details = data?.error || data?.message || `HTTP ${response.status}`;
      const detailText = typeof details === 'string'
        ? details
        : JSON.stringify(details);
      throw new Error(detailText);
    }

    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function ollamaChat({ model, system, userText, images = [], timeoutMs = 120000 }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({
    role: 'user',
    content: userText || 'Help with health safety guidance.',
    images: images.length > 0 ? images : undefined,
  });

  const data = await postJson(
    `${OLLAMA_BASE_URL}/api/chat`,
    { model, stream: false, messages, options: { temperature: 0.2 } },
    timeoutMs
  );

  return data?.message?.content || '';
}

function parseJsonArrayFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseJsonObjectFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeLanguageCode(input = '') {
  const raw = String(input || '').trim();
  if (!raw) return 'en-IN';

  const exact = VOICE_SUPPORTED_LANGUAGES.find((l) => l.app.toLowerCase() === raw.toLowerCase());
  if (exact) return exact.app;

  const base = raw.split('-')[0].toLowerCase();
  const byBase = VOICE_SUPPORTED_LANGUAGES.find((l) => l.app.toLowerCase().startsWith(`${base}-`) || l.bhashini === base);
  return byBase?.app || 'en-IN';
}

function normalizeTtsLanguageCode(input = '') {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return 'en-IN';

  const map = {
    english: 'en-IN',
    en: 'en-IN',
    'en-in': 'en-IN',
    hindi: 'hi-IN',
    hi: 'hi-IN',
    'hi-in': 'hi-IN',
    bho: 'hi-IN',
    'bho-in': 'hi-IN',
    awadhi: 'hi-IN',
    tamil: 'ta-IN',
    ta: 'ta-IN',
    'ta-in': 'ta-IN',
    telugu: 'te-IN',
    te: 'te-IN',
    'te-in': 'te-IN',
    kannada: 'kn-IN',
    kn: 'kn-IN',
    'kn-in': 'kn-IN',
    bengali: 'bn-IN',
    bn: 'bn-IN',
    'bn-in': 'bn-IN',
    marathi: 'mr-IN',
    mr: 'mr-IN',
    'mr-in': 'mr-IN',
    punjabi: 'pa-IN',
    pa: 'pa-IN',
    'pa-in': 'pa-IN',
    gujarati: 'gu-IN',
    gu: 'gu-IN',
    'gu-in': 'gu-IN',
    odia: 'od-IN',
    oriya: 'od-IN',
    od: 'od-IN',
    'od-in': 'od-IN',
  };

  return map[raw] || normalizeLanguageCode(raw);
}

function appToBhashiniLang(appLang = '') {
  const norm = normalizeLanguageCode(appLang);
  return VOICE_SUPPORTED_LANGUAGES.find((l) => l.app === norm)?.bhashini || 'en';
}

function bhashiniToAppLang(lang = '') {
  const raw = String(lang || '').toLowerCase();
  if (!raw) return 'en-IN';
  const base = raw.split('-')[0];
  return VOICE_SUPPORTED_LANGUAGES.find((l) => l.bhashini === base)?.app || 'en-IN';
}

function guessLanguageFromText(text = '') {
  const t = String(text || '');
  if (!t.trim()) return 'en-IN';
  if (/[ऀ-ॿ]/.test(t)) return 'hi-IN';
  if (/[ঀ-৿]/.test(t)) return 'bn-IN';
  if (/[઀-૿]/.test(t)) return 'gu-IN';
  if (/[਀-੿]/.test(t)) return 'pa-IN';
  if (/[஀-௿]/.test(t)) return 'ta-IN';
  if (/[ఀ-౿]/.test(t)) return 'te-IN';
  if (/[ಀ-೿]/.test(t)) return 'kn-IN';
  if (/[ഀ-ൿ]/.test(t)) return 'ml-IN';
  if (/[଀-୿]/.test(t)) return 'or-IN';
  if (/[؀-ۿ]/.test(t)) return 'ur-IN';
  return 'en-IN';
}

function findValueByKeyDeep(node, wantedKeys = []) {
  if (!node || typeof node !== 'object') return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const v = findValueByKeyDeep(item, wantedKeys);
      if (v) return v;
    }
    return null;
  }

  for (const key of Object.keys(node)) {
    const value = node[key];
    if (wantedKeys.includes(key) && typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  for (const key of Object.keys(node)) {
    const value = node[key];
    if (value && typeof value === 'object') {
      const v = findValueByKeyDeep(value, wantedKeys);
      if (v) return v;
    }
  }
  return null;
}

function buildBhashiniHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (BHASHINI_API_KEY) {
    headers[BHASHINI_API_KEY_HEADER] = BHASHINI_API_KEY;
    // Many gateways accept bearer auth; harmless when ignored.
    headers.Authorization = `Bearer ${BHASHINI_API_KEY}`;
  }
  if (BHASHINI_USER_ID) headers.userID = BHASHINI_USER_ID;
  return headers;
}

function buildSarvamHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (SARVAM_API_KEY) {
    headers['api-subscription-key'] = SARVAM_API_KEY;
    headers['x-api-key'] = SARVAM_API_KEY;
    headers.Authorization = `Bearer ${SARVAM_API_KEY}`;
  }
  return headers;
}

function requireSarvamKey() {
  if (!SARVAM_API_KEY) {
    const err = new Error('SARVAM_API_KEY is missing');
    err.code = 'missing_sarvam_key';
    throw err;
  }
}

async function sarvamTranslate({ text, sourceAppLang = 'en-IN', targetAppLang = 'en-IN' }) {
  requireSarvamKey();
  const input = String(text || '').trim();
  if (!input) return '';

  const source_language_code = normalizeLanguageCode(sourceAppLang);
  const target_language_code = normalizeLanguageCode(targetAppLang);

  const payload = {
    input,
    source_language_code,
    target_language_code,
  };

  const data = await postJson(SARVAM_TRANSLATE_URL, payload, SARVAM_TIMEOUT_MS, buildSarvamHeaders());
  const translated = findValueByKeyDeep(data, ['translated_text', 'translatedText', 'target', 'text', 'translation']);
  if (!translated) throw new Error('Sarvam translation parse failed');
  return translated;
}

async function sarvamTts({ text, language = 'en-IN', speaker = '' }) {
  requireSarvamKey();
  const input = String(text || '').trim();
  if (!input) throw new Error('text is required for tts');

  const target_language_code = normalizeTtsLanguageCode(language);
  const payload = {
    text: input,
    target_language_code,
    model: SARVAM_MODEL,
  };
  const chosenSpeaker = String(speaker || SARVAM_DEFAULT_SPEAKER || '').trim().toLowerCase();
  if (chosenSpeaker) payload.speaker = chosenSpeaker;

  const data = await postJson(SARVAM_TTS_URL, payload, SARVAM_TIMEOUT_MS, buildSarvamHeaders());

  const normalizeBase64 = (value) => {
    if (!value || typeof value !== 'string') return '';
    const raw = value.trim();
    if (!raw) return '';
    if (raw.startsWith('data:')) {
      const idx = raw.indexOf('base64,');
      if (idx !== -1) return raw.slice(idx + 'base64,'.length).trim();
    }
    return raw;
  };

  const maybeFromAudiosArray = Array.isArray(data?.audios)
    ? data.audios
        .map((entry) => {
          if (typeof entry === 'string') return entry;
          if (!entry || typeof entry !== 'object') return '';
          return (
            entry.audio_base64 ||
            entry.audioContent ||
            entry.base64 ||
            entry.audio ||
            ''
          );
        })
        .find((v) => typeof v === 'string' && v.trim())
    : '';

  const candidate =
    maybeFromAudiosArray ||
    data?.audio_base64 ||
    data?.audioContent ||
    data?.base64 ||
    data?.audio ||
    data?.output ||
    data?.result ||
    data?.data?.audio_base64 ||
    data?.data?.audio ||
    data?.raw ||
    '';

  const extractedAudio = normalizeBase64(candidate);
  if (!extractedAudio) {
    const debug = typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300);
    throw new Error(`Sarvam TTS parse failed: ${debug}`);
  }

  return {
    audioBase64: extractedAudio,
    mimeType: data?.mime_type || data?.content_type || 'audio/wav',
  };
}

function requireBhashiniKey() {
  if (!BHASHINI_API_KEY) {
    const err = new Error('BHASHINI_API_KEY is missing');
    err.code = 'missing_bhashini_key';
    throw err;
  }
}

async function bhashiniTranslate({ text, sourceAppLang, targetAppLang }) {
  requireBhashiniKey();
  const sourceLanguage = appToBhashiniLang(sourceAppLang);
  const targetLanguage = appToBhashiniLang(targetAppLang);
  const input = String(text || '').trim();
  if (!input) return '';

  const payload = {
    pipelineTasks: [
      {
        taskType: 'translation',
        config: {
          language: {
            sourceLanguage,
            targetLanguage,
          },
        },
      },
    ],
    inputData: {
      input: [{ source: input }],
    },
  };

  const data = await postJson(BHASHINI_TRANSLATE_URL, payload, BHASHINI_TIMEOUT_MS, buildBhashiniHeaders());
  const translated = findValueByKeyDeep(data, ['target', 'translatedText', 'translated_text', 'translation', 'text']);
  if (!translated) throw new Error('Bhashini translation parse failed');
  return translated;
}

async function bhashiniAsr({ audioBase64, languageHint = 'en-IN' }) {
  requireBhashiniKey();
  const sourceLanguage = appToBhashiniLang(languageHint);
  const payload = {
    pipelineTasks: [
      {
        taskType: 'asr',
        config: {
          language: { sourceLanguage },
          audioFormat: 'wav',
        },
      },
    ],
    inputData: {
      audio: [{ audioContent: String(audioBase64 || '') }],
    },
  };

  const data = await postJson(BHASHINI_STT_URL, payload, BHASHINI_TIMEOUT_MS, buildBhashiniHeaders());
  const transcript = findValueByKeyDeep(data, ['source', 'text', 'transcript', 'recognizedText', 'output']);
  if (!transcript) throw new Error('Bhashini ASR parse failed');
  return transcript;
}

async function bhashiniTts({ text, language = 'en-IN', gender = 'female' }) {
  requireBhashiniKey();
  const sourceLanguage = appToBhashiniLang(language);
  const payload = {
    pipelineTasks: [
      {
        taskType: 'tts',
        config: {
          language: { sourceLanguage },
          gender: String(gender || 'female').toLowerCase(),
        },
      },
    ],
    inputData: {
      input: [{ source: String(text || '') }],
    },
  };

  const data = await postJson(BHASHINI_TTS_URL, payload, BHASHINI_TIMEOUT_MS, buildBhashiniHeaders());
  const audioBase64 = findValueByKeyDeep(data, ['audioContent', 'audio', 'audioBase64']);
  if (!audioBase64) throw new Error('Bhashini TTS parse failed');
  return {
    audioBase64,
    mimeType: 'audio/wav',
  };
}

async function translateToEnglishWithOllama({ transcript, languageHint }) {
  const detectPrompt = [
    'Detect the language of this user utterance and translate it to English.',
    'Return ONLY JSON with keys: detected_language, english_text.',
    `Utterance: ${transcript}`,
    languageHint ? `Language hint: ${languageHint}` : '',
  ].join('\n');

  const detectRaw = await ollamaChat({
    model: OLLAMA_CHAT_MODEL,
    system: 'You are a language detection and translation assistant. Output strict JSON only.',
    userText: detectPrompt,
    timeoutMs: 45000,
  });

  const detectJson = parseJsonObjectFromText(detectRaw) || {};
  return {
    detectedLanguage: normalizeLanguageCode(detectJson.detected_language || languageHint || guessLanguageFromText(transcript)),
    englishUserText: String(detectJson.english_text || transcript).trim(),
  };
}

async function translateFromEnglishWithOllama({ englishText, targetLanguage }) {
  const normalizedTarget = normalizeLanguageCode(targetLanguage || 'en-IN');
  if (normalizedTarget === 'en-IN') return String(englishText || '');
  const targetLabel = APP_LANGUAGE_LABELS[normalizedTarget] || normalizedTarget;
  const translateBackPrompt = [
    'Translate the following English response into the target language.',
    'IMPORTANT: Output MUST be in the target language script, not English.',
    'Keep medicine names unchanged.',
    'Return ONLY JSON with key: translated_text.',
    `Target language code: ${normalizedTarget}`,
    `Target language name: ${targetLabel}`,
    `English response: ${englishText}`,
  ].join('\n');

  const translatedRaw = await ollamaChat({
    model: OLLAMA_CHAT_MODEL,
    system: 'You are a translation assistant. Output strict JSON only.',
    userText: translateBackPrompt,
    timeoutMs: 45000,
  });
  const translatedJson = parseJsonObjectFromText(translatedRaw) || {};
  const candidate = String(translatedJson.translated_text || '').trim();
  return candidate || String(englishText || '');
}

async function getEnglishSafetyReply({ englishUserText, medContext }) {
  if (AI_PROVIDER !== 'ollama') {
    return 'I can provide general medication safety guidance only. Please consult your doctor for medical decisions.';
  }
  const aiEnglishPrompt = [
    'You are MedGuard medical safety assistant.',
    'Reply in English only.',
    'Be concise and practical.',
    'Do not diagnose or prescribe.',
    `Current medicines: ${medContext}`,
    `User query in English: ${englishUserText}`,
  ].join('\n');

  const aiEnglishResponse = await ollamaChat({
    model: OLLAMA_CHAT_MODEL,
    system: 'Medication safety assistant for educational use. English output only.',
    userText: aiEnglishPrompt,
    timeoutMs: 60000,
  });

  return String(aiEnglishResponse || 'I could not generate a response at the moment.').trim();
}

const voiceService = createVoiceService({
  sarvamApiKey: SARVAM_API_KEY,
  sarvamBaseUrl: SARVAM_BASE_URL,
  sarvamTimeoutMs: SARVAM_TIMEOUT_MS,
  sarvamTranslateUrl: SARVAM_TRANSLATE_URL,
  sarvamTtsUrl: SARVAM_TTS_URL,
  sarvamSttUrl: SARVAM_STT_URL,
  sarvamModel: SARVAM_MODEL,
  sarvamSpeaker: SARVAM_DEFAULT_SPEAKER,
  aiReasoning: getEnglishSafetyReply,
});

function normalizeMedicine(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const safeType = String(raw.type || 'other').toLowerCase();
  const allowedType = ['antibiotic', 'heart', 'diabetes', 'pain', 'other'].includes(safeType)
    ? safeType
    : 'other';

  const times = Array.isArray(raw.times) && raw.times.length > 0
    ? raw.times.map((t) => String(t))
    : ['08:00'];

  const baseName = String(raw.name || 'Unknown');
  const fuzzy = fuzzyNormalizeName(raw.normalizedName || baseName);

  return {
    name: baseName,
    normalizedName: fuzzy.normalized || baseName.toLowerCase(),
    confidence: typeof raw.confidence === 'number' ? raw.confidence : fuzzy.confidence,
    dosage: String(raw.dosage || 'N/A'),
    type: allowedType,
    frequency: String(raw.frequency || 'Once Daily'),
    times,
  };
}

function parseScheduleToFrequency(scheduleText = '') {
  const s = String(scheduleText).trim();
  if (!s) return 'Once Daily';
  if (s === '1-0-1') return 'Twice Daily';
  if (s === '1-1-1') return 'Three Times Daily';
  if (s === '0-0-1' || s === '1-0-0' || s === '0-1-0') return 'Once Daily';
  return 'As Directed';
}

function parseTimesFromSchedule(scheduleText = '') {
  const s = String(scheduleText).trim();
  if (s === '1-0-1') return ['08:00', '20:00'];
  if (s === '1-1-1') return ['08:00', '14:00', '20:00'];
  if (s === '1-0-0') return ['08:00'];
  if (s === '0-1-0') return ['14:00'];
  if (s === '0-0-1') return ['20:00'];
  return ['08:00'];
}

function guessTypeFromName(name = '') {
  const n = String(name).toLowerCase();
  if (['amoxicillin', 'azith', 'cefix', 'levoflox', 'metronid'].some((k) => n.includes(k))) return 'antibiotic';
  if (['metformin', 'insulin', 'glimepiride'].some((k) => n.includes(k))) return 'diabetes';
  if (['amlodipine', 'telmisartan', 'lisinopril', 'atorvastatin', 'aspirin', 'clopidogrel'].some((k) => n.includes(k))) return 'heart';
  if (['paracetamol', 'diclofenac', 'ibuprofen'].some((k) => n.includes(k))) return 'pain';
  return 'other';
}

const medicineFuse = new Fuse(CANONICAL_DRUGS, {
  includeScore: true,
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 3,
});

function fuzzyNormalizeName(rawName = '') {
  const cleaned = String(rawName || '').trim().toLowerCase();
  if (!cleaned) return { normalized: rawName, confidence: 0 };
  const result = medicineFuse.search(cleaned, { limit: 1 })[0];
  if (!result) return { normalized: cleaned, confidence: 0.4 };
  const score = Math.max(0, Math.min(1, 1 - (result.score || 0)));
  return { normalized: result.item, confidence: Number(score.toFixed(3)) };
}

async function ocrWithTesseract(imageBase64) {
  try {
    const dataUrl = `data:image/jpeg;base64,${imageBase64}`;
    const result = await Tesseract.recognize(dataUrl, 'eng');
    return result?.data?.text || '';
  } catch (err) {
    console.error('[OCR:tesseract]', err?.message || err);
    return '';
  }
}

function parseMedicinesFromLines(text = '') {
  const canonicalTokens = CANONICAL_DRUGS
    .map((d) => String(d).toLowerCase())
    .filter((d) => d.length >= 4);

  const normalizedText = String(text || '')
    .replace(/[\r\t]+/g, ' ')
    .replace(/([^\n])\s+(\d+\))/g, '$1\n$2') // split " ... 1) ... 2) ..."
    .replace(/\s{2,}/g, ' ')
    .trim();

  const lines = normalizedText
    .split('\n')
    .flatMap((l) => l.split(/\s+(?=\d+\))/g))
    .map((l) => l.trim())
    .filter(Boolean);

  const NON_MED_LINE_HINTS = [
    'hospital',
    'clinic',
    'dr.',
    'doctor',
    'mbbs',
    'md',
    'reg',
    'date',
    'patient',
    'name:',
    'gender',
    'age',
    'address',
    'signature',
    'rx',
  ];

  const looksLikeMedicineLine = (line) => {
    const lower = line.toLowerCase();
    if (NON_MED_LINE_HINTS.some((hint) => lower.includes(hint))) return false;

    // Strong medicine signals
    const hasNumbering = /^\d+\)/.test(lower);
    const hasForm = /\b(tab|tablet|cap|capsule|syrup|inj|injection)\b/.test(lower);
    const hasDose = /\b\d+\s?(mg|mcg|g|ml)\b/.test(lower);
    const hasSchedule = /\b[01]-[01]-[01]\b/.test(lower) || /\b(od|bd|tds|hs|sos)\b/i.test(line);
    const hasKnownDrug = canonicalTokens.some((drug) => lower.includes(drug));

    return (
      (hasForm && (hasDose || hasSchedule || hasKnownDrug)) ||
      (hasNumbering && (hasDose || hasSchedule || hasKnownDrug || hasForm)) ||
      (hasKnownDrug && (hasDose || hasSchedule))
    );
  };

  const parsed = [];
  for (const line of lines) {
    if (!looksLikeMedicineLine(line)) continue;

    // Example: "1) Tab. Metformin 500mg - 1-0-1 (after food)"
    const rx = /(?:^\d+\)|^\-)?\s*(?:tab\.?|cap\.?|tablet|capsule|syrup|inj\.?|injection)?\s*([A-Za-z][A-Za-z0-9\-\s]{1,80}?)(?:\s+(\d+\s?(?:mg|mcg|g|ml)))?(?:\s*[-–]?\s*([01]-[01]-[01]))?/i;
    const m = line.match(rx);
    if (!m) continue;
    let name = (m[1] || '').trim();
    name = name.replace(/\(.*?\)/g, '').replace(/\b(after|before)\b.*$/i, '').trim();
    name = name.replace(/\s+/g, ' ');
    if (!name || name.length < 3) continue;
    const dosage = (m[2] || 'N/A').replace(/\s+/g, '');
    const schedule = (m[3] || '').trim();

    const fuzzy = fuzzyNormalizeName(name);
    parsed.push({
      name,
      normalizedName: fuzzy.normalized || name.toLowerCase(),
      confidence: fuzzy.confidence,
      dosage,
      type: guessTypeFromName(name),
      frequency: parseScheduleToFrequency(schedule),
      times: parseTimesFromSchedule(schedule),
    });
  }

  // de-duplicate by normalized lowercase name
  const seen = new Set();
  return parsed.filter((p) => {
    const k = p.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function isValidExtractedMedicine(med) {
  const name = String(med?.name || '').trim().toLowerCase();
  if (!name) return false;
  if (name === 'unknown') return false;
  if (name.includes('medicine name') || name.includes('drug name')) return false;
  if (name.length < 3) return false;
  return true;
}

function extractKnownDrugsFromText(text = '') {
  const lower = String(text || '').toLowerCase();
  if (!lower) return [];

  const normalized = lower.replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ');
  const found = [];
  const seen = new Set();

  const candidates = [...new Set([
    ...CANONICAL_DRUGS,
    ...Object.keys(DRUG_SYNONYMS || {}),
  ])];

  for (const token of candidates) {
    const t = String(token || '').toLowerCase().trim();
    if (!t || t.length < 4) continue;

    const pattern = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (!pattern.test(normalized)) continue;

    const mapped = DRUG_SYNONYMS[t] || t;
    if (seen.has(mapped)) continue;
    seen.add(mapped);

    // Try to find nearby dosage e.g., "metformin 500mg"
    const dosageRegex = new RegExp(`${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(\\d+\\s?(?:mg|mcg|g|ml))`, 'i');
    const dMatch = normalized.match(dosageRegex);

    found.push({
      name: mapped,
      normalizedName: mapped,
      confidence: 0.55,
      dosage: dMatch?.[1]?.replace(/\s+/g, '') || 'N/A',
      type: guessTypeFromName(mapped),
      frequency: 'As Directed',
      times: ['08:00'],
    });
  }

  return found;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    provider: AI_PROVIDER,
    voiceProvider: VOICE_PROVIDER,
    ollamaBaseUrl: OLLAMA_BASE_URL,
    chatModel: OLLAMA_CHAT_MODEL,
    visionModel: OLLAMA_VISION_MODEL,
    supportedVoiceLanguages: VOICE_SUPPORTED_LANGUAGES.map((l) => l.app),
  });
});

app.post('/api/ai/chat', async (req, res) => {
  const { message, uploadedFile, medicines = [] } = req.body || {};
  if (!message && !uploadedFile) return jsonError(res, 400, 'message or uploadedFile is required');

  try {
    if (AI_PROVIDER !== 'ollama') {
      return res.json({
        reply: 'AI provider is not configured to ollama. Set AI_PROVIDER=ollama in backend env.',
        fallback: true,
      });
    }

    const medContext = Array.isArray(medicines) && medicines.length > 0
      ? `Current medicines: ${medicines.map((m) => `${m?.name || 'Unknown'} (${m?.dosage || '?'})`).join(', ')}`
      : 'No medicine context provided.';

    const system = [
      'You are MedGuard AI, a medication safety assistant.',
      'Provide concise educational guidance only.',
      'Never diagnose or prescribe.',
      'Always include a short disclaimer to consult a qualified clinician.',
    ].join(' ');

    const userText = [
      medContext,
      message ? `User message: ${message}` : 'Analyze uploaded medical document/image.',
    ].join('\n');

    const hasFile = !!uploadedFile?.base64 && !!uploadedFile?.mimeType;
    const model = hasFile ? OLLAMA_VISION_MODEL : OLLAMA_CHAT_MODEL;
    const images = hasFile ? [String(uploadedFile.base64)] : [];

    const reply = await ollamaChat({ model, system, userText, images });
    if (!reply) throw new Error('Empty model response');

    return res.json({ reply, provider: AI_PROVIDER, model, fallback: false });
  } catch (err) {
    console.error('[AI chat]', err?.message || err);
    return res.json({
      reply: 'I could not process that request right now. Safety checks in MedGuard are still active. Please try again.',
      fallback: true,
    });
  }
});

app.post('/api/ai/insight', async (req, res) => {
  const { medicines = [], profile = {}, symptomIds = [], userQuestion = '' } = req.body || {};

  try {
    if (AI_PROVIDER !== 'ollama') {
      return res.json({
        insight: 'AI insight provider not available. Built-in rule-based safety checks remain active.',
        fallback: true,
      });
    }

    const medList = medicines
      .map((m) => `${m?.name || 'Unknown'} (${m?.dosage || '?'}, ${m?.frequency || '?'}, status: ${m?.status || '?'})`)
      .join('\n');

    const symptomText = Array.isArray(symptomIds) && symptomIds.length > 0
      ? symptomIds.join(', ')
      : 'none reported';

    const prompt = [
      'Summarize medication safety and adherence risks based on this profile.',
      `Name: ${profile?.full_name || 'Unknown'}`,
      `Age: ${profile?.age || 'Unknown'}`,
      `Gender: ${profile?.gender || 'Unknown'}`,
      `Medicines:\n${medList || 'none'}`,
      `Symptoms: ${symptomText}`,
      userQuestion ? `Specific question: ${userQuestion}` : 'Provide general insight.',
      'Output: 3-5 sentences, clear and cautious.',
      'Do not diagnose. End with a disclaimer.',
    ].join('\n');

    const insight = await ollamaChat({
      model: OLLAMA_CHAT_MODEL,
      system: 'You are a cautious medical safety assistant for medication adherence and interaction awareness.',
      userText: prompt,
    });

    return res.json({
      insight: insight || 'Unable to generate AI insight right now. Built-in safety logic is still active.',
      fallback: !insight,
    });
  } catch (err) {
    console.error('[AI insight]', err?.message || err);
    return res.json({
      insight: 'Unable to generate AI insight right now. Built-in safety logic is still active.',
      fallback: true,
    });
  }
});

app.post('/api/voice/input', async (req, res) => {
  const { audioBase64 = '', languageHint = 'en-IN' } = req.body || {};
  if (!String(audioBase64).trim()) return jsonError(res, 400, 'audioBase64 is required');
  try {
    if (VOICE_PROVIDER !== 'sarvam') return jsonError(res, 400, 'VOICE_PROVIDER must be sarvam for /voice/input');
    const parsed = await voiceService.voiceInput({ audioBase64, languageHint });
    return res.json({
      provider: 'sarvam',
      transcript: parsed.transcript,
      detectedLanguage: parsed.detectedLanguage,
    });
  } catch (err) {
    console.error('[Voice input]', err?.message || err);
    return res.status(500).json({
      source: 'voice_input_error',
      error: 'Could not transcribe speech.',
    });
  }
});

app.post('/api/voice/chat', async (req, res) => {
  const { transcript = '', languageHint = 'en-IN', medicines = [] } = req.body || {};
  if (!String(transcript).trim()) return jsonError(res, 400, 'transcript is required');
  try {
    if (VOICE_PROVIDER === 'sarvam') {
      const result = await voiceService.voiceChat({ transcript, languageHint, medicines });
      return res.json({
        provider: 'sarvam',
        detectedLanguage: result.detectedLanguage,
        originalTranscript: result.originalTranscript,
        englishUserText: result.englishUserText,
        aiEnglishResponse: result.aiEnglishResponse,
        translatedResponse: result.translatedResponse,
      });
    }

    const hintLang = normalizeLanguageCode(languageHint || guessLanguageFromText(transcript));
    const medContext = Array.isArray(medicines) && medicines.length > 0
      ? medicines.map((m) => `${m?.name || 'Unknown'} (${m?.dosage || '?'})`).join(', ')
      : 'No current medicines available.';
    const detected = await translateToEnglishWithOllama({ transcript, languageHint: hintLang });
    const aiEnglish = await getEnglishSafetyReply({ englishUserText: detected.englishUserText, medContext });
    const nativeText = await translateFromEnglishWithOllama({
      englishText: aiEnglish,
      targetLanguage: detected.detectedLanguage,
    });
    return res.json({
      provider: 'ollama',
      detectedLanguage: detected.detectedLanguage,
      originalTranscript: transcript,
      englishUserText: detected.englishUserText,
      aiEnglishResponse: aiEnglish,
      translatedResponse: nativeText,
    });
  } catch (err) {
    console.error('[Voice chat]', err?.message || err);
    return res.status(500).json({
      source: 'voice_chat_error',
      error: 'Could not process voice chat.',
    });
  }
});

app.post('/api/voice/speak', async (req, res) => {
  const { text = '', language = 'en-IN', sourceLanguage = 'en-IN', seniorMode = false } = req.body || {};
  if (!String(text).trim()) return jsonError(res, 400, 'text is required');
  try {
    if (VOICE_PROVIDER === 'sarvam') {
      const audio = await voiceService.speakTranslated({
        text,
        targetLanguage: language,
        sourceLanguage,
        seniorMode: !!seniorMode,
      });
      return res.json({
        provider: 'sarvam',
        language: voiceService.normalizeLanguageCode(language),
        translatedText: audio.translatedText || String(text),
        audioBase64: audio.audioBase64,
        mimeType: audio.mimeType,
      });
    }

    if (VOICE_PROVIDER === 'bhashini') {
      const lang = normalizeLanguageCode(language);
      const tts = await bhashiniTts({ text, language: lang, gender: 'female' });
      return res.json({ provider: 'bhashini', language: lang, ...tts });
    }

    return jsonError(res, 400, 'VOICE_PROVIDER does not support server-side speak');
  } catch (err) {
    console.error('[Voice speak]', err?.message || err);
    return res.status(500).json({
      source: 'voice_speak_error',
      error: 'Could not generate speech.',
    });
  }
});

app.post('/api/voice/reminder', async (req, res) => {
  const { medicationName = 'medicine', dosage = '', language = 'en-IN', text = '' } = req.body || {};
  try {
    if (VOICE_PROVIDER === 'sarvam') {
      const reminder = await voiceService.voiceReminder({
        medicationName,
        dosage,
        language,
        text,
        seniorMode: true,
      });
      return res.json({
        provider: 'sarvam',
        language: normalizeLanguageCode(language),
        reminderText: reminder.reminderText,
        audioBase64: reminder.audioBase64,
        mimeType: reminder.mimeType,
      });
    }
    const fallbackText = String(text || '').trim() || `Reminder: It is time to take your ${medicationName}${dosage ? ` ${dosage}` : ''}. Please follow your doctor's instructions.`;
    return res.json({
      provider: VOICE_PROVIDER,
      language: normalizeLanguageCode(language),
      reminderText: fallbackText,
    });
  } catch (err) {
    console.error('[Voice reminder]', err?.message || err);
    return res.status(500).json({
      source: 'voice_reminder_error',
      error: 'Could not generate reminder audio.',
    });
  }
});

const handleSpeak = async (req, res) => {
  const { text = '', language = 'en-IN', voice = '' } = req.body || {};
  const cleanText = String(text || '').trim();
  if (!cleanText) return jsonError(res, 400, 'text is required');

  if (VOICE_PROVIDER !== 'sarvam') {
    return jsonError(res, 400, 'VOICE_PROVIDER must be sarvam for /api/speak');
  }

  const requestedLang = normalizeTtsLanguageCode(language);
  const allowedVoices = new Set([
    'shubh', 'aditya', 'ritu', 'priya', 'rahul', 'pooja', 'kavya', 'ishita'
  ]);
  const requestedVoice = String(voice || '').trim().toLowerCase();
  const defaultVoice = String(SARVAM_DEFAULT_SPEAKER || 'shubh').trim().toLowerCase();
  const selectedVoice = allowedVoices.has(requestedVoice)
    ? requestedVoice
    : (allowedVoices.has(defaultVoice) ? defaultVoice : 'shubh');

  try {
    const spoken = await sarvamTts({
      text: cleanText,
      language: requestedLang,
      speaker: selectedVoice,
    });
    const audioBuffer = Buffer.from(String(spoken?.audioBase64 || ''), 'base64');
    if (!audioBuffer.length) throw new Error('No audio returned');
    res.setHeader('Content-Type', spoken.mimeType || 'audio/wav');
    return res.send(audioBuffer);
  } catch (err) {
    console.error('[API:speak]', err?.message || err);
    return res.status(500).json({
      source: 'speak_error',
      error: err?.message || 'Could not generate Sarvam speech.',
    });
  }
};

app.post('/api/speak', handleSpeak);
app.post('/speak', handleSpeak);

const handleSarvamSpeak = async (req, res) => {
  const { text = '', language = 'en-IN', sourceLanguage = 'en-IN', seniorMode = true } = req.body || {};
  if (!String(text).trim()) return jsonError(res, 400, 'text is required');
  if (VOICE_PROVIDER !== 'sarvam') return jsonError(res, 400, 'VOICE_PROVIDER must be sarvam');

  try {
    let spoken = null;
    try {
      spoken = await voiceService.speakTranslated({
        text: String(text),
        targetLanguage: String(language || 'en-IN'),
        sourceLanguage: String(sourceLanguage || 'en-IN'),
        seniorMode: !!seniorMode,
      });
    } catch (sarvamTranslateErr) {
      // Fallback: translate with Ollama, then synthesize with Sarvam.
      const targetLang = voiceService.normalizeLanguageCode(String(language || 'en-IN'));
      const sourceLang = voiceService.normalizeLanguageCode(String(sourceLanguage || 'en-IN'));
      let translatedText = String(text || '');
      try {
        if (targetLang !== sourceLang) {
          translatedText = await translateFromEnglishWithOllama({
            englishText: String(text || ''),
            targetLanguage: targetLang,
          });
        }
      } catch (ollamaTranslateErr) {
        translatedText = String(text || '');
      }
      const audio = await voiceService.voiceSpeak({
        text: translatedText,
        language: targetLang,
        seniorMode: !!seniorMode,
      });
      spoken = { translatedText, ...audio };
    }

    const audioBuffer = Buffer.from(String(spoken.audioBase64 || ''), 'base64');
    if (!audioBuffer?.length) throw new Error('No audio returned from Sarvam');

    res.setHeader('Content-Type', spoken.mimeType || 'audio/wav');
    res.setHeader('X-Translated-Text', encodeURIComponent(String(spoken.translatedText || '')));
    return res.send(audioBuffer);
  } catch (err) {
    console.error('[Sarvam speak]', err?.message || err);
    return res.status(500).json({
      source: 'sarvam_speak_error',
      error: err?.message || 'Could not synthesize Sarvam audio.',
    });
  }
};

app.post('/api/sarvam/speak', handleSarvamSpeak);
app.post('/sarvam/speak', handleSarvamSpeak);

app.post('/api/voice/converse', async (req, res) => {
  const { transcript = '', languageHint = '', medicines = [] } = req.body || {};
  if (!String(transcript).trim()) return jsonError(res, 400, 'transcript is required');
  try {
    const chat = await (async () => {
      if (VOICE_PROVIDER === 'sarvam') {
        const result = await voiceService.voiceChat({
          transcript: String(transcript),
          languageHint: languageHint || 'en-IN',
          medicines: Array.isArray(medicines) ? medicines : [],
        });
        return {
          provider: 'sarvam',
          detectedLanguage: result.detectedLanguage,
          englishUserText: result.englishUserText,
          aiEnglishResponse: result.aiEnglishResponse,
          nativeResponse: result.translatedResponse,
        };
      }

      const hintLang = normalizeLanguageCode(languageHint || guessLanguageFromText(transcript));
      const medContext = Array.isArray(medicines) && medicines.length > 0
        ? medicines.map((m) => `${m?.name || 'Unknown'} (${m?.dosage || '?'})`).join(', ')
        : 'No current medicines available.';
      const detected = await translateToEnglishWithOllama({ transcript, languageHint: hintLang });
      const aiEnglish = await getEnglishSafetyReply({ englishUserText: detected.englishUserText, medContext });
      const nativeText = await translateFromEnglishWithOllama({
        englishText: aiEnglish,
        targetLanguage: detected.detectedLanguage,
      });
      return {
        provider: 'ollama',
        detectedLanguage: detected.detectedLanguage,
        englishUserText: detected.englishUserText,
        aiEnglishResponse: aiEnglish,
        nativeResponse: nativeText,
      };
    })();

    if (VOICE_PROVIDER === 'sarvam') {
      try {
        const audio = await voiceService.voiceSpeak({
          text: chat.nativeResponse,
          language: chat.detectedLanguage,
          seniorMode: false,
        });
        return res.json({ ...chat, ...audio });
      } catch (err) {
        return res.json(chat);
      }
    }

    return res.json(chat);
  } catch (err) {
    console.error('[Voice converse]', err?.message || err);
    return res.status(500).json({
      source: 'voice_converse_error',
      error: 'Unable to process voice conversation right now.',
    });
  }
});

app.get('/api/voice/languages', (_req, res) => {
  return res.json({
    provider: VOICE_PROVIDER,
    languages: VOICE_SUPPORTED_LANGUAGES,
    appLanguageCodes: voiceService.supportedLanguages,
  });
});

app.post('/api/voice/stt', async (req, res) => {
  const { audioBase64 = '', languageHint = 'en-IN' } = req.body || {};
  if (!String(audioBase64).trim()) return jsonError(res, 400, 'audioBase64 is required');

  try {
    if (VOICE_PROVIDER !== 'bhashini') {
      return jsonError(res, 400, 'VOICE_PROVIDER is not set to bhashini');
    }
    const lang = normalizeLanguageCode(languageHint);
    const transcript = await bhashiniAsr({ audioBase64, languageHint: lang });
    return res.json({
      provider: 'bhashini',
      detectedLanguage: lang,
      transcript: String(transcript || ''),
    });
  } catch (err) {
    console.error('[Voice STT]', err?.message || err);
    return res.status(500).json({
      source: 'bhashini_stt_error',
      error: err?.message || 'Unable to transcribe audio right now.',
    });
  }
});

app.post('/api/voice/tts', async (req, res) => {
  const { text = '', language = 'en-IN', gender = 'female', speaker = '' } = req.body || {};
  if (!String(text).trim()) return jsonError(res, 400, 'text is required');

  try {
    if (VOICE_PROVIDER === 'bhashini') {
      const lang = normalizeLanguageCode(language);
      const tts = await bhashiniTts({ text, language: lang, gender });
      return res.json({
        provider: 'bhashini',
        language: lang,
        ...tts,
      });
    }
    if (VOICE_PROVIDER === 'sarvam') {
      const lang = normalizeLanguageCode(language);
      const tts = await sarvamTts({ text, language: lang, speaker });
      return res.json({
        provider: 'sarvam',
        language: lang,
        ...tts,
      });
    }
    return jsonError(res, 400, 'VOICE_PROVIDER does not support server-side tts');
  } catch (err) {
    console.error('[Voice TTS]', err?.message || err);
    return res.status(500).json({
      source: 'voice_tts_error',
      error: err?.message || 'Unable to generate voice right now.',
    });
  }
});

app.post('/api/ai/ocr', async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg' } = req.body || {};
  if (!imageBase64) return jsonError(res, 400, 'imageBase64 is required');
  console.log(`[OCR] request received. mime=${mimeType} size_mb=${(String(imageBase64).length / 1024 / 1024).toFixed(2)}`);

  try {
    // Fast path: OCR via tesseract first (no LLM dependency)
    const tesseractText = await ocrWithTesseract(imageBase64);
    if (tesseractText) {
      const parsedFromTesseract = parseMedicinesFromLines(tesseractText)
        .map(normalizeMedicine)
        .filter(Boolean)
        .filter(isValidExtractedMedicine);
      if (parsedFromTesseract.length > 0) {
        console.log(`[OCR] success count=${parsedFromTesseract.length} source=tesseract`);
        return res.json({ medicines: parsedFromTesseract, source: 'tesseract' });
      }

      // Fallback in tesseract-only mode: match known drug names from raw OCR text
      const fromTesseractKeywords = extractKnownDrugsFromText(tesseractText)
        .map(normalizeMedicine)
        .filter(Boolean)
        .filter(isValidExtractedMedicine);
      if (fromTesseractKeywords.length > 0) {
        console.log(`[OCR] success count=${fromTesseractKeywords.length} source=keyword_fallback`);
        return res.json({ medicines: fromTesseractKeywords, source: 'keyword_fallback' });
      }
    }

    if (OCR_STRATEGY === 'tesseract_only') {
      console.log('[OCR] tesseract_only mode parse_failed');
      return res.json({ medicines: [], source: 'parse_failed' });
    }

    if (AI_PROVIDER !== 'ollama') {
      console.log('[OCR] provider unavailable');
      return res.json({ medicines: [], source: 'provider_unavailable' });
    }

    // Stage 1: OCR-style plain text extraction from vision model
    const textPrompt = [
      'Read this prescription image and transcribe medicine lines.',
      'Return each medicine on a separate line.',
      'Include medicine name, dosage and schedule if visible.',
      'Do not add explanations.',
    ].join('\n');

    const extractedText = await ollamaChat({
      model: OLLAMA_VISION_MODEL,
      system: `Vision OCR for prescriptions. image mime type: ${mimeType}`,
      userText: textPrompt,
      images: [String(imageBase64)],
      timeoutMs: 180000,
    });

    // Stage 2: deterministic JSON formatting with chat model
    const jsonPrompt = [
      'Convert the following prescription medicine lines into strict JSON array only.',
      'No markdown, no extra text.',
      'Output schema:',
      '[{"name":"Medicine Name","dosage":"500mg","type":"antibiotic|heart|diabetes|pain|other","frequency":"Once Daily","times":["08:00"]}]',
      'Rules:',
      '- Infer type conservatively',
      '- Keep unknown dosage as "N/A"',
      '- Keep unknown times as ["08:00"]',
      '',
      'INPUT LINES:',
      extractedText || '',
    ].join('\n');

    const jsonText = await ollamaChat({
      model: OLLAMA_CHAT_MODEL,
      system: 'You convert OCR medicine lines into strict JSON.',
      userText: jsonPrompt,
      timeoutMs: 120000,
    });

    const parsed = parseJsonArrayFromText(jsonText) || [];
    let medicines = parsed.map(normalizeMedicine).filter(Boolean).filter(isValidExtractedMedicine);

    // Fallback: deterministic parser from extracted text lines
    if (medicines.length === 0 && extractedText) {
      medicines = parseMedicinesFromLines(extractedText).map(normalizeMedicine).filter(Boolean).filter(isValidExtractedMedicine);
    }

    // Final fallback: vision model directly to JSON
    if (medicines.length === 0) {
      const directJsonPrompt = [
        'Extract medicines from this prescription image.',
        'Return strict JSON array only (no markdown):',
        '[{"name":"Medicine Name","dosage":"500mg","type":"antibiotic|heart|diabetes|pain|other","frequency":"Once Daily","times":["08:00"]}]',
        'If uncertain, still include best-effort medicine lines with dosage.',
      ].join('\n');

      const directJsonText = await ollamaChat({
        model: OLLAMA_VISION_MODEL,
        system: `Prescription extraction. image mime type: ${mimeType}`,
        userText: directJsonPrompt,
        images: [String(imageBase64)],
        timeoutMs: 180000,
      });

      const directParsed = parseJsonArrayFromText(directJsonText) || [];
      medicines = directParsed.map(normalizeMedicine).filter(Boolean).filter(isValidExtractedMedicine);
    }

    if (medicines.length === 0) {
      // Last-resort fallback: keyword match from OCR text
      const fromKeywords = extractKnownDrugsFromText(
        [extractedText, tesseractText].filter(Boolean).join('\n')
      )
        .map(normalizeMedicine)
        .filter(Boolean)
        .filter(isValidExtractedMedicine);
      if (fromKeywords.length > 0) {
        console.log(`[OCR] success count=${fromKeywords.length} source=keyword_fallback`);
        return res.json({ medicines: fromKeywords, source: 'keyword_fallback' });
      }

      console.log('[OCR] parse_failed');
      return res.json({ medicines: [], source: 'parse_failed' });
    }

    console.log(`[OCR] success count=${medicines.length}`);
    return res.json({ medicines, source: 'ai' });
  } catch (err) {
    console.error('[AI ocr]', err?.message || err);
    return res.json({ medicines: [], source: 'error' });
  }
});

app.post('/api/meds/normalize', (req, res) => {
  const { medicines = [] } = req.body || {};
  if (!Array.isArray(medicines)) return jsonError(res, 400, 'medicines must be an array');

  const normalized = normalizeMedicines(medicines);
  return res.json({ normalized, total: normalized.length });
});

app.post('/api/risk/check', (req, res) => {
  const {
    existingMedicines = [],
    newMedicines = [],
    symptomIds = [],
  } = req.body || {};

  if (!Array.isArray(existingMedicines) || !Array.isArray(newMedicines)) {
    return jsonError(res, 400, 'existingMedicines and newMedicines must be arrays');
  }

  const risk = assessMedicationRisk({
    existingMedicines,
    newMedicines,
    symptomIds: Array.isArray(symptomIds) ? symptomIds : [],
  });

  return res.json(risk);
});

// Always return JSON for backend failures (avoids HTML 500 responses in frontend)
app.use((err, _req, res, _next) => {
  console.error('[ServerError]', err?.stack || err?.message || err);
  if (res.headersSent) return;
  res.status(500).json({
    error: 'server_error',
    source: 'server_error',
    message: err?.message || 'Unexpected server error',
  });
});

app.listen(PORT, () => {
  console.log(`MedGuard AI backend running on http://localhost:${PORT}`);
});

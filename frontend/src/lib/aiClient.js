import { safeFetch } from './safeAsync';

function getApiBase() {
  const raw = import.meta.env.VITE_AI_BASE_URL || '';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function aiRoute(path) {
  const base = getApiBase();
  return `${base}/api/ai/${path}`;
}

function apiRoute(path) {
  const base = getApiBase();
  return `${base}/api/${path}`;
}

export async function chatWithAI({ message = '', uploadedFile = null, medicines = [] }) {
  const { data, error } = await safeFetch(aiRoute('chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, uploadedFile, medicines }),
    timeout: 45000,
    retries: 0,
    label: 'backend-ai-chat',
  });

  if (error || !data) return null;
  return data.reply || null;
}

export async function getAIInsight({ medicines = [], profile = {}, symptomIds = [], userQuestion = '' }) {
  const { data, error } = await safeFetch(aiRoute('insight'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medicines, profile, symptomIds, userQuestion }),
    timeout: 45000,
    retries: 0,
    label: 'backend-ai-insight',
  });

  if (error || !data) return null;
  return data.insight || null;
}

export async function extractPrescriptionWithAI(base64Image) {
  if (!base64Image || !base64Image.includes(',')) {
    return { medicines: [], source: 'invalid_image' };
  }

  const imageBase64 = base64Image.split(',')[1];
  const mimeType = base64Image.split(';')[0].split(':')[1] || 'image/jpeg';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 150000);
  try {
    const response = await fetch(aiRoute('ocr'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType }),
      signal: controller.signal,
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      return { medicines: [], source: `invalid_json_http_${response.status}` };
    }

    if (!response.ok) {
      return { medicines: [], source: `http_${response.status}` };
    }

    if (!data?.medicines || !Array.isArray(data.medicines)) {
      return { medicines: [], source: 'bad_payload' };
    }

    return {
      medicines: data.medicines,
      source: data.source || 'unknown',
    };
  } catch (err) {
    if (err?.name === 'AbortError') return { medicines: [], source: 'timeout' };
    return { medicines: [], source: 'network_error' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkMedicationRisk({ existingMedicines = [], newMedicines = [], symptomIds = [] }) {
  const { data, error } = await safeFetch(apiRoute('risk/check'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ existingMedicines, newMedicines, symptomIds }),
    timeout: 20000,
    retries: 0,
    label: 'backend-risk-check',
  });

  if (error || !data) return null;
  return data;
}

export async function voiceConverse({
  transcript = '',
  languageHint = '',
  medicines = [],
} = {}) {
  const { data, error } = await safeFetch(apiRoute('voice/converse'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, languageHint, medicines }),
    timeout: 60000,
    retries: 0,
    label: 'backend-voice-converse',
  });

  if (error || !data) return null;
  return data;
}

export async function voiceInput({
  audioBase64 = '',
  languageHint = '',
} = {}) {
  const { data, error } = await safeFetch(apiRoute('voice/input'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, languageHint }),
    timeout: 60000,
    retries: 0,
    label: 'backend-voice-input',
  });
  if (error || !data) return null;
  return data;
}

export async function voiceChat({
  transcript = '',
  languageHint = '',
  medicines = [],
} = {}) {
  const { data, error } = await safeFetch(apiRoute('voice/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, languageHint, medicines }),
    timeout: 60000,
    retries: 0,
    label: 'backend-voice-chat',
  });
  if (error || !data) return null;
  return data;
}

export async function voiceSpeak({
  text = '',
  language = 'en-IN',
  sourceLanguage = 'en-IN',
  seniorMode = false,
} = {}) {
  const { data, error } = await safeFetch(apiRoute('voice/speak'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, sourceLanguage, seniorMode }),
    timeout: 60000,
    retries: 0,
    label: 'backend-voice-speak',
  });
  if (error || !data) return null;
  return data;
}

export async function voiceReminder({
  medicationName = '',
  dosage = '',
  language = 'en-IN',
  text = '',
} = {}) {
  const { data, error } = await safeFetch(apiRoute('voice/reminder'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medicationName, dosage, language, text }),
    timeout: 60000,
    retries: 0,
    label: 'backend-voice-reminder',
  });
  if (error || !data) return null;
  return data;
}

export async function sarvamSpeak({
  text = '',
  language = 'en-IN',
  sourceLanguage = 'en-IN',
  seniorMode = true,
} = {}) {
  try {
    const base = getApiBase();
    const response = await fetch(`${base}/api/sarvam/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language, sourceLanguage, seniorMode }),
    });

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const translatedEncoded = response.headers.get('X-Translated-Text') || '';
    let translatedText = '';
    try {
      translatedText = translatedEncoded ? decodeURIComponent(translatedEncoded) : '';
    } catch {
      translatedText = '';
    }
    return { blob, translatedText };
  } catch {
    return null;
  }
}

export async function speakApi({
  text = '',
  language = 'en-IN',
  voice = 'Shubh',
  sourceLanguage = 'en-IN',
} = {}) {
  try {
    const base = getApiBase();
    const response = await fetch(`${base}/api/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language, voice, sourceLanguage }),
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    const translatedEncoded = response.headers.get('X-Translated-Text') || '';
    let translatedText = '';
    try {
      translatedText = translatedEncoded ? decodeURIComponent(translatedEncoded) : '';
    } catch {
      translatedText = '';
    }
    return { blob, translatedText };
  } catch {
    return null;
  }
}

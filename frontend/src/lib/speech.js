import { speakApi } from './aiClient';

const LANGUAGE_MAP = {
  en: 'en-IN',
  'en-in': 'en-IN',
  hi: 'hi-IN',
  'hi-in': 'hi-IN',
  ta: 'ta-IN',
  'ta-in': 'ta-IN',
  te: 'te-IN',
  'te-in': 'te-IN',
  kn: 'kn-IN',
  'kn-in': 'kn-IN',
  bn: 'bn-IN',
  'bn-in': 'bn-IN',
  mr: 'mr-IN',
  'mr-in': 'mr-IN',
  pa: 'pa-IN',
  'pa-in': 'pa-IN',
  gu: 'gu-IN',
  'gu-in': 'gu-IN',
};

export function normalizeLanguageCode(input = 'en-IN') {
  const raw = String(input || '').trim().toLowerCase();
  return LANGUAGE_MAP[raw] || 'en-IN';
}

function browserFallbackSpeak(text, languageCode) {
  if (!('speechSynthesis' in window)) return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = normalizeLanguageCode(languageCode);
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export async function speakText(text, languageCode = 'en-IN', voice = 'shubh') {
  const content = String(text || '').trim();
  if (!content) return { ok: false, source: 'empty_text' };

  const normalizedLanguage = normalizeLanguageCode(languageCode);
  try {
    const response = await speakApi({
      text: content,
      language: normalizedLanguage,
      voice,
      sourceLanguage: normalizedLanguage,
    });

    if (!response?.blob) {
      const fallbackOk = browserFallbackSpeak(content, normalizedLanguage);
      return { ok: fallbackOk, source: fallbackOk ? 'browser_fallback' : 'no_audio' };
    }

    const url = URL.createObjectURL(response.blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.onerror = () => URL.revokeObjectURL(url);
    await audio.play();
    return { ok: true, source: 'sarvam' };
  } catch {
    const fallbackOk = browserFallbackSpeak(content, normalizedLanguage);
    return { ok: fallbackOk, source: fallbackOk ? 'browser_fallback' : 'error' };
  }
}


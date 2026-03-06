export function createVoiceService() {
  const notReady = () => {
    const err = new Error('Voice service not configured yet. Rebuild in progress.');
    err.code = 'voice_service_reset';
    throw err;
  };

  return {
    voiceInput: notReady,
    voiceChat: notReady,
    voiceSpeak: notReady,
    speakTranslated: notReady,
    voiceReminder: notReady,
    supportedLanguages: [],
    normalizeLanguageCode: (lang = 'en-IN') => String(lang || 'en-IN'),
  };
}

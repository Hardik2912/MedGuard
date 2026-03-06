import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, LogOut, Mic, Play, RefreshCw, Upload, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { safeQuery } from '../lib/safeAsync';
import { speakText, normalizeLanguageCode } from '../lib/speech';

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'kn', label: 'Kannada' },
  { code: 'bn', label: 'Bengali' },
  { code: 'mr', label: 'Marathi' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'bho', label: 'Bhojpuri' },
];

export default function SeniorMode() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [medicines, setMedicines] = useState([]);
  const [loadingMeds, setLoadingMeds] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [caregiverAudio, setCaregiverAudio] = useState(localStorage.getItem('medguard_caregiver_voice') || '');
  const [caregiverVoiceUsedOnce, setCaregiverVoiceUsedOnce] = useState(false);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);

  const appLanguageCode = useMemo(() => normalizeLanguageCode(language), [language]);

  useEffect(() => {
    const timerId = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const loadMedicines = useCallback(async () => {
    if (!user?.id) {
      setMedicines([]);
      return;
    }
    setLoadingMeds(true);
    try {
      const rows = await safeQuery(
        'medicines',
        (sb) =>
          sb
            .from('medicines')
            .select('id, name, dosage, frequency, status, times')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
        []
      );
      setMedicines(Array.isArray(rows) ? rows : []);
    } finally {
      setLoadingMeds(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  const doseQueue = useMemo(() => {
    const now = new Date(nowMs);
    const queue = [];
    medicines.forEach((med) => {
      const rawTimes = Array.isArray(med?.times) && med.times.length > 0 ? med.times : ['08:00'];
      rawTimes.forEach((tm) => {
        const [hh, mm] = String(tm || '').split(':').map((v) => Number(v));
        if (Number.isNaN(hh) || Number.isNaN(mm)) return;
        const doseDate = new Date(now);
        doseDate.setHours(hh, mm, 0, 0);
        if (doseDate.getTime() < now.getTime() - 30 * 1000) {
          doseDate.setDate(doseDate.getDate() + 1);
        }
        queue.push({ med, time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, whenMs: doseDate.getTime() });
      });
    });
    queue.sort((a, b) => a.whenMs - b.whenMs);
    return queue;
  }, [medicines, nowMs]);

  const nextDose = doseQueue[0] || null;

  const handleSpeak = async (text, voice = 'ritu') => {
    await speakText(text, appLanguageCode, voice);
  };

  const playCaregiverVoice = () => {
    if (!caregiverAudio || caregiverVoiceUsedOnce) return false;
    try {
      const audio = new Audio(caregiverAudio);
      audio.onended = () => setCaregiverVoiceUsedOnce(true);
      audio.play();
      return true;
    } catch {
      return false;
    }
  };

  const formatCountdown = (targetMs) => {
    const diff = Math.max(0, targetMs - nowMs);
    const totalSec = Math.floor(diff / 1000);
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  const defaultReminderLine = t('medicineTime');

  const reminderLine = nextDose
    ? `${nextDose.med?.name || 'Medicine'} - ${nextDose.med?.dosage || ''} ${t('takeAfterFood')}`.trim()
    : t('medicineTime');

  const nextDoseLabel = nextDose
    ? `${nextDose.med?.name || 'Medicine'} (${nextDose.time})`
    : defaultReminderLine;

  const handleTalkToAi = () => {
    localStorage.setItem('medguard_auto_talk_now', '1');
    navigate('/ai-assistant');
  };

  const startVoiceRecording = async () => {
    if (isRecordingVoice) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = String(reader.result || '');
          setCaregiverAudio(dataUrl);
          localStorage.setItem('medguard_caregiver_voice', dataUrl);
          setCaregiverVoiceUsedOnce(false);
        };
        reader.readAsDataURL(blob);
        try { mediaStreamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch { }
      };

      recorder.start();
      setIsRecordingVoice(true);
    } catch {
      setIsRecordingVoice(false);
    }
  };

  const stopVoiceRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
    mediaRecorderRef.current.stop();
    setIsRecordingVoice(false);
  };

  useEffect(() => {
    return () => {
      try { mediaRecorderRef.current?.stop(); } catch { }
      try { mediaStreamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch { }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl rounded-3xl border-2 border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-5xl font-black text-slate-900">{t('title')}</h1>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate('/scan-prescription')}
            className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-4 text-2xl font-black text-white"
          >
            <Upload className="h-6 w-6" />
            {t('uploadPrescription')}
          </button>
          <button
            type="button"
            onClick={loadMedicines}
            className="flex items-center justify-center gap-2 rounded-2xl bg-slate-700 px-5 py-4 text-2xl font-black text-white"
          >
            <RefreshCw className="h-6 w-6" />
            {t('refresh')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/senior-symptoms')}
            className="flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-4 text-2xl font-black text-white"
          >
            <Activity className="h-6 w-6" />
            {t('recordSymptom')}
          </button>
          <button
            type="button"
            onClick={handleTalkToAi}
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-2xl font-black text-white"
          >
            <Mic className="h-6 w-6" />
            {t('talkToAi')}
          </button>
        </div>

        <div className="mt-8 rounded-3xl border-2 border-blue-100 bg-blue-50 p-6">
          <p className="text-3xl font-bold text-blue-900">{t('reminder')}</p>
          <p className="mt-2 text-xl font-bold text-blue-700">
            {t('nextMedicine')}: {nextDoseLabel}
          </p>
          <p className="mt-1 text-xl font-bold text-blue-700">
            {t('dueIn')}: {nextDose ? formatCountdown(nextDose.whenMs) : '--:--:--'}
          </p>
          <p className="mt-4 text-2xl font-semibold leading-relaxed text-blue-800">
            {reminderLine}
          </p>
          <button
            type="button"
            onClick={async () => {
              const played = playCaregiverVoice();
              if (!played) {
                await handleSpeak(reminderLine, 'ritu');
              }
            }}
            className="mt-6 w-full rounded-2xl bg-blue-600 px-6 py-5 text-3xl font-black text-white"
          >
            {t('hearReminder')}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {!isRecordingVoice ? (
            <button
              type="button"
              onClick={startVoiceRecording}
              className="flex items-center justify-center gap-2 rounded-2xl bg-fuchsia-600 px-5 py-4 text-2xl font-black text-white"
            >
              <Mic className="h-6 w-6" />
              {t('recordVoice')}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopVoiceRecording}
              className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-4 text-2xl font-black text-white"
            >
              <Mic className="h-6 w-6" />
              {t('stopRecording')}
            </button>
          )}
          <button
            type="button"
            onClick={playCaregiverVoice}
            disabled={!caregiverAudio || caregiverVoiceUsedOnce}
            className="flex items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 py-4 text-2xl font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="h-6 w-6" />
            {t('playSavedVoice')}
          </button>
        </div>

        <div className="mt-8 rounded-3xl border-2 border-emerald-100 bg-emerald-50 p-6">
          <p className="text-3xl font-bold text-emerald-900">{t('medicineList')}</p>
          <div className="mt-4 space-y-3">
            {loadingMeds && (
              <p className="text-xl font-semibold text-emerald-800">Loading medicines...</p>
            )}

            {!loadingMeds && medicines.length === 0 && (
              <p className="text-xl font-semibold text-emerald-800">{t('medicineTime')}</p>
            )}

            {!loadingMeds &&
              medicines.map((med) => {
                const line = `${med?.name || 'Medicine'} - ${med?.dosage || ''} ${t('takeAfterFood')}`.trim();
                return (
                  <div
                    key={med.id}
                    className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-white p-4"
                  >
                    <div>
                      <p className="text-2xl font-black text-slate-900">{med?.name || 'Medicine'}</p>
                      <p className="text-lg font-semibold text-slate-600">
                        {(med?.dosage || 'N/A')} - {med?.frequency || t('takeAfterFood')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSpeak(line, 'ritu')}
                      className="rounded-xl bg-emerald-600 p-3 text-white"
                      aria-label={t('speak')}
                      title={t('speak')}
                    >
                      <Volume2 className="h-7 w-7" />
                    </button>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="mt-8">
          <label htmlFor="senior-language" className="block text-2xl font-bold text-slate-800">
            {t('selectLanguage')}
          </label>
          <select
            id="senior-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-3 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-4 text-2xl font-semibold text-slate-900"
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => navigate('/profile?focus=age')}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-6 py-5 text-3xl font-black text-white"
        >
          <LogOut className="h-7 w-7" />
          {t('exitSeniorMode')}
        </button>
      </div>
    </div>
  );
}

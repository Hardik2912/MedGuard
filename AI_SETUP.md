# MedGuard AI Setup (Open-Source, Local)

This setup keeps your app stable by routing all AI calls through a backend service.

## 1) Start Ollama

Install and run Ollama, then pull models:

```bash
ollama pull llama3.1:8b-instruct-q4_K_M
ollama pull llava:7b
```

Keep Ollama running on `http://127.0.0.1:11434`.

## 1.1) Optional: Bhashini multilingual voice

If you want Indian-language voice pipeline in backend:

```bash
cd backend
cp .env.example .env
```

Set these in `backend/.env`:

```bash
VOICE_PROVIDER=bhashini
BHASHINI_API_KEY=your_key
BHASHINI_API_KEY_HEADER=x-api-key
```

Voice endpoints:
- `POST /api/voice/converse` (translation + AI response)
- `POST /api/voice/stt` (audio to text)
- `POST /api/voice/tts` (text to audio)
- `GET /api/voice/languages` (supported app languages)

## 1.2) Optional: Sarvam multilingual voice

Set in `backend/.env`:

```bash
VOICE_PROVIDER=sarvam
SARVAM_API_KEY=your_key
SARVAM_TTS_MODEL=bulbul:v3
SARVAM_TTS_SPEAKER=
SARVAM_STT_URL=
```

Notes:
- `SARVAM_TTS_SPEAKER` is optional.
- Senior Mode and AI Assistant voice chat use `/api/voice/converse` and will play returned audio when available.
- New pipeline endpoints:
  - `POST /api/voice/input`
  - `POST /api/voice/chat`
  - `POST /api/voice/speak`
  - `POST /api/voice/reminder`

## 2) Start AI backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:8787`.

Health check:

```bash
curl http://localhost:8787/api/health
```

## 3) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and proxies `/api/*` to backend.

## 4) Enable risk database schema (Supabase)

Run this SQL in Supabase SQL editor:

`/Users/hardikverma/Documents/New project/backend/sql/001_risk_engine_schema.sql`

This adds:
- `drug_catalog`
- `drug_interactions_kb`
- `adverse_reactions_kb`
- `risk_assessments`
- `risk_flags`
- `medication_normalizations`
- `patient_symptoms` (run `/Users/hardikverma/Documents/New project/backend/sql/002_patient_symptoms.sql`)

## Optional: separate backend URL

If your backend is not local, set:

```bash
VITE_AI_BASE_URL=https://your-backend-domain.com
```

The app has fallback responses so chat/OCR/insight failures do not crash UI.
Prescription safety checks now prefer backend deterministic risk engine (`/api/risk/check`).

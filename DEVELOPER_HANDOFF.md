# MedGuard Developer Handoff Guide 👨‍💻👩‍💻

**To the Developer:**
Welcome to **MedGuard**! This is a high-fidelity prototype built with **React + Vite + TailwindCSS**.
Currently, the app focuses on the **Frontend Experience (UI/UX)** with simulated logic for demonstrations.

Your mission is to connect the "Brain" (Real Backend & Medical Database) to this "Body".

## 1. Project Structure 📂
- **`/frontend`**: The main React application.
  - `src/pages`: All potential screens (Dashboard, Scan, Profile, etc.).
  - `src/components`: Reusable UI (Error Boundary, Private Route).
  - `src/context`: Authentication State (currently mocked/ready for Supabase).
- **`/backend`**: (Optional) Python scripts if you plan to use Flask/Python for OCR.

## 2. Current Status (What Works) ✅
- **Auth**: Mocked (works without backend for demo).
- **Dashboard**: Fully interactive.
- **Medicine Tracking**: Uses `localStorage` to persist data between reloads.
- **AI Scanning**: Simulates an API call (timeout + mock data). **You need to connect real OCR.**
- **Smart Watch**: Simulates Bluetooth scanning. **You need to add real WebBluetooth API.**

## 3. The Core Mission: ADR & AMR Detection 💊
The user wants this to be the core value proposition.

### Current Implementation
- **Mocked logic**: We currently don't check real interactions.

### Required Implementation (Your Task)
You need to integrate a drug interaction API.
**Recommended APIs:**
1.  **OpenFDA (Free)**: [open.fda.gov](https://open.fda.gov/) (Good for ADRs).
2.  **DrugBank (Paid/Freemium)**: Excellent interaction data.
3.  **RxNorm (NIH)**: Standard for normalizing drug names.

**Logic Flow:**
1.  User scans prescription -> Extract Text (OCR).
2.  Normalize text to RxNorm CUI (e.g., "Tylenol" -> "Acetaminophen").
3.  Send list of CUIs to Interaction API.
4.  Return alerts (Red/Yellow flags) to the frontend.

## 4. How to Run Locally 🚀
```bash
# 1. Go to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Good luck! This is a solid foundation to build a life-saving app. 🏥

# Spending Insights Dashboard

Spending Insights Dashboard is a portfolio-ready full-stack project that turns raw bank transaction CSVs into a polished analytics experience. Users can upload their spending history and instantly explore category breakdowns, monthly trends, anomaly detection, forecasting, and AI-style habit coaching.

## Highlights
- CSV ingestion and cleanup for real transaction exports
- Category analysis, monthly trends, and anomaly detection
- Next-month spend forecasting with statistical and ML-backed paths
- AI-style summary and habit recommendations from computed insights
- Interactive UI with demo-data loading, presentation theme toggle, and printable PDF report flow

## Stack
- Frontend: React, Vite, Recharts
- Backend: FastAPI, Pandas, NumPy, scikit-learn

## Run locally

### 1. Start the backend
```bash
cd "/Users/pratham/Documents/New project"
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
```

### 2. Start the frontend
```bash
cd "/Users/pratham/Documents/New project/frontend"
npm install
npm run dev
```

Open `http://localhost:5173`.

## Demo features
- `Load demo data` runs the bundled sample CSV without needing a manual upload
- `Dark presentation` switches the dashboard into a more dramatic showcase mode
- `Export PDF report` opens the browser print layout so the dashboard can be saved as a PDF

## CSV format
Required columns, with aliases supported:
- `date` or `transaction_date`, `posted_date`, `posting_date`, `timestamp`
- `amount` or `transaction_amount`, `amt`, `value`

Optional columns:
- `category` or `category_name`, `merchant_category`
- `description` or `merchant`, `payee`, `memo`

If a file contains both positive and negative values, negative amounts are treated as outgoing spend.

## Notes
- If `scikit-learn` is unavailable, the backend falls back to statistical anomaly detection and a linear trend forecast
- To change backend CORS behavior, set `CORS_ORIGINS` as a comma-separated environment variable

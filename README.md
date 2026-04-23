# Spending Insights Dashboard

Spending Insights Dashboard is a ready full-stack project that turns raw bank transaction CSVs into a polished analytics experience. Users can upload their spending history and instantly explore category breakdowns, monthly trends, anomaly detection, forecasting, and AI-style habit coaching.

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

### 1. Clone the repository
```bash
git clone https://github.com/pratham013/spending-insights-dashboard.git
cd spending-insights-dashboard
```

### 2. Start the backend
```bash
conda deactivate 2>/dev/null || true
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
```

If `python3.12` is not installed, use `python3` instead, but Python 3.12 is the recommended version for the smoothest setup.

### 3. Start the frontend
```bash
cd frontend
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
- The project virtual environment is created at the repository root as `.venv`, not inside `backend/`

## Troubleshooting

### `ImportError: cannot import name 'PickleBuffer' from 'pickle'`
This usually means the active shell is mixing a Conda Python runtime with the virtual environment interpreter.

Use this fix:
```bash
conda deactivate
rm -rf .venv
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
```

If you do not have Python 3.12 installed, install it first or use a clean non-Conda Python interpreter.

from __future__ import annotations

from typing import Any

import io
import os
from datetime import datetime

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.linear_model import LinearRegression

    SKLEARN_AVAILABLE = True
except Exception:
    SKLEARN_AVAILABLE = False

app = FastAPI(title="Spending Insights API")

allowed_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATE_ALIASES = [
    "date",
    "transaction_date",
    "posted_date",
    "posting_date",
    "timestamp",
]
AMOUNT_ALIASES = [
    "amount",
    "transaction_amount",
    "amt",
    "value",
]
CATEGORY_ALIASES = [
    "category",
    "category_name",
    "merchant_category",
]
DESCRIPTION_ALIASES = [
    "description",
    "merchant",
    "payee",
    "memo",
]


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    lowered = {col: col.strip().lower() for col in df.columns}
    df = df.rename(columns=lowered)

    def pick(aliases: list[str]) -> str | None:
        for name in aliases:
            if name in df.columns:
                return name
        return None

    date_col = pick(DATE_ALIASES)
    amount_col = pick(AMOUNT_ALIASES)
    category_col = pick(CATEGORY_ALIASES)
    description_col = pick(DESCRIPTION_ALIASES)

    if not date_col or not amount_col:
        raise ValueError("CSV must include a date column and an amount column.")

    df = df.rename(
        columns={
            date_col: "date",
            amount_col: "amount",
            category_col or "": "category" if category_col else "category",
            description_col or "": "description" if description_col else "description",
        }
    )

    if "category" not in df.columns:
        df["category"] = "Uncategorized"
    if "description" not in df.columns:
        df["description"] = ""

    return df


def coerce_amounts(df: pd.DataFrame) -> pd.DataFrame:
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    df = df.dropna(subset=["amount", "date"])

    if df["amount"].min() < 0 and df["amount"].max() > 0:
        spending = df[df["amount"] < 0].copy()
        spending["amount"] = spending["amount"].abs()
        return spending

    df["amount"] = df["amount"].abs()
    return df


def add_categories(df: pd.DataFrame) -> pd.DataFrame:
    df["category"] = df["category"].fillna("Uncategorized")

    if df["category"].eq("Uncategorized").mean() < 0.7:
        return df

    keywords = {
        "Groceries": ["whole foods", "trader joe", "kroger", "aldi", "walmart", "market"],
        "Dining": ["restaurant", "cafe", "starbucks", "coffee", "chipotle", "mcdonald"],
        "Transport": ["uber", "lyft", "shell", "exxon", "gas"],
        "Entertainment": ["netflix", "spotify", "cinema", "hulu"],
        "Shopping": ["amazon", "target", "costco", "best buy"],
        "Bills": ["electric", "water", "rent", "mortgage", "insurance"],
    }

    def classify(desc: str) -> str:
        desc_lower = (desc or "").lower()
        for cat, words in keywords.items():
            if any(word in desc_lower for word in words):
                return cat
        return "Uncategorized"

    df["category"] = df["description"].map(classify)
    return df


def monthly_trends(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])
    df = df.set_index("date")
    monthly = df.resample("ME").sum(numeric_only=True)
    monthly.index = monthly.index.to_period("M").astype(str)
    return monthly.reset_index().rename(columns={"date": "month"})


def detect_anomalies(df: pd.DataFrame) -> pd.DataFrame:
    if len(df) < 12:
        return df.iloc[0:0]

    values = df[["amount"]].values

    if SKLEARN_AVAILABLE:
        model = IsolationForest(n_estimators=200, contamination=0.08, random_state=42)
        flags = model.fit_predict(values)
        return df[flags == -1]

    z = (df["amount"] - df["amount"].mean()) / (df["amount"].std(ddof=0) + 1e-9)
    return df[z.abs() > 2.5]


def predict_next_month(monthly: pd.DataFrame) -> float | None:
    if len(monthly) < 3:
        return None

    y = monthly["amount"].values.reshape(-1, 1)
    x = np.arange(len(y)).reshape(-1, 1)

    if SKLEARN_AVAILABLE:
        model = LinearRegression().fit(x, y)
        next_x = np.array([[len(y)]])
        return float(model.predict(next_x)[0][0])

    coef = np.polyfit(x.flatten(), y.flatten(), 1)
    return float(coef[0] * len(y) + coef[1])


def build_insights(
    df: pd.DataFrame, monthly: pd.DataFrame, totals: pd.DataFrame, anomalies: pd.DataFrame
) -> dict[str, Any]:
    total_spend = float(df["amount"].sum())
    top_category = None
    top_category_share = None
    if not totals.empty:
        top_category = totals.iloc[0]["category"]
        top_category_share = float(totals.iloc[0]["amount"] / total_spend)

    month_change = None
    if len(monthly) >= 2:
        last = float(monthly.iloc[-1]["amount"])
        prev = float(monthly.iloc[-2]["amount"])
        if prev > 0:
            month_change = (last - prev) / prev

    top_merchants = (
        df.groupby("description")["amount"]
        .sum()
        .sort_values(ascending=False)
        .head(3)
        .reset_index()
        .rename(columns={"description": "merchant", "amount": "total"})
        .to_dict(orient="records")
    )

    summary_parts = []
    if top_category and top_category_share is not None:
        summary_parts.append(
            f"Your largest category is {top_category} at {top_category_share:.0%} of total spend."
        )
    if month_change is not None:
        direction = "up" if month_change > 0 else "down"
        summary_parts.append(
            f"Spending is {abs(month_change):.0%} {direction} vs last month."
        )
    if anomalies is not None and not anomalies.empty:
        summary_parts.append(
            f"{min(len(anomalies), 10)} transactions look unusual compared to your norm."
        )

    habit_tips = []
    if top_category_share is not None and top_category_share > 0.35:
        habit_tips.append(
            f"{top_category} is driving most of the spend. Consider setting a monthly cap."
        )
    if month_change is not None and month_change > 0.2:
        habit_tips.append("Spending jumped this month. Review subscriptions and discretionary items.")
    if df["amount"].mean() > 200:
        habit_tips.append("Average transaction size is high. Try batching smaller purchases.")
    if not habit_tips:
        habit_tips.append("Your spending looks balanced. Keep monitoring for trends.")

    return {
        "summary_text": " ".join(summary_parts) if summary_parts else "Upload more data for richer insights.",
        "top_merchants": top_merchants,
        "habit_tips": habit_tips,
    }


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to read CSV: {exc}")

    try:
        df = normalize_columns(df)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])
    df = coerce_amounts(df)
    df = add_categories(df)

    if df.empty:
        raise HTTPException(status_code=400, detail="No valid transactions found.")

    totals = (
        df.groupby("category")["amount"].sum().sort_values(ascending=False).reset_index()
    )

    monthly = monthly_trends(df)
    anomalies = detect_anomalies(df)
    prediction = predict_next_month(monthly)
    insights = build_insights(df, monthly, totals, anomalies)

    response = {
        "summary": {
            "total_spend": float(df["amount"].sum()),
            "avg_transaction": float(df["amount"].mean()),
            "avg_monthly": float(monthly["amount"].mean()) if not monthly.empty else 0.0,
            "transaction_count": int(len(df)),
        },
        "totals_by_category": totals.to_dict(orient="records"),
        "monthly_trends": monthly.to_dict(orient="records"),
        "anomalies": anomalies.sort_values("amount", ascending=False)
        .head(10)
        .to_dict(orient="records"),
        "prediction_next_month": prediction,
        "insights": insights,
        "columns_detected": list(df.columns),
        "notes": {
            "ml_enabled": SKLEARN_AVAILABLE,
        },
    }

    return response

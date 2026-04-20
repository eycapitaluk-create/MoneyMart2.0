#!/usr/bin/env python3
"""
Japanese Stock Data Fetcher (일본 주식 데이터 수집)
Fetches closing prices from Yahoo Finance and saves to JSON
Run daily at 3:40 PM via scheduler
"""

import subprocess
import sys

# Install dependencies
subprocess.run([sys.executable, "-m", "pip", "install", "yfinance", "pandas", "-q"])

import yfinance as yf
import pandas as pd
import json
import time
from datetime import datetime, timedelta
from pathlib import Path

# ========================
# Configuration
# ========================
TARGET_DATE = datetime.now().strftime("%Y-%m-%d")  # Today's date
OUTPUT_DIR = Path(__file__).parent / "data"
OUTPUT_DIR.mkdir(exist_ok=True)

TICKERS = [
    "7203.T","8306.T","6758.T","9984.T","7974.T","6861.T","8316.T","7267.T","9432.T","6098.T",
    "8035.T","4063.T","6501.T","9433.T","7751.T","8766.T","4502.T","6902.T","2914.T","9434.T",
    "7741.T","6367.T","8058.T","6594.T","7733.T","4661.T","9022.T","8031.T","8411.T","6645.T",
    "4519.T","6857.T","7832.T","3382.T","4568.T","9020.T","8001.T","6762.T","5108.T","8053.T",
]

# ========================
# Fetch Data
# ========================
target_dt = datetime.strptime(TARGET_DATE, "%Y-%m-%d")
fetch_start = (target_dt - timedelta(days=1)).strftime("%Y-%m-%d")
fetch_end = (target_dt + timedelta(days=1)).strftime("%Y-%m-%d")

results = []
failed = []

print(f"📊 Fetching {len(TICKERS)} Japanese stocks for {TARGET_DATE}\n")

for i, ticker in enumerate(TICKERS):
    try:
        df = yf.download(ticker, start=fetch_start, end=fetch_end, progress=False)

        if df.empty:
            print(f"❌ [{i+1}/{len(TICKERS)}] {ticker}: No data")
            failed.append(ticker)
            continue

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        df.index = pd.to_datetime(df.index)
        if df.index.tz is not None:
            df.index = df.index.tz_localize(None)

        row = df[df.index.strftime("%Y-%m-%d") == TARGET_DATE]

        if row.empty:
            print(f"❌ [{i+1}/{len(TICKERS)}] {ticker}: {TARGET_DATE} not found")
            failed.append(ticker)
            continue

        r = row.iloc[0]
        results.append({
            "symbol": ticker,
            "trade_date": TARGET_DATE,
            "open": round(float(r["Open"]), 2),
            "high": round(float(r["High"]), 2),
            "low": round(float(r["Low"]), 2),
            "close": round(float(r["Close"]), 2),
            "volume": int(r["Volume"]),
        })
        print(f"✅ [{i+1}/{len(TICKERS)}] {ticker}: {round(float(r['Close']), 2)}")

    except Exception as e:
        print(f"❌ [{i+1}/{len(TICKERS)}] {ticker}: {str(e)[:50]}")
        failed.append(ticker)

    time.sleep(0.3)

# ========================
# Save Results
# ========================
print(f"\n{'='*40}")
print(f"✅ Success: {len(results)} stocks")
print(f"❌ Failed: {len(failed)} stocks")
print(f"{'='*40}\n")

if results:
    output_file = OUTPUT_DIR / f"jp_prices_{TARGET_DATE}.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"💾 Saved to: {output_file}")
    print(f"\n📋 Sample data:")
    print(json.dumps(results[0], indent=2))
else:
    print("⚠️  No data to save")
    sys.exit(1)

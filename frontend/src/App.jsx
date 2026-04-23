import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#0f4c81", "#1d4ed8", "#0f766e", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed"];
const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!data?.totals_by_category?.length) {
      setSelectedCategory("");
      return;
    }

    const categoryStillExists = data.totals_by_category.some((item) => item.category === selectedCategory);
    if (!categoryStillExists) {
      setSelectedCategory(data.totals_by_category[0].category);
    }
  }, [data, selectedCategory]);

  const periodLabel = useMemo(() => {
    if (!data?.monthly_trends?.length) return "No period loaded";
    const first = data.monthly_trends[0].month;
    const last = data.monthly_trends[data.monthly_trends.length - 1].month;
    return `${first} - ${last}`;
  }, [data]);

  const topCategory = useMemo(() => data?.totals_by_category?.[0] ?? null, [data]);

  const totalSpend = data?.summary?.total_spend ?? 0;

  const monthDelta = useMemo(() => {
    if (!data?.monthly_trends || data.monthly_trends.length < 2) return null;
    const current = data.monthly_trends[data.monthly_trends.length - 1].amount;
    const previous = data.monthly_trends[data.monthly_trends.length - 2].amount;
    if (!previous) return null;
    return (current - previous) / previous;
  }, [data]);

  const forecastDelta = useMemo(() => {
    if (!data?.prediction_next_month || !data?.summary?.avg_monthly) return null;
    return (data.prediction_next_month - data.summary.avg_monthly) / data.summary.avg_monthly;
  }, [data]);

  const summaryCards = useMemo(() => {
    if (!data) return [];

    return [
      {
        label: "Total Spend",
        value: formatCurrency(data.summary.total_spend),
        meta: `Across ${data.summary.transaction_count} transactions`,
      },
      {
        label: "Avg Transaction",
        value: formatCurrency(data.summary.avg_transaction),
        meta: "Useful for spotting high-ticket behavior",
      },
      {
        label: "Avg Monthly",
        value: formatCurrency(data.summary.avg_monthly),
        meta: monthDelta === null ? "Need 2+ months for movement" : formatDelta(monthDelta, "vs previous month"),
      },
      {
        label: "Forecast",
        value: data.prediction_next_month ? formatCurrency(data.prediction_next_month) : "Not enough data",
        meta: forecastDelta === null ? "Trend forecast unavailable" : formatDelta(forecastDelta, "vs monthly average"),
      },
    ];
  }, [data, forecastDelta, monthDelta]);

  const activeCategory = useMemo(() => {
    if (!data?.totals_by_category?.length) return null;
    return (
      data.totals_by_category.find((item) => item.category === selectedCategory) ?? data.totals_by_category[0]
    );
  }, [data, selectedCategory]);

  const activeCategoryShare = activeCategory && totalSpend ? activeCategory.amount / totalSpend : 0;

  const anomalyHighlights = useMemo(() => {
    if (!data?.anomalies?.length) return [];
    return data.anomalies.slice(0, 3);
  }, [data]);

  const reportStats = useMemo(() => {
    if (!data) return [];

    return [
      `Reporting period: ${periodLabel}`,
      `Largest category: ${topCategory?.category || "N/A"}`,
      `Anomalies detected: ${data.anomalies.length}`,
      `Forecasted next month spend: ${
        data.prediction_next_month ? formatCurrency(data.prediction_next_month) : "Not enough data"
      }`,
    ];
  }, [data, periodLabel, topCategory]);

  const handleFileSelection = (nextFile) => {
    setFile(nextFile ?? null);
    setError("");
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) return;
    await runAnalysis(file);
  };

  const runAnalysis = async (nextFile) => {
    if (!nextFile) return;

    setFile(nextFile);
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", nextFile);

      const response = await fetch(`${apiUrl}/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const message = await response.json();
        throw new Error(message.detail || "Upload failed");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSampleDemo = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/sample_transactions.csv");
      if (!response.ok) {
        throw new Error("Could not load demo dataset");
      }

      const blob = await response.blob();
      const demoFile = new File([blob], "sample_transactions.csv", { type: "text/csv" });
      await runAnalysis(demoFile);
    } catch (err) {
      setLoading(false);
      setError(err.message || "Unable to run demo");
    }
  };

  const handleExportReport = () => {
    window.print();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    handleFileSelection(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">SI</div>
          <div>
            <p>Spending Insights</p>
            <span>Personal finance analytics</span>
          </div>
        </div>
        <div className="topbar-meta">
          <span className="pill">Full-Stack Portfolio Build</span>
          <span className="pill subtle">{periodLabel}</span>
        </div>
        <div className="toolbar">
          <button type="button" className="ghost-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? "Dark presentation" : "Light presentation"}
          </button>
          <button type="button" className="ghost-button" onClick={handleSampleDemo} disabled={loading}>
            Load demo data
          </button>
          <button type="button" className="ghost-button strong" onClick={handleExportReport} disabled={!data}>
            Export PDF report
          </button>
        </div>
      </header>

      <main className="content">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Interactive Dashboard</p>
            <h1>Turn raw transaction exports into clear money decisions</h1>
            <p className="subhead">
              The app cleans uploaded CSVs, groups spend patterns, flags unusual behavior, and turns the
              output into a dashboard you can explain confidently in interviews.
            </p>
            <div className="hero-metrics">
              <div>
                <strong>CSV ingestion</strong>
                <span>Handles common bank export column variations</span>
              </div>
              <div>
                <strong>Insight engine</strong>
                <span>Combines analytics, anomalies, and habit coaching</span>
              </div>
              <div>
                <strong>Storytelling UI</strong>
                <span>Built for demos, walkthroughs, and recruiter scans</span>
              </div>
            </div>
          </div>

          <form className="upload-card" onSubmit={handleUpload}>
            <div className="upload-header">
              <h3>Upload transactions</h3>
              <p>Drop a CSV here and generate interactive spending intelligence.</p>
            </div>

            <label
              className={`file ${dragActive ? "drag-active" : ""}`}
              onDragEnter={() => setDragActive(true)}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".csv"
                onChange={(event) => handleFileSelection(event.target.files?.[0])}
              />
              <div className="file-icon">CSV</div>
              <div>
                <p>{file ? file.name : "Choose a CSV file"}</p>
                <span>{file ? "Ready to analyze" : "Drag and drop or click to upload"}</span>
              </div>
            </label>

            <div className="upload-meta">
              <span>Expected fields: date, amount, description, category</span>
              <span>Best for bank exports and budgeting datasets</span>
            </div>

            <button type="submit" disabled={!file || loading}>
              {loading ? "Analyzing..." : "Run analysis"}
            </button>

            {error && <p className="error">{error}</p>}
            {!error && data && <p className="success">Analysis ready. Explore the insights below.</p>}
            {data && !data.notes.ml_enabled && (
              <p className="note">ML packages missing. Using the statistical fallback engine.</p>
            )}
          </form>
        </section>

        {data ? (
          <>
            <section className="summary">
              {summaryCards.map((card) => (
                <div key={card.label} className="card">
                  <p>{card.label}</p>
                  <h3>{card.value}</h3>
                  <span>{card.meta}</span>
                </div>
              ))}
            </section>

            <section className="dashboard-grid">
              <section className="panel featured-panel">
                <div className="panel-header">
                  <h2>Executive Snapshot</h2>
                  <p>A quick readout of what matters most in this dataset.</p>
                </div>

                <div className="snapshot-grid">
                  <article className="spotlight">
                    <div className="spotlight-header">
                      <span className="mini-label">Largest spend bucket</span>
                      <strong>{topCategory?.category || "No data"}</strong>
                    </div>
                    <h3>{topCategory ? formatCurrency(topCategory.amount) : "-"}</h3>
                    <p>
                      {topCategory
                        ? `${Math.round((topCategory.amount / totalSpend) * 100)}% of total spending is concentrated here.`
                        : "Upload data to see where most of the money goes."}
                    </p>
                  </article>

                  <article className="spotlight alt">
                    <div className="spotlight-header">
                      <span className="mini-label">Spending momentum</span>
                      <strong>{monthDelta === null ? "Needs history" : monthDelta > 0 ? "Rising" : "Cooling"}</strong>
                    </div>
                    <h3>{monthDelta === null ? "-" : `${Math.abs(monthDelta * 100).toFixed(0)}%`}</h3>
                    <p>{monthDelta === null ? "At least two months are needed to compare movement." : formatDelta(monthDelta, "compared with the previous month")}</p>
                  </article>
                </div>

                <div className="summary-callout">
                  <div>
                    <span className="mini-label">AI-style summary</span>
                    <p className="summary-text">{data.insights.summary_text}</p>
                  </div>
                  <span className="assistant-badge">Rule-based assistant</span>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <h2>Habit Coach</h2>
                  <p>Actionable nudges generated from the current spending pattern.</p>
                </div>
                <div className="coach-list">
                  {data.insights.habit_tips.map((tip, index) => (
                    <article key={index} className="coach-item">
                      <span>{`0${index + 1}`}</span>
                      <p>{tip}</p>
                    </article>
                  ))}
                </div>
                <div className="merchant-panel">
                  <h4>Top merchants</h4>
                  <div className="merchant-list">
                    {data.insights.top_merchants.map((item, index) => (
                      <div key={index} className="merchant-item">
                        <span>{item.merchant || "Unknown merchant"}</span>
                        <strong>{formatCurrency(item.total)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </section>

            <section className="report-strip">
              <section className="panel report-panel">
                <div className="panel-header">
                  <h2>Shareable Report</h2>
                  <p>One-click print layout for portfolio walkthroughs, screenshots, and PDF export.</p>
                </div>
                <div className="report-grid">
                  {reportStats.map((item) => (
                    <div key={item} className="report-stat">
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            </section>

            <section className="grid-two">
              <section className="panel">
                <div className="panel-header">
                  <h2>Monthly Trend</h2>
                  <p>Spend movement over time, with a cleaner narrative arc for demos.</p>
                </div>
                <div className="chart">
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={data.monthly_trends}>
                      <defs>
                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.32} />
                          <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Area type="monotone" dataKey="amount" stroke="#1d4ed8" fill="url(#trendFill)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <h2>Forecast Outlook</h2>
                  <p>Forward-looking estimate based on recent monthly behavior.</p>
                </div>
                <div className="prediction">
                  <h3>
                    {data.prediction_next_month ? formatCurrency(data.prediction_next_month) : "Not enough data"}
                  </h3>
                  <p>Model: {data.notes.ml_enabled ? "Linear Regression" : "Linear Trend"}</p>
                  <div className="prediction-stat">
                    <span>Expected direction</span>
                    <strong>
                      {forecastDelta === null
                        ? "Stable"
                        : forecastDelta > 0
                          ? `${Math.abs(forecastDelta * 100).toFixed(0)}% above average`
                          : `${Math.abs(forecastDelta * 100).toFixed(0)}% below average`}
                    </strong>
                  </div>
                </div>
              </section>
            </section>

            <section className="grid-two">
              <section className="panel">
                <div className="panel-header">
                  <h2>Spending by Category</h2>
                  <p>Click any category to spotlight how much budget it absorbs.</p>
                </div>

                <div className="category-workbench">
                  <div className="chart donut-chart">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={data.totals_by_category} dataKey="amount" nameKey="category" innerRadius={72}>
                          {data.totals_by_category.map((item, index) => (
                            <Cell
                              key={item.category}
                              fill={COLORS[index % COLORS.length]}
                              opacity={!activeCategory || item.category === activeCategory.category ? 1 : 0.35}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="category-sidebar">
                    <div className="category-list">
                      {data.totals_by_category.map((item, index) => {
                        const share = totalSpend ? item.amount / totalSpend : 0;
                        const active = activeCategory?.category === item.category;
                        return (
                          <button
                            type="button"
                            key={item.category}
                            className={`category-chip ${active ? "active" : ""}`}
                            onClick={() => setSelectedCategory(item.category)}
                          >
                            <div className="category-chip-head">
                              <span className="color-dot" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                              <strong>{item.category}</strong>
                              <em>{formatCurrency(item.amount)}</em>
                            </div>
                            <div className="progress-track">
                              <div className="progress-fill" style={{ width: `${Math.max(share * 100, 6)}%` }} />
                            </div>
                            <small>{Math.round(share * 100)}% of total spend</small>
                          </button>
                        );
                      })}
                    </div>

                    <div className="category-detail">
                      <span className="mini-label">Category spotlight</span>
                      <h3>{activeCategory?.category || "No category selected"}</h3>
                      <p>
                        {activeCategory
                          ? `${formatCurrency(activeCategory.amount)} spent here, accounting for ${Math.round(
                              activeCategoryShare * 100
                            )}% of the uploaded transaction set.`
                          : "Pick a category to get a sharper breakdown."}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <h2>Category Comparison</h2>
                  <p>Top categories ranked for quick scanning.</p>
                </div>
                <div className="chart">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={data.totals_by_category.slice(0, 8)} layout="vertical" margin={{ left: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="category" width={92} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Bar dataKey="amount" fill="#0f4c81" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </section>

            <section className="dashboard-grid">
              <section className="panel anomalies">
                <div className="panel-header">
                  <h2>Unusual Spending</h2>
                  <p>Transactions the model considers outside the typical pattern.</p>
                </div>
                <div className="table">
                  <div className="row head">
                    <span>Date</span>
                    <span>Description</span>
                    <span>Category</span>
                    <span>Amount</span>
                  </div>
                  {data.anomalies.length === 0 && <div className="row empty">No anomalies detected yet.</div>}
                  {data.anomalies.map((item, index) => (
                    <div className="row" key={`${item.date}-${item.amount}-${index}`}>
                      <span>{formatDate(item.date)}</span>
                      <span>{item.description || "-"}</span>
                      <span>{item.category || "Uncategorized"}</span>
                      <span>{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel anomaly-sidecar">
                <div className="panel-header">
                  <h2>Anomaly Highlights</h2>
                  <p>Short callouts to make the detection feel more tangible.</p>
                </div>
                <div className="highlight-list">
                  {anomalyHighlights.length === 0 && (
                    <div className="highlight-card">
                      <strong>No unusual transactions</strong>
                      <p>The current dataset looks fairly consistent across transaction sizes.</p>
                    </div>
                  )}
                  {anomalyHighlights.map((item, index) => (
                    <article key={`${item.date}-${index}`} className="highlight-card">
                      <span className="mini-label">{`Flag ${index + 1}`}</span>
                      <strong>{formatCurrency(item.amount)}</strong>
                      <p>{item.description || "Unlabeled merchant"}</p>
                      <small>{`${formatDate(item.date)} • ${item.category || "Uncategorized"}`}</small>
                    </article>
                  ))}
                </div>

                <div className="trend-mini">
                  <span className="mini-label">Trend line preview</span>
                  <div className="mini-chart">
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={data.monthly_trends}>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Line type="monotone" dataKey="amount" stroke="#0f766e" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>
            </section>
          </>
        ) : (
          <section className="empty-state">
            <div>
              <h2>Upload a CSV to unlock the interactive experience</h2>
              <p>
                Upload your own bank export or load the demo dataset to explore category spotlights,
                anomaly callouts, habit coaching, and forecasting in one polished dashboard.
              </p>
            </div>
            <div className="empty-state-actions">
              <button type="button" className="ghost-button strong" onClick={handleSampleDemo} disabled={loading}>
                {loading ? "Loading demo..." : "Try demo data"}
              </button>
              <span>Best results come from CSVs with `date`, `amount`, `description`, and `category` fields.</span>
            </div>
          </section>
        )}
      </main>

      {data && (
        <section className="print-report">
          <h1>Spending Insights Report</h1>
          <p>{data.insights.summary_text}</p>
          <div className="print-grid">
            {summaryCards.map((card) => (
              <div key={card.label} className="print-card">
                <strong>{card.label}</strong>
                <span>{card.value}</span>
                <small>{card.meta}</small>
              </div>
            ))}
          </div>
          <h2>Top Habits To Watch</h2>
          <ul>
            {data.insights.habit_tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
          <h2>Top Merchants</h2>
          <ul>
            {data.insights.top_merchants.map((item) => (
              <li key={`${item.merchant}-${item.total}`}>
                {item.merchant || "Unknown merchant"}: {formatCurrency(item.total)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function formatCurrency(value) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDelta(value, suffix) {
  const direction = value > 0 ? "up" : "down";
  return `${Math.abs(value * 100).toFixed(0)}% ${direction} ${suffix}`;
}

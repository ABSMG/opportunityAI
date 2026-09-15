import React, { useState } from "react";

const API_BASE = "";

const tabs = [
  "Overview",
  "Opportunities",
  "Outreach",
  "Applications"
];

const initialProfile = {
  skills: [
    "English",
    "Swahili",
    "communication",
    "translation",
    "AI",
    "computer",
    "internet"
  ],
  ownerId: null
};

function App() {
  const [activeTab, setActiveTab] =
    useState("Overview");

  const [scanning, setScanning] =
    useState(false);

  const [scanMessage, setScanMessage] =
    useState("");

  const [opportunities, setOpportunities] =
    useState([]);

  const [profile] =
    useState(initialProfile);

  const [error, setError] =
    useState("");

  const runScanner = async () => {
    setScanning(true);
    setError("");
    setScanMessage("Starting AI Scanner...");
    setOpportunities([]);

    try {
      const response = await fetch(
        `${API_BASE}/api/scanner/run`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            userProfile: profile,
            save: true
          })
        }
      );

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            data.error ||
            "Scanner failed."
        );
      }

      setOpportunities(
        data.opportunities || []
      );

      if (
        data.opportunities?.length
      ) {
        setScanMessage(
          `Scanner found ${data.opportunities.length} relevant opportunities.`
        );
      } else {
        setScanMessage(
          data.message ||
            "Scanner completed. No matching opportunities were found."
        );
      }
    } catch (err) {
      console.error(
        "Scanner error:",
        err
      );

      setError(
        err.message ||
          "Unable to run scanner."
      );

      setScanMessage("");
    } finally {
      setScanning(false);
    }
  };

  const loadSavedOpportunities =
    async () => {
      setError("");
      setScanMessage(
        "Loading saved opportunities..."
      );

      try {
        const response =
          await fetch(
            "/api/opportunities"
          );

        const data =
          await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "Unable to load opportunities."
          );
        }

        setOpportunities(
          data.opportunities || []
        );

        setScanMessage(
          `Loaded ${data.opportunities?.length || 0} saved opportunities.`
        );
      } catch (err) {
        console.error(
          "Load opportunities error:",
          err
        );

        setError(
          err.message ||
            "Unable to load opportunities."
        );
      }
    };

  const formatScore = (value) => {
    if (
      value === null ||
      value === undefined
    ) {
      return "—";
    }

    return `${Math.round(
      Number(value) || 0
    )}%`;
  };

  const getPriority = (opportunity) => {
    const score =
      opportunity.aiAnalysis
        ?.fitScore ??
      opportunity.matchScore ??
      0;

    if (score >= 80) {
      return "HIGH";
    }

    if (score >= 60) {
      return "MEDIUM";
    }

    return "LOW";
  };

  return (
    <div className="app">

      {/* ================================= */}
      {/* HEADER */}
      {/* ================================= */}

      <header className="header">
        <div>
          <h1>
            OpportunityAI
          </h1>

          <p className="subtitle">
            AI-powered opportunity
            automation
          </p>
        </div>

        <div className="status">
          <span className="status-dot">
            ●
          </span>

          Automation Ready
        </div>
      </header>

      {/* ================================= */}
      {/* HERO */}
      {/* ================================= */}

      <section className="hero">
        <div className="hero-content">

          <div className="hero-badge">
            REVENUE ENGINE
          </div>

          <h2>
            Find opportunities.
            <br />
            Let AI do the analysis.
          </h2>

          <p>
            OpportunityAI discovers
            legitimate remote jobs,
            freelance opportunities and
            potential customers, then
            analyzes and ranks them for
            you.
          </p>

          <div className="target">
            <strong>
              TZS 10,000+
            </strong>

            <span>
              daily target
            </span>
          </div>

          <small className="notice">
            Target only — income is not
            guaranteed.
          </small>

        </div>
      </section>

      {/* ================================= */}
      {/* NAVIGATION */}
      {/* ================================= */}

      <nav className="tabs">

        {tabs.map((tab) => (
          <button
            key={tab}
            className={
              activeTab === tab
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActiveTab(tab)
            }
          >
            {tab}
          </button>
        ))}

      </nav>

      {/* ================================= */}
      {/* MAIN */}
      {/* ================================= */}

      <main className="main">

        {/* ================================= */}
        {/* OVERVIEW */}
        {/* ================================= */}

        {activeTab ===
          "Overview" && (
          <>

            <section className="scanner-card">

              <div>
                <div className="section-label">
                  OPPORTUNITY SCANNER
                </div>

                <h2>
                  Find new opportunities
                </h2>

                <p>
                  Scan approved opportunity
                  sources, analyze them with
                  AI, match them against your
                  skills and rank the best
                  opportunities.
                </p>
              </div>

              <div className="scanner-actions">

                <button
                  className="primary-button"
                  onClick={runScanner}
                  disabled={scanning}
                >
                  {scanning
                    ? "Scanning..."
                    : "🔎 Run AI Scanner"}
                </button>

                <button
                  className="secondary-button"
                  onClick={
                    loadSavedOpportunities
                  }
                  disabled={scanning}
                >
                  Load Saved
                </button>

              </div>

              {scanning && (
                <div className="scanner-progress">
                  <div className="spinner" />
                  <span>
                    Fetching → Analyzing →
                    Matching → Ranking →
                    Saving
                  </span>
                </div>
              )}

              {scanMessage && (
                <div className="success-message">
                  {scanMessage}
                </div>
              )}

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

            </section>

            {/* ============================ */}
            {/* WORKFLOW */}
            {/* ============================ */}

            <section className="workflow-card">

              <div className="section-label">
                AUTOMATION WORKFLOW
              </div>

              <div className="workflow">

                {[
                  "Find",
                  "Analyze",
                  "Match",
                  "Prepare",
                  "Reach Out",
                  "Track",
                  "Convert"
                ].map(
                  (
                    step,
                    index
                  ) => (
                    <React.Fragment
                      key={step}
                    >

                      <div className="workflow-step">
                        <span>
                          {index + 1}
                        </span>

                        <strong>
                          {step}
                        </strong>
                      </div>

                      {index <
                        6 && (
                        <div className="arrow">
                          →
                        </div>
                      )}

                    </React.Fragment>
                  )
                )}

              </div>

            </section>

            {/* ============================ */}
            {/* CHANNELS */}
            {/* ============================ */}

            <section className="channels">

              <div className="channel-card">
                <div className="channel-icon">
                  💼
                </div>

                <h3>
                  Remote Jobs
                </h3>

                <p>
                  Discover legitimate
                  remote employment
                  opportunities.
                </p>
              </div>

              <div className="channel-card">
                <div className="channel-icon">
                  🛠️
                </div>

                <h3>
                  Freelance Gigs
                </h3>

                <p>
                  Find freelance projects
                  matching your skills.
                </p>
              </div>

              <div className="channel-card">
                <div className="channel-icon">
                  🎯
                </div>

                <h3>
                  Direct Customers
                </h3>

                <p>
                  Identify potential
                  customers for legitimate
                  outreach.
                </p>
              </div>

            </section>

          </>
        )}

        {/* ================================= */}
        {/* OPPORTUNITIES */}
        {/* ================================= */}

        {activeTab ===
          "Opportunities" && (
          <section>

            <div className="page-heading">
              <div>
                <div className="section-label">
                  OPPORTUNITY DATABASE
                </div>

                <h2>
                  Recommended Opportunities
                </h2>
              </div>

              <button
                className="primary-button"
                onClick={runScanner}
                disabled={scanning}
              >
                {scanning
                  ? "Scanning..."
                  : "🔎 Scan Now"}
              </button>
            </div>

            {opportunities.length ===
              0 && (
              <div className="empty-state">

                <div className="empty-icon">
                  🔎
                </div>

                <h3>
                  No opportunities yet
                </h3>

                <p>
                  Run the AI Scanner to
                  discover matching
                  opportunities.
                </p>

                <button
                  className="primary-button"
                  onClick={runScanner}
                  disabled={scanning}
                >
                  Run AI Scanner
                </button>

              </div>
            )}

            <div className="opportunity-list">

              {opportunities.map(
                (opportunity, index) => {

                  const priority =
                    getPriority(
                      opportunity
                    );

                  const fitScore =
                    opportunity
                      .aiAnalysis
                      ?.fitScore ??
                    opportunity.matchScore ??
                    0;

                  const opportunityScore =
                    opportunity
                      .opportunityScore ??
                    0;

                  return (
                    <article
                      className="opportunity-card"
                      key={
                        opportunity.id ||
                        opportunity.url ||
                        index
                      }
                    >

                      <div className="opportunity-top">

                        <div>
                          <span className="opportunity-type">
                            {String(
                              opportunity.type ||
                                "opportunity"
                            ).replace(
                              "_",
                              " "
                            )}
                          </span>

                          <h3>
                            {opportunity.title ||
                              "Untitled opportunity"}
                          </h3>

                          {opportunity.company && (
                            <p className="company">
                              {opportunity.company}
                            </p>
                          )}
                        </div>

                        <span
                          className={`priority ${priority.toLowerCase()}`}
                        >
                          {priority}
                        </span>

                      </div>

                      <p className="description">
                        {opportunity.description ||
                          "No description available."}
                      </p>

                      <div className="scores">

                        <div>
                          <span>
                            AI Match
                          </span>

                          <strong>
                            {formatScore(
                              fitScore
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Opportunity
                          </span>

                          <strong>
                            {formatScore(
                              opportunityScore
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Remote
                          </span>

                          <strong>
                            {opportunity.remote
                              ? "YES"
                              : "NO"}
                          </strong>
                        </div>

                      </div>

                      {opportunity
                        .aiAnalysis
                        ?.matchedSkills
                        ?.length > 0 && (
                        <div className="skills">

                          <span>
                            Matched skills:
                          </span>

                          {opportunity.aiAnalysis.matchedSkills.map(
                            (skill) => (
                              <span
                                className="skill"
                                key={skill}
                              >
                                {skill}
                              </span>
                            )
                          )}

                        </div>
                      )}

                      <div className="opportunity-actions">

                        {opportunity.url && (
                          <a
                            href={
                              opportunity.url
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="secondary-button"
                          >
                            View Opportunity
                          </a>
                        )}

                        <button
                          className="primary-button"
                          onClick={() =>
                            alert(
                              "Preparation workflow will be connected next."
                            )
                          }
                        >
                          Prepare
                        </button>

                      </div>

                    </article>
                  );
                }
              )}

            </div>

          </section>
        )}

        {/* ================================= */}
        {/* OUTREACH */}
        {/* ================================= */}

        {activeTab ===
          "Outreach" && (
          <section className="placeholder-page">

            <div className="placeholder-icon">
              📣
            </div>

            <div className="section-label">
              OUTREACH MANAGER
            </div>

            <h2>
              Smart Outreach
            </h2>

            <p>
              Prepare personalized
              outreach messages for
              relevant opportunities and
              potential customers.
            </p>

            <div className="automation-note">
              Messages will remain
              <strong>
                {" "}READY FOR REVIEW
              </strong>
              until you approve them.
            </div>

          </section>
        )}

        {/* ================================= */}
        {/* APPLICATIONS */}
        {/* ================================= */}

        {activeTab ===
          "Applications" && (
          <section className="placeholder-page">

            <div className="placeholder-icon">
              📋
            </div>

            <div className="section-label">
              APPLICATION TRACKER
            </div>

            <h2>
              Track Your Applications
            </h2>

            <p>
              Track prepared applications,
              submitted applications,
              interviews, offers and
              completed opportunities.
            </p>

            <div className="tracker-grid">

              <div>
                <strong>
                  0
                </strong>
                <span>
                  Prepared
                </span>
              </div>

              <div>
                <strong>
                  0
                </strong>
                <span>
                  Applied
                </span>
              </div>

              <div>
                <strong>
                  0
                </strong>
                <span>
                  Interviews
                </span>
              </div>

              <div>
                <strong>
                  0
                </strong>
                <span>
                  Offers
                </span>
              </div>

            </div>

          </section>
        )}

      </main>

      {/* ================================= */}
      {/* FOOTER */}
      {/* ================================= */}

      <footer className="footer">
        <strong>
          OpportunityAI
        </strong>

        <span>
          Find • Analyze • Match •
          Prepare • Track
        </span>
      </footer>

      {/* ================================= */}
      {/* STYLES */}
      {/* ================================= */}

      <style>{`

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          background: #f8fafc;
          color: #0f172a;
        }

        button,
        a {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .app {
          min-height: 100vh;
        }

        /* HEADER */

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 22px 6%;
          background: #0f172a;
          color: white;
        }

        .header h1 {
          margin: 0;
          font-size: 24px;
        }

        .subtitle {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 13px;
        }

        .status {
          font-size: 13px;
          display: flex;
          gap: 7px;
          align-items: center;
          color: #cbd5e1;
        }

        .status-dot {
          color: #22c55e;
        }

        /* HERO */

        .hero {
          padding: 70px 6%;
          background:
            linear-gradient(
              135deg,
              #0f172a,
              #1e293b
            );
          color: white;
        }

        .hero-content {
          max-width: 850px;
        }

        .hero-badge,
        .section-label {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #64748b;
        }

        .hero-badge {
          color: #38bdf8;
          margin-bottom: 14px;
        }

        .hero h2 {
          margin: 0;
          font-size: clamp(
            34px,
            6vw,
            60px
          );
          line-height: 1.05;
        }

        .hero p {
          max-width: 650px;
          color: #cbd5e1;
          line-height: 1.7;
          margin: 22px 0;
        }

        .target {
          display: flex;
          gap: 10px;
          align-items: baseline;
        }

        .target strong {
          font-size: 30px;
        }

        .target span {
          color: #94a3b8;
        }

        .notice {
          color: #94a3b8;
        }

        /* TABS */

        .tabs {
          display: flex;
          gap: 5px;
          padding: 0 6%;
          background: white;
          border-bottom: 1px solid #e2e8f0;
          overflow-x: auto;
        }

        .tab {
          border: 0;
          background: transparent;
          padding: 17px 15px;
          color: #64748b;
          white-space: nowrap;
          border-bottom: 3px solid transparent;
        }

        .tab.active {
          color: #0f172a;
          border-bottom-color: #0f172a;
          font-weight: 700;
        }

        /* MAIN */

        .main {
          max-width: 1200px;
          margin: auto;
          padding: 40px 6%;
        }

        /* CARDS */

        .scanner-card,
        .workflow-card,
        .channel-card,
        .placeholder-page,
        .opportunity-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
        }

        .scanner-card {
          padding: 30px;
        }

        .scanner-card h2,
        .page-heading h2,
        .placeholder-page h2 {
          margin: 8px 0;
        }

        .scanner-card p {
          color: #64748b;
          line-height: 1.7;
          max-width: 700px;
        }

        .scanner-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 24px;
        }

        .primary-button,
        .secondary-button {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          border-radius: 10px;
          padding: 11px 16px;
          text-decoration: none;
          font-weight: 700;
          border: 1px solid transparent;
        }

        .primary-button {
          background: #0f172a;
          color: white;
        }

        .primary-button:hover {
          background: #1e293b;
        }

        .primary-button:disabled {
          opacity: .6;
          cursor: wait;
        }

        .secondary-button {
          background: white;
          color: #0f172a;
          border-color: #cbd5e1;
        }

        .scanner-progress {
          margin-top: 20px;
          padding: 14px;
          border-radius: 10px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #475569;
          font-size: 14px;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 3px solid #cbd5e1;
          border-top-color: #0f172a;
          border-radius: 50%;
          animation: spin .8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .success-message {
          margin-top: 18px;
          padding: 13px;
          border-radius: 10px;
          background: #f0fdf4;
          color: #166534;
        }

        .error-message {
          margin-top: 18px;
          padding: 13px;
          border-radius: 10px;
          background: #fef2f2;
          color: #991b1b;
        }

        /* WORKFLOW */

        .workflow-card {
          margin-top: 25px;
          padding: 25px;
        }

        .workflow {
          margin-top: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .workflow-step {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }

        .workflow-step span {
          width: 27px;
          height: 27px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #0f172a;
          color: white;
          font-size: 11px;
        }

        .arrow {
          color: #94a3b8;
        }

        /* CHANNELS */

        .channels {
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 18px;
          margin-top: 25px;
        }

        .channel-card {
          padding: 24px;
        }

        .channel-icon {
          font-size: 28px;
        }

        .channel-card h3 {
          margin-bottom: 8px;
        }

        .channel-card p {
          color: #64748b;
          line-height: 1.6;
          font-size: 14px;
        }

        /* PAGE HEADING */

        .page-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 25px;
        }

        /* OPPORTUNITIES */

        .opportunity-list {
          display: grid;
          gap: 18px;
        }

        .opportunity-card {
          padding: 24px;
        }

        .opportunity-top {
          display: flex;
          justify-content: space-between;
          gap: 20px;
        }

        .opportunity-type {
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 800;
          letter-spacing: 1px;
          color: #64748b;
        }

        .opportunity-card h3 {
          margin: 7px 0;
          font-size: 20px;
        }

        .company {
          color: #64748b;
          margin: 0;
        }

        .priority {
          height: fit-content;
          padding: 6px 9px;
          border-radius: 7px;
          font-size: 10px;
          font-weight: 800;
        }

        .priority.high {
          background: #dcfce7;
          color: #166534;
        }

        .priority.medium {
          background: #fef3c7;
          color: #92400e;
        }

        .priority.low {
          background: #f1f5f9;
          color: #475569;
        }

        .description {
          color: #64748b;
          line-height: 1.6;
          font-size: 14px;
        }

        .scores {
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 10px;
          margin: 20px 0;
        }

        .scores div {
          background: #f8fafc;
          padding: 13px;
          border-radius: 10px;
        }

        .scores span,
        .scores strong {
          display: block;
        }

        .scores span {
          color: #64748b;
          font-size: 11px;
        }

        .scores strong {
          margin-top: 5px;
        }

        .skills {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          align-items: center;
          margin-bottom: 18px;
          font-size: 12px;
        }

        .skill {
          background: #e2e8f0;
          border-radius: 6px;
          padding: 5px 8px;
        }

        .opportunity-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        /* EMPTY */

        .empty-state {
          text-align: center;
          background: white;
          border: 1px dashed #cbd5e1;
          border-radius: 18px;
          padding: 55px 25px;
        }

        .empty-icon {
          font-size: 40px;
        }

        .empty-state p {
          color: #64748b;
          margin-bottom: 22px;
        }

        /* PLACEHOLDER */

        .placeholder-page {
          text-align: center;
          padding: 70px 25px;
        }

        .placeholder-icon {
          font-size: 45px;
          margin-bottom: 15px;
        }

        .placeholder-page p {
          max-width: 600px;
          margin: 15px auto;
          color: #64748b;
          line-height: 1.7;
        }

        .automation-note {
          display: inline-block;
          margin-top: 20px;
          padding: 14px 18px;
          border-radius: 10px;
          background: #f1f5f9;
          color: #475569;
        }

        .tracker-grid {
          max-width: 700px;
          margin: 30px auto 0;
          display: grid;
          grid-template-columns:
            repeat(4, 1fr);
          gap: 12px;
        }

        .tracker-grid div {
          background: #f8fafc;
          padding: 18px 10px;
          border-radius: 10px;
        }

        .tracker-grid strong,
        .tracker-grid span {
          display: block;
        }

        .tracker-grid strong {
          font-size: 25px;
        }

        .tracker-grid span {
          color: #64748b;
          font-size: 12px;
          margin-top: 4px;
        }

        /* FOOTER */

        .footer {
          padding: 30px 6%;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          gap: 15px;
          color: #64748b;
          font-size: 13px;
        }

        /* MOBILE */

        @media (
          max-width: 700px
        ) {

          .header {
            padding: 18px 5%;
          }

          .status {
            font-size: 11px;
          }

          .hero {
            padding: 50px 5%;
          }

          .main {
            padding: 28px 5%;
          }

          .channels {
            grid-template-columns: 1fr;
          }

          .scores {
            grid-template-columns: 1fr;
          }

          .tracker-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .page-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .opportunity-top {
            flex-direction: column;
          }

          .footer {
            flex-direction: column;
          }

        }

      `}</style>

    </div>
  );
}

export default App;

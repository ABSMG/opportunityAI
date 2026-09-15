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

            <div className="automation

import React, { useState } from "react";

const opportunityTypes = [
  {
    id: "remote",
    name: "Remote Jobs",
    icon: "💼",
    description: "Find remote opportunities matching your skills."
  },
  {
    id: "freelance",
    name: "Freelance Gigs",
    icon: "🧑‍💻",
    description: "Discover freelance work and prepare targeted proposals."
  },
  {
    id: "customers",
    name: "Direct Customers",
    icon: "🏢",
    description: "Identify businesses that may need your services."
  }
];

function App() {
  const [active, setActive] = useState("overview");

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.logo}>OpportunityAI</h1>
          <p style={styles.tagline}>
            AI-powered opportunity automation
          </p>
        </div>

        <div style={styles.status}>
          <span style={styles.dot}></span>
          Automation Ready
        </div>
      </header>

      <main style={styles.container}>
        <section style={styles.hero}>
          <div>
            <p style={styles.eyebrow}>REVENUE ENGINE</p>

            <h2 style={styles.title}>
              Find opportunities.
              <br />
              Turn them into income.
            </h2>

            <p style={styles.text}>
              OpportunityAI is designed to discover legitimate paid
              opportunities, analyze them with AI, prepare applications
              and proposals, and help manage the path from opportunity
              to completed work.
            </p>

            <button
              style={styles.primaryButton}
              onClick={() => setActive("opportunities")}
            >
              Start Opportunity Scan
            </button>
          </div>

          <div style={styles.revenueCard}>
            <span style={styles.cardLabel}>Revenue Target</span>
            <strong style={styles.revenue}>TZS 10,000+</strong>
            <span style={styles.cardSmall}>
              daily target — not guaranteed
            </span>
          </div>
        </section>

        <nav style={styles.nav}>
          <button
            style={active === "overview" ? styles.activeNav : styles.navButton}
            onClick={() => setActive("overview")}
          >
            Overview
          </button>

          <button
            style={
              active === "opportunities"
                ? styles.activeNav
                : styles.navButton
            }
            onClick={() => setActive("opportunities")}
          >
            Opportunities
          </button>

          <button
            style={active === "outreach" ? styles.activeNav : styles.navButton}
            onClick={() => setActive("outreach")}
          >
            Outreach
          </button>

          <button
            style={active === "applications" ? styles.activeNav : styles.navButton}
            onClick={() => setActive("applications")}
          >
            Applications
          </button>
        </nav>

        {active === "overview" && (
          <>
            <section style={styles.section}>
              <h3>Income Channels</h3>

              <div style={styles.grid}>
                {opportunityTypes.map((item) => (
                  <div key={item.id} style={styles.channelCard}>
                    <div style={styles.icon}>{item.icon}</div>

                    <h4>{item.name}</h4>

                    <p style={styles.muted}>
                      {item.description}
                    </p>

                    <button
                      style={styles.secondaryButton}
                      onClick={() => setActive("opportunities")}
                    >
                      Explore
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section style={styles.workflow}>
              <h3>Automation Workflow</h3>

              <div style={styles.workflowGrid}>
                <div>🔎 Find</div>
                <div>🧠 Analyze</div>
                <div>🎯 Match</div>
                <div>✍️ Prepare</div>
                <div>📩 Reach Out</div>
                <div>📊 Track</div>
                <div>💰 Convert</div>
              </div>
            </section>
          </>
        )}

        {active === "opportunities" && (
          <section style={styles.section}>
            <h3>Opportunity Scanner</h3>

            <div style={styles.scanCard}>
              <h4>AI Opportunity Scanner</h4>

              <p style={styles.muted}>
                The scanner will search approved data sources for
                relevant remote jobs, freelance work and potential
                customers.
              </p>

              <div style={styles.scanStatus}>
                <span>System:</span>
                <strong> Waiting for data sources</strong>
              </div>

              <button style={styles.primaryButton}>
                Configure Scanner
              </button>
            </div>
          </section>
        )}

        {active === "outreach" && (
          <section style={styles.section}>
            <h3>Outreach Manager</h3>

            <div style={styles.scanCard}>
              <h4>Customer Acquisition</h4>

              <p style={styles.muted}>
                AI will help identify relevant prospects, personalize
                messages and track responses. Automated outreach will
                follow the rules of each communication platform.
              </p>

              <div style={styles.metrics}>
                <div>
                  <strong>0</strong>
                  <span>Prospects</span>
                </div>

                <div>
                  <strong>0</strong>
                  <span>Messages</span>
                </div>

                <div>
                  <strong>0</strong>
                  <span>Responses</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {active === "applications" && (
          <section style={styles.section}>
            <h3>Application Tracker</h3>

            <div style={styles.empty}>
              <div style={styles.emptyIcon}>📋</div>

              <h4>No applications yet</h4>

              <p style={styles.muted}>
                Opportunities approved by you will appear here.
              </p>
            </div>
          </section>
        )}
      </main>

      <footer style={styles.footer}>
        <p>
          OpportunityAI © 2026 — Built to automate opportunity discovery
          and income-related workflows.
        </p>
      </footer>
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "#f8fafc",
    color: "#0f172a",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  },

  header: {
    background: "#0f172a",
    color: "#fff",
    padding: "22px 6%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap"
  },

  logo: {
    margin: 0,
    fontSize: "26px"
  },

  tagline: {
    margin: "4px 0 0",
    opacity: 0.7,
    fontSize: "14px"
  },

  status: {
    fontSize: "13px",
    background: "rgba(255,255,255,0.08)",
    padding: "9px 13px",
    borderRadius: "999px"
  },

  dot: {
    display: "inline-block",
    width: "8px",
    height: "8px",
    background: "#22c55e",
    borderRadius: "50%",
    marginRight: "8px"
  },

  container: {
    width: "88%",
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "45px 0"
  },

  hero: {
    background: "#111827",
    color: "#fff",
    borderRadius: "24px",
    padding: "40px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "35px",
    flexWrap: "wrap"
  },

  eyebrow: {
    fontSize: "12px",
    letterSpacing: "2px",
    opacity: 0.6,
    fontWeight: 700
  },

  title: {
    fontSize: "clamp(34px, 6vw, 60px)",
    lineHeight: 1.05,
    margin: "12px 0 20px"
  },

  text: {
    maxWidth: "650px",
    lineHeight: 1.7,
    opacity: 0.78
  },

  primaryButton: {
    border: 0,
    background: "#fff",
    color: "#111827",
    padding: "13px 18px",
    borderRadius: "10px",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: "12px"
  },

  revenueCard: {
    minWidth: "220px",
    background: "rgba(255,255,255,0.08)",
    padding: "25px",
    borderRadius: "18px"
  },

  cardLabel: {
    display: "block",
    opacity: 0.65,
    fontSize: "13px"
  },

  revenue: {
    display: "block",
    fontSize: "30px",
    margin: "10px 0"
  },

  cardSmall: {
    fontSize: "12px",
    opacity: 0.55
  },

  nav: {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    padding: "24px 0"
  },

  navButton: {
    border: "1px solid #e2e8f0",
    background: "#fff",
    padding: "11px 15px",
    borderRadius: "9px",
    cursor: "pointer",
    whiteSpace: "nowrap"
  },

  activeNav: {
    border: "0",
    background: "#0f172a",
    color: "#fff",
    padding: "11px 15px",
    borderRadius: "9px",
    cursor: "pointer",
    whiteSpace: "nowrap"
  },

  section: {
    marginTop: "10px"
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "18px",
    marginTop: "20px"
  },

  channelCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "22px"
  },

  icon: {
    fontSize: "30px"
  },

  muted: {
    color: "#64748b",
    lineHeight: 1.6
  },

  secondaryButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    padding: "10px 14px",
    borderRadius: "9px",
    cursor: "pointer"
  },

  workflow: {
    marginTop: "35px",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "25px"
  },

  workflowGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "10px",
    marginTop: "20px"
  },

  scanCard: {
    marginTop: "20px",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "28px"
  },

  scanStatus: {
    margin: "20px 0",
    padding: "15px",
    background: "#f8fafc",
    borderRadius: "10px"
  },

  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "15px",
    marginTop: "25px"
  },

  empty: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "45px",
    textAlign: "center",
    marginTop: "20px"
  },

  emptyIcon: {
    fontSize: "40px"
  },

  footer: {
    textAlign: "center",
    padding: "30px 20px",
    color: "#64748b",
    fontSize: "13px"
  }
};

export default App;

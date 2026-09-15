import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function ApplicationsPanel() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const loadApplications = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/applications");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load applications."
        );
      }

      setApplications(data.applications || []);
    } catch (err) {
      console.error("Applications load error:", err);
      setError(err.message || "Unable to load applications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const updateApplication = async (id, action) => {
    setBusyId(id);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/applications/${encodeURIComponent(id)}/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || `Unable to ${action} application.`
        );
      }

      setApplications((current) =>
        current.map((application) =>
          application.id === id
            ? {
                ...application,
                ...data.application,
                opportunities:
                  data.application?.opportunities ||
                  application.opportunities
              }
            : application
        )
      );

      setMessage(
        data.message || "Application updated successfully."
      );
    } catch (err) {
      console.error("Application action error:", err);
      setError(err.message || "Application action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const getOpportunity = (application) => {
    return (
      application.opportunities ||
      application.opportunity ||
      null
    );
  };

  const statusClass = (status = "") =>
    `application-status status-${String(status).toLowerCase()}`;

  const counts = {
    prepared: applications.filter(
      (item) => item.status === "READY_FOR_REVIEW"
    ).length,

    approved: applications.filter(
      (item) => item.status === "APPROVED"
    ).length,

    applied: applications.filter(
      (item) => item.status === "APPLIED"
    ).length,

    interviews: applications.filter(
      (item) => item.status === "INTERVIEW"
    ).length
  };

  return (
    <section className="applications-connected">

      <div className="applications-heading">
        <div>
          <div className="section-label">
            APPLICATION TRACKER
          </div>

          <h2>
            Review & Track Applications
          </h2>

          <p>
            AI-prepared applications stay under your control.
            Review first, approve when ready, submit manually on
            the permitted platform, then mark the application as
            applied.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={loadApplications}
          disabled={loading}
        >
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </div>

      <div className="application-summary">

        <div>
          <strong>{counts.prepared}</strong>
          <span>Ready for review</span>
        </div>

        <div>
          <strong>{counts.approved}</strong>
          <span>Approved</span>
        </div>

        <div>
          <strong>{counts.applied}</strong>
          <span>Applied</span>
        </div>

        <div>
          <strong>{counts.interviews}</strong>
          <span>Interviews</span>
        </div>

      </div>

      {message && (
        <div className="success-message">
          {message}
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading ? (

        <div className="empty-state">
          <div className="spinner" />

          <h3>
            Loading applications...
          </h3>
        </div>

      ) : applications.length === 0 ? (

        <div className="empty-state">

          <div className="empty-icon">
            📋
          </div>

          <h3>
            No applications yet
          </h3>

          <p>
            Prepare an opportunity first. It will appear here
            as READY_FOR_REVIEW.
          </p>

        </div>

      ) : (

        <div className="applications-list">

          {applications.map((application) => {

            const opportunity =
              getOpportunity(application);

            const isBusy =
              busyId === application.id;

            const canApprove =
              application.status === "READY_FOR_REVIEW";

            const canMarkApplied =
              application.status === "APPROVED";

            return (
              <article
                className="application-card"
                key={application.id}
              >

                <div className="application-card-top">

                  <div>

                    <span className="opportunity-type">
                      {application.status ||
                        "APPLICATION"}
                    </span>

                    <h3>
                      {opportunity?.title ||
                        "Prepared Application"}
                    </h3>

                    <p className="company">
                      {opportunity?.company ||
                        "Company not specified"}
                    </p>

                  </div>

                  <span
                    className={statusClass(
                      application.status
                    )}
                  >
                    {String(
                      application.status ||
                        "UNKNOWN"
                    ).replaceAll("_", " ")}
                  </span>

                </div>

                {application.deadline && (
                  <div className="application-detail">

                    <span>
                      Deadline
                    </span>

                    <strong>
                      {new Date(
                        application.deadline
                      ).toLocaleDateString()}
                    </strong>

                  </div>
                )}

                {application.proposal && (
                  <details className="proposal-preview">

                    <summary>
                      View AI proposal / application text
                    </summary>

                    <div>
                      {application.proposal}
                    </div>

                  </details>
                )}

                {application.notes && (
                  <details className="proposal-preview">

                    <summary>
                      View preparation details
                    </summary>

                    <div>
                      {application.notes}
                    </div>

                  </details>
                )}

                <div className="application-actions">

                  {opportunity?.url && (
                    <a
                      href={opportunity.url}
                      target="_blank"
                      rel="noreferrer"
                      className="secondary-button"
                    >
                      🔗 Open Job
                    </a>
                  )}

                  {canApprove && (
                    <button
                      className="primary-button"
                      disabled={isBusy}
                      onClick={() =>
                        updateApplication(
                          application.id,
                          "approve"
                        )
                      }
                    >
                      {isBusy
                        ? "Approving..."
                        : "✓ Approve"}
                    </button>
                  )}

                  {canMarkApplied && (
                    <button
                      className="primary-button"
                      disabled={isBusy}
                      onClick={() => {

                        const confirmed =
                          window.confirm(
                            "Have you manually submitted this application on the permitted job platform?"
                          );

                        if (confirmed) {
                          updateApplication(
                            application.id,
                            "apply"
                          );
                        }

                      }}
                    >
                      {isBusy
                        ? "Saving..."
                        : "☑ Mark Applied"}
                    </button>
                  )}

                </div>

                {canApprove && (
                  <div className="application-review-note">
                    Review the proposal carefully before
                    approving. Approval does not submit the
                    application automatically.
                  </div>
                )}

                {canMarkApplied && (
                  <div className="application-review-note approved-note">
                    Approved. Submit it manually through the job
                    platform, then use “Mark Applied”.
                  </div>
                )}

                {application.status === "

import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "";

const STATUS_LABELS = {
  QUEUED: "Queued",
  RUNNING: "Running",
  READY_FOR_REVIEW: "Ready for Review",
  APPROVED: "Approved",
  SUBMITTED: "Submitted",
  COMPLETED: "Completed",
  PAID: "Paid",
  FAILED: "Failed",
};

const STATUS_CLASS = {
  QUEUED: "queued",
  RUNNING: "running",
  READY_FOR_REVIEW: "review",
  APPROVED: "approved",
  SUBMITTED: "submitted",
  COMPLETED: "completed",
  PAID: "paid",
  FAILED: "failed",
};

const isValidHttpUrl = (value) => {
  if (!value || typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const getOfficialUrl = (task) => {
  const candidates = [
    task?.officialUrl,
    task?.official_url,
    task?.metadata?.officialUrl,
    task?.metadata?.official_url,
    task?.metadata?.officialLink,
    task?.metadata?.official_link,
    task?.submission?.officialUrl,
    task?.submission?.official_url,
    task?.opportunity?.officialUrl,
    task?.opportunity?.official_url,
    task?.opportunity?.url,
    task?.sourceUrl,
    task?.source_url,
  ];

  return candidates.find(isValidHttpUrl) || "";
};

const getExpectedPayment = (task) => {
  const payment =
    task?.payment ||
    task?.metadata?.payment ||
    task?.opportunity?.payment ||
    {};

  return {
    amount:
      payment.amount ??
      task?.paymentAmount ??
      task?.metadata?.paymentAmount ??
      "",
    currency:
      payment.currency ??
      task?.paymentCurrency ??
      task?.metadata?.paymentCurrency ??
      "",
    provider:
      payment.provider ??
      task?.paymentProvider ??
      task?.metadata?.paymentProvider ??
      "",
    method:
      payment.paymentMethod ??
      payment.payment_method ??
      task?.paymentMethod ??
      "",
    status: payment.status || "",
    paidAt: payment.paidAt || payment.paid_at || "",
  };
};

export default function TaskDashboard() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("opportunity");
  const [task, setTask] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  /*
   * Submission details.
   * These are entered by the user because OpportunityAI
   * does not submit externally on the user's behalf.
   */
  const [submissionReference, setSubmissionReference] =
    useState("");
  const [submissionNotes, setSubmissionNotes] =
    useState("");

  /*
   * Payment details.
   * Payment is recorded only after the user confirms
   * that the money was actually received.
   */
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentCurrency, setPaymentCurrency] =
    useState("");
  const [paymentProvider, setPaymentProvider] =
    useState("");
  const [paymentMethod, setPaymentMethod] =
    useState("");
  const [paymentReference, setPaymentReference] =
    useState("");
  const [paymentEvidence, setPaymentEvidence] =
    useState("");

  const request = async (url, options = {}) => {
    const response = await fetch(`${API_BASE}${url}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error ||
          data.message ||
          `Request failed (${response.status})`
      );
    }

    return data;
  };

  /*
   * Load tasks directly through the backend.
   * Backend reads the tasks from Supabase.
   */
  const loadTasks = async (selectedTaskId = null) => {
    setTasksLoading(true);
    setError("");

    try {
      const data = await request("/api/tasks");

      const loadedTasks = Array.isArray(data.tasks)
        ? data.tasks
        : [];

      setTasks(loadedTasks);

      if (loadedTasks.length > 0) {
        setTask((currentTask) => {
          const preferredId =
            selectedTaskId || currentTask?.id || null;

          if (preferredId) {
            const matchingTask = loadedTasks.find(
              (savedTask) =>
                savedTask.id === preferredId
            );

            if (matchingTask) {
              return matchingTask;
            }
          }

          return currentTask || loadedTasks[0];
        });
      } else {
        setTask((currentTask) =>
          currentTask?.id ? currentTask : null
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  /*
   * Keep payment fields synchronized with a task
   * when the user selects another task.
   */
  const syncPaymentFields = (selectedTask) => {
    const payment = getExpectedPayment(selectedTask);

    setPaymentAmount(
      payment.amount !== undefined &&
        payment.amount !== null
        ? String(payment.amount)
        : ""
    );

    setPaymentCurrency(payment.currency || "");
    setPaymentProvider(payment.provider || "");
    setPaymentMethod(payment.method || "");

    setPaymentReference(
      selectedTask?.payment?.providerReference ||
        selectedTask?.payment?.provider_reference ||
        ""
    );

    setPaymentEvidence(
      selectedTask?.payment?.evidence?.url ||
        selectedTask?.payment?.evidence ||
        ""
    );
  };

  const syncSubmissionFields = (selectedTask) => {
    setSubmissionReference(
      selectedTask?.submission?.reference || ""
    );

    setSubmissionNotes(
      selectedTask?.submission?.notes || ""
    );
  };

  const createTask = async () => {
    if (!title.trim() || !description.trim()) {
      setError(
        "Please enter both a task title and description."
      );
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const data = await request("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          type,
          source: "OpportunityAI",
          ownerId: null,
          context: {},
          userProfile: {
            skills: [
              "English",
              "Swahili",
              "Communication",
              "Translation",
              "AI",
              "Computer",
              "Internet",
            ],
          },
        }),
      });

      const createdTask = data.task || data;

      setTask(createdTask);
      syncPaymentFields(createdTask);
      syncSubmissionFields(createdTask);

      await loadTasks(createdTask?.id || null);

      setMessage("Task created successfully.");

      setTitle("");
      setDescription("");
      setType("opportunity");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectTask = async (selectedTask) => {
    if (!selectedTask?.id) return;

    setTask(selectedTask);
    syncPaymentFields(selectedTask);
    syncSubmissionFields(selectedTask);

    setError("");
    setMessage("");

    try {
      const data = await request(
        `/api/tasks/${selectedTask.id}`
      );

      const refreshedTask = data.task || data;

      setTask(refreshedTask);
      syncPaymentFields(refreshedTask);
      syncSubmissionFields(refreshedTask);

      setTasks((currentTasks) =>
        currentTasks.map((savedTask) =>
          savedTask.id === refreshedTask.id
            ? refreshedTask
            : savedTask
        )
      );
    } catch (err) {
      setTask(selectedTask);
      setError(err.message);
    }
  };

  const refreshTask = async () => {
    if (!task?.id) return;

    const selectedTaskId = task.id;

    setActionLoading("refresh");
    setError("");
    setMessage("");

    try {
      const data = await request(
        `/api/tasks/${selectedTaskId}`
      );

      const refreshedTask = data.task || data;

      setTask(refreshedTask);
      syncPaymentFields(refreshedTask);
      syncSubmissionFields(refreshedTask);

      await loadTasks(selectedTaskId);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  const runTask = async () => {
    if (!task?.id) return;

    const selectedTaskId = task.id;
    const officialUrl = getOfficialUrl(task);

    /*
     * A real opportunity should have an official source.
     * This does not block manually-created generic tasks
     * that do not claim to be external opportunities.
     */
    if (
      (task.type === "opportunity" ||
        task.type === "remote_job" ||
        task.type === "freelance") &&
      !officialUrl
    ) {
      setError(
        "This opportunity does not have a valid official website/link yet. Open or add the official source before running it."
      );
      return;
    }

    setActionLoading("run");
    setError("");
    setMessage("");

    try {
      const data = await request(
        `/api/tasks/${selectedTaskId}/run`,
        {
          method: "POST",
          body: JSON.stringify({
            officialUrl: officialUrl || null,
          }),
        }
      );

      const updatedTask = data.task || data;

      setTask(updatedTask);
      syncPaymentFields(updatedTask);
      syncSubmissionFields(updatedTask);

      await loadTasks(selectedTaskId);

      setMessage(
        "Task executed. Review the result before approving."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  const approveTask = async () => {
    if (!task?.id) return;

    const selectedTaskId = task.id;

    setActionLoading("approve");
    setError("");
    setMessage("");

    try {
      const data = await request(
        `/api/tasks/${selectedTaskId}/approve`,
        {
          method: "POST",
          body: JSON.stringify({
            approvedBy: "user",
            note: "Approved by task owner.",
          }),
        }
      );

      const updatedTask = data.task || data;

      setTask(updatedTask);
      syncPaymentFields(updatedTask);
      syncSubmissionFields(updatedTask);

      await loadTasks(selectedTaskId);

      setMessage("Task approved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  /*
   * REAL MANUAL SUBMISSION FLOW
   *
   * OpportunityAI does NOT submit the task externally.
   * The user opens the official website and submits it
   * themselves, then confirms what happened.
   */
  const submitTask = async () => {
    if (!task?.id) return;

    const officialUrl = getOfficialUrl(task);

    if (!officialUrl) {
      setError(
        "No valid official submission link is available for this task."
      );
      return;
    }

    const confirmed = window.confirm(
      "Open the official website, review the prepared material, and submit the task yourself. Have you personally completed the external submission?"
    );

    if (!confirmed) {
      return;
    }

    const selectedTaskId = task.id;

    setActionLoading("submit");
    setError("");
    setMessage("");

    try {
      const data = await request(
        `/api/tasks/${selectedTaskId}/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            submittedBy: "user",
            method: "manual",
            officialUrl,
            reference:
              submissionReference.trim() || null,
            notes:
              submissionNotes.trim() || null,
            confirmedByUser: true,
          }),
        }
      );

      const updatedTask = data.task || data;

      setTask(updatedTask);
      syncPaymentFields(updatedTask);
      syncSubmissionFields(updatedTask);

      await loadTasks(selectedTaskId);

      setMessage(
        "Submission confirmed and saved to your task history."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  /*
   * Completion remains user-confirmed.
   * AI does not falsely claim that an external platform
   * accepted or completed the work.
   */
  const completeTask = async () => {
    if (!task?.id) return;

    const confirmed = window.confirm(
      "Confirm that the external task/work has actually been completed or accepted."
    );

    if (!confirmed) {
      return;
    }

    const selectedTaskId = task.id;

    setActionLoading("complete");
    setError("");
    setMessage("");

    try {
      const data = await request(
        `/api/tasks/${selectedTaskId}/complete`,
        {
          method: "POST",
          body: JSON.stringify({
            completedBy: "user",
            confirmedByUser: true,
            result: "Task completion confirmed by the task owner.",
          }),
        }
      );

      const updatedTask = data.task || data;

      setTask(updatedTask);
      syncPaymentFields(updatedTask);
      syncSubmissionFields(updatedTask);

      await loadTasks(selectedTaskId);

      setMessage(
        "Task completion confirmed and saved."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  /*
   * REAL PAYMENT RECORDING
   *
   * Payment is never inferred from task completion.
   * User must provide actual payment information.
   */
  const markPaid = async () => {
    if (!task?.id) return;

    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setError(
        "Enter the actual amount you received."
      );
      return;
    }

    if (!paymentCurrency.trim()) {
      setError("Enter the payment currency.");
      return;
    }

    if (!paymentProvider.trim()) {
      setError("Enter the payment provider.");
      return;
    }

    if (!paymentMethod.trim()) {
      setError("Enter the payment method.");
      return;
    }

    if (!paymentEvidence.trim()) {
      setError(
        "Add payment evidence or a reference before recording payment."
      );
      return;
    }

    const confirmed = window.confirm(
      "Confirm that this payment was actually received and that the information you entered is accurate."
    );

    if (!confirmed) {
      return;
    }

    const selectedTaskId = task.id;

    setActionLoading("paid");
    setError("");
    setMessage("");

    try {
      const data = await request(
        `/api/tasks/${selectedTaskId}/paid`,
        {
          method: "POST",
          body: JSON.stringify({
            recordedBy: "user",
            status: "PAID",
            confirmedByUser: true,
            amount: Number(paymentAmount),
            currency: paymentCurrency.trim(),
            provider: paymentProvider.trim(),
            paymentMethod: paymentMethod.trim(),
            providerReference:
              paymentReference.trim() || null,
            evidence: {
              reference:
                paymentReference.trim() || null,
              details: paymentEvidence.trim(),
            },
            notes:
              "Payment confirmed by the task owner.",
          }),
        }
      );

      const updatedTask = data.task || data;

      setTask(updatedTask);
      syncPaymentFields(updatedTask);
      syncSubmissionFields(updatedTask);

      await loadTasks(selectedTaskId);

      setMessage(
        "Actual payment has been recorded in the task history."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  const resetTask = () => {
    setTask(null);
    setTitle("");
    setDescription("");
    setType("opportunity");

    setSubmissionReference("");
    setSubmissionNotes("");

    setPaymentAmount("");
    setPaymentCurrency("");
    setPaymentProvider("");
    setPaymentMethod("");
    setPaymentReference("");
    setPaymentEvidence("");

    setError("");
    setMessage("");
  };

  const automation = Number(
    task?.automationPercentage ?? 0
  );

  const status = task?.status || "QUEUED";

  const officialUrl = useMemo(
    () => getOfficialUrl(task),
    [task]
  );

  const expectedPayment = useMemo(
    () => getExpectedPayment(task),
    [task]
  );

  const completedSteps = Array.isArray(task?.steps)
    ? task.steps.filter(
        (step) => step.status === "COMPLETED"
      ).length
    : 0;

  return (
    <section className="task-dashboard">
      <div className="task-dashboard-header">
        <div>
          <div className="section-label">
            AI TASK ENGINE
          </div>

          <h2>Automate Your Opportunity</h2>

          <p>
            Create a task, let AI analyze and execute the
            automatable parts, then review and approve
            anything that requires your action.
          </p>
        </div>

        {task && (
          <button
            className="secondary-button"
            onClick={resetTask}
            disabled={loading || !!actionLoading}
          >
            New Task
          </button>
        )}
      </div>

      {!task && (
        <div className="task-create-card">
          <div className="section-label">
            CREATE TASK
          </div>

          <label>Task title</label>

          <input
            type="text"
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            placeholder="Example: Prepare a freelance proposal"
          />

          <label>Task description</label>

          <textarea
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            placeholder="Describe exactly what you want OpportunityAI to do..."
            rows={6}
          />

          <label>Task type</label>

          <select
            value={type}
            onChange={(event) =>
              setType(event.target.value)
            }
          >
            <option value="opportunity">
              Opportunity
            </option>

            <option value="remote_job">
              Remote Job
            </option>

            <option value="freelance">
              Freelance
            </option>

            <option value="customer">
              Customer
            </option>

            <option value="general">
              General
            </option>
          </select>

          <button
            className="primary-button task-create-button"
            onClick={createTask}
            disabled={loading}
          >
            {loading
              ? "Creating..."
              : "Create AI Task"}
          </button>
        </div>
      )}

      {tasksLoading && (
        <div className="task-loading-card">
          Loading tasks from Supabase...
        </div>
      )}

      {!tasksLoading && tasks.length > 0 && (
        <div className="task-list-card">
          <div className="section-label">
            SAVED TASKS
          </div>

          <h3>Your OpportunityAI Tasks</h3>

          <div className="task-list">
            {tasks.map((savedTask) => {
              const savedStatus =
                savedTask.status || "QUEUED";

              return (
                <button
                  key={savedTask.id}
                  type="button"
                  className={`task-list-item ${
                    task?.id === savedTask.id
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    selectTask(savedTask)
                  }
                >
                  <div>
                    <strong>
                      {savedTask.title}
                    </strong>

                    <small>
                      {savedTask.description}
                    </small>
                  </div>

                  <span
                    className={`task-status ${
                      STATUS_CLASS[savedStatus] || ""
                    }`}
                  >
                    {STATUS_LABELS[savedStatus] ||
                      savedStatus}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {message && (
        <div className="success-message">
          {message}
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Task error</strong>
          <div>{error}</div>
        </div>
      )}

      {task && (
        <>
          <div className="task-summary-card">
            <div>
              <div className="section-label">
                TASK
              </div>

              <h3>{task.title}</h3>

              <p>{task.description}</p>

              {officialUrl && (
                <div className="official-source">
                  <span>
                    Official source
                  </span>

                  <a
                    href={officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      setMessage(
                        "Official source opened. Review the opportunity carefully before continuing."
                      )
                    }
                  >
                    Open Official Website →
                  </a>
                </div>
              )}
            </div>

            <span
              className={`task-status ${
                STATUS_CLASS[status] || ""
              }`}
            >
              {STATUS_LABELS[status] || status}
            </span>
          </div>

          <div className="task-metrics">
            <div>
              <span>Automation</span>
              <strong>{automation}%</strong>
            </div>

            <div>
              <span>Steps</span>
              <strong>
                {Array.isArray(task.steps)
                  ? task.steps.length
                  : 0}
              </strong>
            </div>

            <div>
              <span>Completed</span>
              <strong>{completedSteps}</strong>
            </div>

            <div>
              <span>Review</span>
              <strong>
                {status === "READY_FOR_REVIEW"
                  ? "YES"
                  : "—"}
              </strong>
            </div>
          </div>

          <div className="task-progress-card">
            <div className="task-progress-heading">
              <strong>
                Automation progress
              </strong>

              <span>{automation}%</span>
            </div>

            <div className="task-progress">
              <div
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, automation)
                  )}%`,
                }}
              />
            </div>

            <small>
              Automation percentage describes how much
              of the task can technically be automated.
              It is not a task score or success guarantee.
            </small>
          </div>

          <div className="task-lifecycle">
            {[
              "QUEUED",
              "RUNNING",
              "READY_FOR_REVIEW",
              "APPROVED",
              "SUBMITTED",
              "COMPLETED",
              "PAID",
            ].map((step, index, array) => {
              const currentIndex =
                array.indexOf(status);

              const stepIndex = index;

              let className = "lifecycle-step";

              if (
                currentIndex >= 0 &&
                stepIndex < currentIndex
              ) {
                className += " done";
              }

              if (step === status) {
                className += " current";
              }

              return (
                <React.Fragment key={step}>
                  <div className={className}>
                    <span>
                      {stepIndex + 1}
                    </span>

                    <strong>
                      {STATUS_LABELS[step]}
                    </strong>
                  </div>

                  {index < array.length - 1 && (
                    <div className="lifecycle-arrow">
                      →
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {Array.isArray(task.steps) &&
            task.steps.length > 0 && (
              <div className="task-steps-card">
                <div className="section-label">
                  TASK PLAN
                </div>

                <h3>Execution Steps</h3>

                <div className="task-steps">
                  {task.steps.map(
                    (step, index) => (
                      <div
                        className="task-step"
                        key={
                          step.id ||
                          step.name ||
                          index
                        }
                      >
                        <div className="task-step-number">
                          {index + 1}
                        </div>

                        <div className="task-step-content">
                          <strong>
                            {step.title ||
                              step.name ||
                              step.action ||
                              `Step ${index + 1}`}
                          </strong>

                          {step.description && (
                            <p>
                              {step.description}
                            </p>
                          )}

                          <div className="task-step-meta">
                            <span>
                              Status:{" "}
                              {step.status ||
                                "PENDING"}
                            </span>

                            {step.automationPercentage !==
                              undefined && (
                              <span>
                                Automation:{" "}
                                {
                                  step.automationPercentage
                                }
                                %
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

          {task.qualityCheck && (
            <div className="quality-card">
              <div className="section-label">
                QUALITY CHECK
              </div>

              <h3>
                {task.qualityCheck.passed
                  ? "✓ Quality check passed"
                  : "⚠ Quality review required"}
              </h3>

              {task.qualityCheck.summary && (
                <p>
                  {task.qualityCheck.summary}
                </p>
              )}

              {Array.isArray(
                task.qualityCheck.issues
              ) &&
                task.qualityCheck.issues.length > 0 && (
                  <ul>
                    {task.qualityCheck.issues.map(
                      (issue, index) => (
                        <li key={index}>
                          {issue}
                        </li>
                      )
                    )}
                  </ul>
                )}
            </div>
          )}

          /*
           * OFFICIAL OPPORTUNITY SOURCE
           */
          {officialUrl && (
            <div className="official-source-card">
              <div>
                <div className="section-label">
                  OFFICIAL SOURCE
                </div>

                <h3>
                  Continue on the official platform
                </h3>

                <p>
                  OpportunityAI prepares and checks
                  your work, but does not impersonate
                  you or submit externally.
                </p>
              </div>

              <a
                className="primary-button"
                href={officialUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Official Website
              </a>
            </div>
          )}

          /*
           * MANUAL SUBMISSION DETAILS
           */
          {status === "APPROVED" && (
            <div className="submission-card">
              <div className="section-label">
                MANUAL SUBMISSION
              </div>

              <h3>
                Submit through the official platform
              </h3>

              <p>
                Open the official website, review the
                prepared output, and submit it yourself.
                OpportunityAI will only record your
                confirmation.
              </p>

              {officialUrl && (
                <a
                  className="secondary-button"
                  href={officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Official Submission Page
                </a>
              )}

              <label>
                Submission/reference ID
              </label>

              <input
                type="text"
                value={submissionReference}
                onChange={(event) =>
                  setSubmissionReference(
                    event.target.value
                  )
                }
                placeholder="Optional platform/application reference"
              />

              <label>
                Submission notes
              </label>

              <textarea
                value={submissionNotes}
                onChange={(event) =>
                  setSubmissionNotes(
                    event.target.value
                  )
                }
                placeholder="Optional notes about what you submitted"
                rows={4}
              />
            </div>
          )}

          /*
           * PAYMENT RECORD
           *
           * Only visible after completion.
           * It does not automatically mark anything as paid.
           */
          {status === "COMPLETED" && (
            <div className="payment-card">
              <div className="section-label">
                PAYMENT RECORD
              </div>

              <h3>Record actual payment</h3>

              <p>
                Payment is not inferred from completion.
                Enter the actual payment you received
                and provide a reference/evidence.
              </p>

              {expectedPayment.amount && (
                <div className="expected-payment">
                  Expected:
                  {" "}
                  <strong>
                    {expectedPayment.amount}{" "}
                    {expectedPayment.currency}
                  </strong>
                  {expectedPayment.provider
                    ? ` via ${expectedPayment.provider}`
                    : ""}
                </div>
              )}

              <div className="payment-grid">
                <div>
                  <label>
                    Amount received
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(event) =>
                      setPaymentAmount(
                        event.target.value
                      )
                    }
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label>
                    Currency
                  </label>

                  <input
                    type="text"
                    value={paymentCurrency}
                    onChange={(event) =>
                      setPaymentCurrency(
                        event.target.value
                      )
                    }
                    placeholder="USD / TZS / EUR"
                  />
                </div>

                <div>
                  <label>
                    Payment provider
                  </label>

                  <input
                    type="text"
                    value={paymentProvider}
                    onChange={(event) =>
                      setPaymentProvider(
                        event.target.value
                      )
                    }
                    placeholder="PayPal / Bank / Mobile Money"
                  />
                </div>

                <div>
                  <label>
                    Payment method
                  </label>

                  <input
                    type="text"
                    value={paymentMethod}
                    onChange={(event) =>
                      setPaymentMethod(
                        event.target.value
                      )
                    }
                    placeholder="Transfer / Wallet / Card"
                  />
                </div>
              </div>

              <label>
                Payment reference
              </label>

              <input
                type="text"
                value={paymentReference}
                onChange={(event) =>
                  setPaymentReference(
                    event.target.value
                  )
                }
                placeholder="Transaction/reference number"
              />

              <label>
                Payment evidence
              </label>

              <textarea
                value={paymentEvidence}
                onChange={(event) =>
                  setPaymentEvidence(
                    event.target.value
                  )
                }
                placeholder="Describe the evidence or provide a permitted reference/link"
                rows={4}
              />

              <button
                className="primary-button"
                onClick={markPaid}
                disabled={!!actionLoading}
              >
                {actionLoading === "paid"
                  ? "Saving Payment..."
                  : "Confirm Payment Received"}
              </button>
            </div>
          )}

          <div className="task-actions-card">
            <div className="section-label">
              ACTIONS
            </div>

            <div className="task-actions">
              <button
                className="secondary-button"
                onClick={refreshTask}
                disabled={!!actionLoading}
              >
                {actionLoading === "refresh"
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

              {status === "QUEUED" && (
                <button
                  className="primary-button"
                  onClick={runTask}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "run"
                    ? "Running..."
                    : "Run AI Task"}
                </button>
              )}

              {status === "READY_FOR_REVIEW" && (
                <button
                  className="primary-button"
                  onClick={approveTask}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "approve"
                    ? "Approving..."
                    : "Approve Task"}
                </button>
              )}

              {status === "APPROVED" && (
                <button
                  className="primary-button"
                  onClick={submitTask}
                  disabled={
                    !!actionLoading ||
                    !officialUrl
                  }
                  title={
                    !officialUrl
                      ? "A valid official URL is required."
                      : "Confirm your manual submission."
                  }
                >
                  {actionLoading === "submit"
                    ? "Saving Submission..."
                    : "Confirm Manual Submission"}
                </button>
              )}

              {status === "SUBMITTED" && (
                <button
                  className="primary-button"
                  onClick={completeTask}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "complete"
                    ? "Saving..."
                    : "Confirm Completion"}
                </button>
              )}
            </div>
          </div>

          {status === "READY_FOR_REVIEW" && (
            <div className="review-warning">
              <strong>
                Human review required
              </strong>

              <p>
                Review the AI-generated output before
                approving. External submissions,
                CAPTCHA-protected actions, authentication
                steps, and platform-restricted actions
                are not bypassed automatically.
              </p>
            </div>
          )}

          {status === "APPROVED" && (
            <div className="review-warning">
              <strong>
                Manual submission required
              </strong>

              <p>
                OpportunityAI will not submit applications
                or work on your behalf. Open the official
                platform, review the prepared material,
                submit it yourself, then confirm the
                submission above.
              </p>
            </div>
          )}

          {status === "COMPLETED" && (
            <div className="payment-warning">
              <strong>
                Payment has NOT been assumed.
              </strong>

              <p>
                Completion only means the work was
                confirmed complete. Record payment
                separately only after you actually
                receive it.
              </p>
            </div>
          )}
        </>
      )}

      <style>{`
        .task-dashboard {
          display: grid;
          gap: 20px;
        }

        .task-dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 5px;
        }

        .task-dashboard-header h2 {
          margin: 8px 0;
        }

        .task-dashboard-header p {
          max-width: 760px;
          color: #64748b;
          line-height: 1.7;
        }

        .task-create-card,
        .task-summary-card,
        .task-progress-card,
        .task-steps-card,
        .quality-card,
        .task-actions-card,
        .task-list-card,
        .task-loading-card,
        .official-source-card,
        .submission-card,
        .payment-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 24px;
        }

        .task-create-card {
          display: grid;
          gap: 10px;
        }

        .task-create-card label,
        .submission-card label,
        .payment-card label {
          margin-top: 8px;
          font-size: 13px;
          font-weight: 700;
          color: #334155;
        }

        .task-create-card input,
        .task-create-card textarea,
        .task-create-card select,
        .submission-card input,
        .submission-card textarea,
        .payment-card input,
        .payment-card textarea {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 12px 13px;
          background: white;
          color: #0f172a;
          font: inherit;
          outline: none;
        }

        .task-create-card textarea,
        .submission-card textarea,
        .payment-card textarea {
          resize: vertical;
        }

        .task-create-card input:focus,
        .task-create-card textarea:focus,
        .task-create-card select:focus,
        .submission-card input:focus,
        .submission-card textarea:focus,
        .payment-card input:focus,
        .payment-card textarea:focus {
          border-color: #64748b;
        }

        .task-create-button {
          margin-top: 12px;
          width: fit-content;
        }

        .task-loading-card {
          color: #64748b;
          line-height: 1.6;
        }

        .task-list-card h3 {
          margin: 8px 0 15px;
        }

        .task-list {
          display: grid;
          gap: 10px;
        }

        .task-list-item {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          text-align: left;
          padding: 15px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #f8fafc;
          cursor: pointer;
        }

        .task-list-item:hover,
        .task-list-item.selected {
          border-color: #94a3b8;
        }

        .task-list-item > div {
          min-width: 0;
        }

        .task-list-item strong,
        .task-list-item small {
          display: block;
        }

        .task-list-item strong {
          color: #0f172a;
        }

        .task-list-item small {
          margin-top: 4px;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .task-summary-card {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
        }

        .task-summary-card h3 {
          margin: 8px 0;
          font-size: 22px;
        }

        .task-summary-card p {
          margin: 0;
          color: #64748b;
          line-height: 1.6;
        }

        .task-status {
          display: inline-flex;
          padding: 8px 11px;
          border-radius: 9px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .task-status.queued {
          background: #f1f5f9;
          color: #475569;
        }

        .task-status.running {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .task-status.review {
          background: #fef3c7;
          color: #92400e;
        }

        .task-status.approved {
          background: #e0e7ff;
          color: #3730a3;
        }

        .task-status.submitted {
          background: #ede9fe;
          color: #6d28d9;
        }

        .task-status.completed,
        .task-status.paid {
          background: #dcfce7;
          color: #166534;
        }

        .task-status.failed {
          background: #fee2e2;
          color: #991b1b;
        }

        .task-metrics {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .task-metrics > div {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 18px;
        }

        .task-metrics span,
        .task-metrics strong {
          display: block;
        }

        .task-metrics span {
          color: #64748b;
          font-size: 12px;
        }

        .task-metrics strong {
          margin-top: 6px;
          font-size: 23px;
        }

        .task-progress-heading {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 10px;
        }

        .task-progress {
          height: 10px;
          border-radius: 99px;
          overflow: hidden;
          background: #e2e8f0;
        }

        .task-progress div {
          height: 100%;
          background: #0f172a;
          transition: width .3s ease;
        }

        .task-progress-card small {
          display: block;
          margin-top: 10px;
          color: #64748b;
          line-height: 1.5;
        }

        .task-lifecycle {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 20px;
        }

        .lifecycle-step {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #94a3b8;
          font-size: 11px;
        }

        .lifecycle-step span {
          width: 27px;
          height: 27px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #e2e8f0;
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
        }

        .lifecycle-step.done,
        .lifecycle-step.current {
          color: #0f172a;
        }

        .lifecycle-step.done span,
        .lifecycle-step.current span {
          background: #0f172a;
          color: white;
        }

        .lifecycle-arrow {
          color: #cbd5e1;
        }

        .task-steps {
          display: grid;
          gap: 10px;
          margin-top: 15px;
        }

        .task-step {
          display: flex;
          gap: 13px;
          padding: 15px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .task-step-number {
          min-width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #0f172a;
          color: white;
          font-size: 11px;
          font-weight: 800;
        }

        .task-step-content {
          min-width: 0;
        }

        .task-step-content p {
          margin: 5px 0;
          color: #64748b;
          line-height: 1.5;
        }

        .task-step-meta {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          color: #64748b;
          font-size: 11px;
        }

        .quality-card {
          background: #f8fafc;
        }

        .quality-card h3 {
          margin: 8px 0;
        }

        .quality-card p {
          color: #475569;
          line-height: 1.6;
        }

        .task-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .official-source {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 14px;
          padding: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 13px;
        }

        .official-source span {
          color: #64748b;
          font-weight: 700;
        }

        .official-source a {
          color: #0f172a;
          font-weight: 800;
          text-decoration: none;
        }

        .official-source-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          background: #f8fafc;
        }

        .official-source-card h3,
        .submission-card h3,
        .payment-card h3 {
          margin: 8px 0;
        }

        .official-source-card p,
        .submission-card p,
        .payment-card p {
          color: #64748b;
          line-height: 1.6;
          margin-bottom: 15px;
        }

        .official-source-card a,
        .submission-card > a {
          text-decoration: none;
        }

        .submission-card {
          display: grid;
          gap: 10px;
        }

        .payment-card {
          display: grid;
          gap: 10px;
        }

        .payment-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .expected-payment {
          padding: 12px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #475569;
        }

        .expected-payment strong {
          color: #0f172a;
        }

        .review-warning,
        .payment-warning {
          padding: 16px;
          border-radius: 12px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #92400e;
        }

        .review-warning p,
        .payment-warning p {
          margin: 7px 0 0;
          line-height: 1.6;
          font-size: 13px;
        }

        @media (max-width: 700px) {
          .task-dashboard-header,
          .task-summary-card,
          .official-source-card {
            flex-direction: column;
            align-items: stretch;
          }

          .task-metrics {
            grid-template-columns: repeat(2, 1fr);
          }

          .payment-grid {
            grid-template-columns: 1fr;
          }

          .task-lifecycle {
            align-items: flex-start;
          }

          .lifecycle-arrow {
            display: none;
          }

          .task-create-button {
            width: 100%;
          }

          .task-list-item {
            align-items: flex-start;
            flex-direction: column;
          }

          .official-source-card a {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>
    </section>
  );
}

import React, { useEffect, useState } from "react";

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
   *
   * selectedTaskId allows the Dashboard to keep the
   * currently selected task after refreshing the list.
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

      /*
       * Preserve the task that is currently selected.
       * If a selectedTaskId was explicitly supplied,
       * use that task after loading.
       */
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

          /*
           * If there is no valid current selection,
           * show the newest task.
           */
          return currentTask || loadedTasks[0];
        });
      } else {
        /*
         * Only clear the selection when there are
         * genuinely no tasks in Supabase.
         */
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

  /*
   * Load Supabase tasks when Dashboard opens.
   */
  useEffect(() => {
    loadTasks();
  }, []);

  const createTask = async () => {
    if (!title.trim() || !description.trim()) {
      setError("Please enter both a task title and description.");
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

      /*
       * Immediately select the newly created task.
       */
      setTask(createdTask);

      /*
       * Refresh the list from Supabase while explicitly
       * preserving/selecting the newly created task.
       */
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
    setError("");
    setMessage("");

    /*
     * If the selected task is only a list snapshot,
     * fetch the latest version from the backend.
     */
    try {
      const data = await request(
        `/api/tasks/${selectedTask.id}`
      );

      const refreshedTask = data.task || data;

      setTask(refreshedTask);

      /*
       * Update the list item with the latest task data
       * without losing the user's selection.
       */
      setTasks((currentTasks) =>
        currentTasks.map((savedTask) =>
          savedTask.id === refreshedTask.id
            ? refreshedTask
            : savedTask
        )
      );
    } catch (err) {
      /*
       * Keep the selected list task visible if the
       * individual refresh fails.
       */
      setTask(selectedTask);
      setError(err.message);
    }
  };

  const refreshTask = async () => {
    if (!task?.id) return;

    const selectedTaskId = task.id;

    setActionLoading("refresh");
    setError("");

    try {
      const data = await request(
        `/api/tasks/${selectedTaskId}`
      );

      const refreshedTask = data.task || data;

      setTask(refreshedTask);

      /*
       * Keep the Dashboard list synchronized with Supabase
       * while preserving the current selection.
       */
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

    setActionLoading("run");
    setError("");
    setMessage("");

    try {
      const data = await request(
        `/api/tasks/${selectedTaskId}/run`,
        {
          method: "POST",
        }
      );

      const updatedTask = data.task || data;

      setTask(updatedTask);

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

      await loadTasks(selectedTaskId);

      setMessage("Task approved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  const submitTask = async () => {
    if (!task?.id) return;

    const confirmed = window.confirm(
      "Have you personally reviewed this task and manually submitted it through the permitted external platform?"
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
            confirmedByUser: true,
            note: "Submitted through the permitted external platform.",
          }),
        }
      );

      const updatedTask = data.task || data;

      setTask(updatedTask);

      await loadTasks(selectedTaskId);

      setMessage("Task marked as submitted.");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  const completeTask = async () => {
    if (!task?.id) return;

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
            result: "Task completed.",
          }),
        }
      );

      const updatedTask = data.task || data;

      setTask(updatedTask);

      await loadTasks(selectedTaskId);

      setMessage("Task marked as completed.");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  const markPaid = async () => {
    if (!task?.id) return;

    const confirmed = window.confirm(
      "Confirm that you have actually received the payment for this task."
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
          }),
        }
      );

      const updatedTask = data.task || data;

      setTask(updatedTask);

      await loadTasks(selectedTaskId);

      setMessage("Payment recorded.");
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
    setError("");
    setMessage("");
  };

  const automation = Number(
    task?.automationPercentage ?? 0
  );

  const status = task?.status || "QUEUED";

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

          <label>
            Task title
          </label>

          <input
            type="text"
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            placeholder="Example: Prepare a freelance proposal"
          />

          <label>
            Task description
          </label>

          <textarea
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            placeholder="Describe exactly what you want OpportunityAI to do..."
            rows={6}
          />

          <label>
            Task type
          </label>

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

              <h3>
                {task.title}
              </h3>

              <p>
                {task.description}
              </p>
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
              <strong>
                {Array.isArray(task.steps)
                  ? task.steps.filter(
                      (step) =>
                        step.status === "COMPLETED"
                    ).length
                  : 0}
              </strong>
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

              <span>
                {automation}%
              </span>
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

              if (stepIndex < currentIndex) {
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

          <div className="task-actions-card">
            <div className="section-label">
              ACTIONS
            </div>

            <div className="task-actions">
              <button
                className="secondary-button"
                onClick={refreshTask}
                disabled={
                  !!actionLoading
                }
              >
                {actionLoading === "refresh"
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

              {status === "QUEUED" && (
                <button
                  className="primary-button"
                  onClick={runTask}
                  disabled={
                    !!actionLoading
                  }
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
                  disabled={
                    !!actionLoading
                  }
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
                    !!actionLoading
                  }
                >
                  {actionLoading === "submit"
                    ? "Submitting..."
                    : "Mark Submitted"}
                </button>
              )}

              {status === "SUBMITTED" && (
                <button
                  className="primary-button"
                  onClick={completeTask}
                  disabled={
                    !!actionLoading
                  }
                >
                  {actionLoading === "complete"
                    ? "Completing..."
                    : "Mark Completed"}
                </button>
              )}

              {status === "COMPLETED" && (
                <button
                  className="primary-button"
                  onClick={markPaid}
                  disabled={
                    !!actionLoading
                  }
                >
                  {actionLoading === "paid"
                    ? "Saving..."
                    : "Record Paid"}
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
        .task-loading-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 24px;
        }

        .task-create-card {
          display: grid;
          gap: 10px;
        }

        .task-create-card label {
          margin-top: 8px;
          font-size: 13px;
          font-weight: 700;
          color: #334155;
        }

        .task-create-card input,
        .task-create-card textarea,
        .task-create-card select {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 12px 13px;
          background: white;
          color: #0f172a;
          font: inherit;
          outline: none;
        }

        .task-create-card textarea {
          resize: vertical;
        }

        .task-create-card input:focus,
        .task-create-card textarea:focus,
        .task-create-card select:focus {
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

        .review-warning {
          padding: 16px;
          border-radius: 12px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #92400e;
        }

        .review-warning p {
          margin: 7px 0 0;
          line-height: 1.6;
          font-size: 13px;
        }

        @media (max-width: 700px) {
          .task-dashboard-header,
          .task-summary-card {
            flex-direction: column;
          }

          .task-metrics {
            grid-template-columns: repeat(2, 1fr);
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
        }
      `}</style>
    </section>
  );
}

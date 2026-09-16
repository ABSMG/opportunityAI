import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

/*
 * ============================================================
 * OpportunityAI - AI Task Engine
 * ============================================================
 *
 * Purpose:
 * - Convert a task into an executable plan
 * - Determine which steps AI can perform
 * - Execute safe/local AI actions
 * - Quality-check the result
 * - Calculate automation completion
 * - Keep human approval for actions that require it
 *
 * Task lifecycle:
 *
 * QUEUED
 *   ↓
 * RUNNING
 *   ↓
 * READY_FOR_REVIEW
 *   ↓
 * APPROVED
 *   ↓
 * SUBMITTED
 *   ↓
 * COMPLETED
 *   ↓
 * PAID
 *
 * IMPORTANT:
 * This engine does not bypass CAPTCHAs,
 * anti-bot systems, authentication controls,
 * or platform restrictions.
 * ============================================================
 */

// ============================================================
// CONSTANTS
// ============================================================

export const TASK_STATUS = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  READY_FOR_REVIEW: "READY_FOR_REVIEW",
  APPROVED: "APPROVED",
  SUBMITTED: "SUBMITTED",
  COMPLETED: "COMPLETED",
  PAID: "PAID",
  FAILED: "FAILED"
};

export const TASK_STEP_STATUS = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  BLOCKED: "BLOCKED",
  FAILED: "FAILED",
  NEEDS_REVIEW: "NEEDS_REVIEW"
};

export const AUTOMATION_LEVELS = {
  FULL: 100,
  HIGH: 85,
  PARTIAL: 60,
  LOW: 30,
  MANUAL: 0
};

// ============================================================
// AI CLIENT
// ============================================================

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({
    apiKey
  });
}

// ============================================================
// HELPERS
// ============================================================

function createId(prefix = "task") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function cleanText(value = "") {
  return String(value)
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(value, min, max) {
  return Math.min(
    Math.max(Number(value) || 0, min),
    max
  );
}

function normalizeStep(step = {}, index = 0) {
  return {
    id:
      step.id ||
      `step_${index + 1}`,

    order:
      Number(step.order) ||
      index + 1,

    title:
      cleanText(
        step.title ||
          `Task step ${index + 1}`
      ),

    description:
      cleanText(
        step.description ||
          ""
      ),

    action:
      cleanText(
        step.action ||
          "REVIEW"
      ),

    automation:
      clamp(
        step.automation,
        0,
        100
      ),

    requiresHuman:
      Boolean(
        step.requiresHuman
      ),

    status:
      TASK_STEP_STATUS.PENDING,

    output:
      null,

    error:
      null
  };
}

// ============================================================
// TASK CREATION
// ============================================================

export function createTask(data = {}) {
  const title =
    cleanText(data.title);

  const description =
    cleanText(data.description);

  if (!title) {
    throw new Error(
      "Task title is required."
    );
  }

  if (!description) {
    throw new Error(
      "Task description is required."
    );
  }

  return {
    id:
      data.id ||
      createId("task"),

    title,

    description,

    type:
      data.type ||
      "general",

    source:
      data.source ||
      "manual",

    ownerId:
      data.ownerId ||
      null,

    status:
      TASK_STATUS.QUEUED,

    automationPercentage:
      0,

    plan:
      [],

    steps:
      [],

    outputs:
      [],

    qualityCheck:
      null,

    createdAt:
      data.createdAt ||
      new Date().toISOString(),

    startedAt:
      null,

    approvedAt:
      null,

    submittedAt:
      null,

    completedAt:
      null,

    paidAt:
      null,

    approvedBy:
      null,

    submission:
      null,

    completion:
      null,

    payment:
      null,

    error:
      null,

    metadata:
      data.metadata || {}
  };
}

// ============================================================
// FALLBACK TASK PLAN
// ============================================================

function fallbackTaskPlan(task) {
  return {
    taskSummary:
      task.description,

    steps: [
      {
        title:
          "Understand task requirements",

        description:
          "Read and structure the supplied requirements.",

        action:
          "ANALYZE",

        automation:
          100,

        requiresHuman:
          false
      },

      {
        title:
          "Prepare task output",

        description:
          "Create the required output using the available information.",

        action:
          "GENERATE",

        automation:
          85,

        requiresHuman:
          false
      },

      {
        title:
          "Quality check",

        description:
          "Check the output against the task requirements.",

        action:
          "QUALITY_CHECK",

        automation:
          100,

        requiresHuman:
          false
      },

      {
        title:
          "Final review",

        description:
          "Review the final result before any external submission.",

        action:
          "REVIEW",

        automation:
          0,

        requiresHuman:
          true
      }
    ]
  };
}

// ============================================================
// AI TASK ANALYSIS
// ============================================================

export async function analyzeTask(
  task,
  context = {}
) {
  if (!task) {
    throw new Error(
      "Task is required."
    );
  }

  const ai = getAI();

  if (!ai) {
    return fallbackTaskPlan(task);
  }

  const prompt = `
You are the AI Task Planning Engine for OpportunityAI.

Your job is to break a task into practical execution steps.

TASK:
${JSON.stringify(task)}

CONTEXT:
${JSON.stringify(context)}

Return ONLY valid JSON:

{
  "taskSummary": "",
  "steps": [
    {
      "title": "",
      "description": "",
      "action": "",
      "automation": 0,
      "requiresHuman": false
    }
  ]
}

Rules:

1. Break the task into clear sequential steps.
2. automation must be between 0 and 100.
3. Do not use opportunity score as a task gate.
4. Automation percentage describes how much of the step can technically be automated.
5. Do not claim that an external website was accessed unless an approved integration actually accessed it.
6. Do not bypass CAPTCHA, anti-bot controls, authentication controls, paywalls, or platform restrictions.
7. Do not recommend spam.
8. Do not invent information.
9. If human approval is required, set requiresHuman=true.
10. Prefer official APIs and integrations when available.
11. Keep steps practical and executable.
12. Use REVIEW for actions that require human approval.
13. Use QUALITY_CHECK for automated verification.
`;

  try {
    const response =
      await ai.models.generateContent({
        model:
          "gemini-3.6-flash",

        contents:
          prompt,

        config: {
          responseMimeType:
            "application/json"
        }
      });

    const text =
      response.text ||
      response.candidates?.[0]
        ?.content?.parts?.[0]
        ?.text;

    if (!text) {
      throw new Error(
        "Empty AI task-plan response."
      );
    }

    const result =
      JSON.parse(text);

    const steps =
      Array.isArray(result.steps)
        ? result.steps.map(
            normalizeStep
          )
        : [];

    if (!steps.length) {
      throw new Error(
        "AI returned no task steps."
      );
    }

    return {
      taskSummary:
        cleanText(
          result.taskSummary ||
            task.description
        ),

      steps
    };
  } catch (error) {
    console.error(
      "AI task planning failed:",
      error.message
    );

    return fallbackTaskPlan(task);
  }
}

// ============================================================
// TASK PLANNING
// ============================================================

export async function planTask(
  task,
  context = {}
) {
  if (!task) {
    throw new Error(
      "Task is required."
    );
  }

  const plan =
    await analyzeTask(
      task,
      context
    );

  const steps =
    plan.steps.map(
      normalizeStep
    );

  return {
    ...task,

    plan: {
      taskSummary:
        plan.taskSummary,

      createdAt:
        new Date().toISOString(),

      totalSteps:
        steps.length
    },

    steps
  };
}

// ============================================================
// AUTOMATION CALCULATION
// ============================================================

export function calculateAutomation(
  steps = []
) {
  if (
    !Array.isArray(steps) ||
    !steps.length
  ) {
    return 0;
  }

  const total =
    steps.reduce(
      (sum, step) =>
        sum +
        clamp(
          step.automation,
          0,
          100
        ),
      0
    );

  return Math.round(
    total / steps.length
  );
}

// ============================================================
// EXECUTE ANALYZE STEP
// ============================================================

async function executeAnalyzeStep(
  task,
  step
) {
  return {
    type:
      "analysis",

    message:
      "Task requirements analyzed successfully.",

    taskTitle:
      task.title,

    taskDescription:
      task.description,

    step:
      step.title
  };
}

// ============================================================
// EXECUTE GENERATE STEP
// ============================================================

async function executeGenerateStep(
  task,
  step
) {
  const ai = getAI();

  /*
   * IMPORTANT:
   * Missing Gemini API key must NOT crash
   * the whole task.
   */
  if (!ai) {
    return {
      type:
        "generation",

      content:
        "",

      message:
        "AI generation is unavailable because GEMINI_API_KEY is not configured.",

      requiresReview:
        true,

      fallback:
        true
    };
  }

  const prompt = `
You are executing a task inside OpportunityAI.

TASK:
${JSON.stringify(task)}

STEP:
${JSON.stringify(step)}

Produce useful output for this step.

Rules:
- Use only supplied information.
- Do not invent facts.
- Do not claim an external action happened if it did not.
- Do not submit anything externally.
- Do not send spam.
- Do not bypass platform restrictions.
- Return a concise useful result.
`;

  /*
   * IMPORTANT:
   * Gemini errors are handled here.
   * They should not automatically make the
   * entire task FAILED.
   */
  try {
    const response =
      await ai.models.generateContent({
        model:
          "gemini-3.6-flash",

        contents:
          prompt
      });

    const content =
      response.text ||
      response.candidates?.[0]
        ?.content?.parts?.[0]
        ?.text ||
      "";

    /*
     * Empty AI response is treated as
     * review-required instead of task failure.
     */
    if (!content.trim()) {
      return {
        type:
          "generation",

        content:
          "",

        message:
          "AI returned an empty response. Manual review is required.",

        requiresReview:
          true,

        fallback:
          true
      };
    }

    return {
      type:
        "generation",

      content:
        content.trim(),

      requiresReview:
        true
    };

  } catch (error) {
    console.error(
      "AI generation step failed:",
      error.message
    );

    /*
     * Do not throw here.
     *
     * The task can continue to QUALITY_CHECK
     * and finally become READY_FOR_REVIEW.
     */
    return {
      type:
        "generation",

      content:
        "",

      message:
        "AI generation could not be completed automatically.",

      error:
        error.message,

      requiresReview:
        true,

      fallback:
        true
    };
  }
}

// ============================================================
// EXECUTE QUALITY CHECK STEP
// ============================================================

async function executeQualityCheckStep(
  task,
  outputs
) {
  const ai = getAI();

  if (!ai) {
    return {
      passed:
        false,

      issues: [
        "AI quality checking is unavailable because GEMINI_API_KEY is not configured."
      ],

      suggestions: [
        "Review the generated output manually."
      ],

      summary:
        "Automatic quality checking is unavailable.",

      requiresReview:
        true
    };
  }

  const prompt = `
Perform a quality check for this OpportunityAI task.

TASK:
${JSON.stringify(task)}

OUTPUTS:
${JSON.stringify(outputs)}

Return ONLY valid JSON:

{
  "passed": true,
  "issues": [],
  "suggestions": [],
  "summary": ""
}

Rules:
- Check factual consistency.
- Check whether requirements were addressed.
- Check whether outputs follow the supplied task.
- Do not invent missing information.
- If important information is missing, identify it as an issue.
`;

  try {
    const response =
      await ai.models.generateContent({
        model:
          "gemini-3.6-flash",

        contents:
          prompt,

        config: {
          responseMimeType:
            "application/json"
        }
      });

    const text =
      response.text ||
      response.candidates?.[0]
        ?.content?.parts?.[0]
        ?.text;

    if (!text) {
      throw new Error(
        "Empty quality-check response."
      );
    }

    const result =
      JSON.parse(text);

    return {
      passed:
        Boolean(result.passed),

      issues:
        Array.isArray(result.issues)
          ? result.issues
          : [],

      suggestions:
        Array.isArray(
          result.suggestions
        )
          ? result.suggestions
          : [],

      summary:
        cleanText(
          result.summary || ""
        ),

      requiresReview:
        !Boolean(result.passed)
    };

  } catch (error) {
    return {
      passed:
        false,

      issues: [
        error.message
      ],

      suggestions: [
        "Perform a manual quality review."
      ],

      summary:
        "Quality check could not be completed automatically.",

      requiresReview:
        true
    };
  }
}

// ============================================================
// EXECUTE SAFE AI STEPS
// ============================================================

export async function executeTask(
  task
) {
  if (!task) {
    throw new Error(
      "Task is required."
    );
  }

  if (
    task.status !==
      TASK_STATUS.QUEUED &&
    task.status !==
      TASK_STATUS.RUNNING
  ) {
    throw new Error(
      `Task cannot be executed from status ${task.status}.`
    );
  }

  const steps =
    Array.isArray(task.steps)
      ? task.steps.map(
          (step, index) => ({
            ...normalizeStep(
              step,
              index
            ),
            status:
              step.status ||
              TASK_STEP_STATUS.PENDING
          })
        )
      : [];

  if (!steps.length) {
    throw new Error(
      "Task has no execution steps. Run planTask before executeTask."
    );
  }

  const updatedTask = {
    ...task,

    status:
      TASK_STATUS.RUNNING,

    startedAt:
      task.startedAt ||
      new Date().toISOString(),

    error:
      null,

    steps
  };

  const outputs = [];

  /*
   * Execute steps sequentially.
   *
   * This is intentional:
   * later steps may depend on outputs
   * produced by earlier steps.
   */
  for (
    let index = 0;
    index < updatedTask.steps.length;
    index += 1
  ) {
    const step =
      updatedTask.steps[index];

    /*
     * Human-required steps are never
     * automatically executed.
     */
    if (
      step.requiresHuman ||
      step.automation === 0
    ) {
      step.status =
        TASK_STEP_STATUS.NEEDS_REVIEW;

      step.output = {
        type:
          "human_review",

        message:
          "This step requires human review or approval.",

        requiresReview:
          true
      };

      continue;
    }

    step.status =
      TASK_STEP_STATUS.RUNNING;

    try {
      let output;

      switch (
        String(
          step.action || ""
        ).toUpperCase()
      ) {
        case "ANALYZE":
          output =
            await executeAnalyzeStep(
              updatedTask,
              step
            );
          break;

        case "GENERATE":
          output =
            await executeGenerateStep(
              updatedTask,
              step
            );
          break;

        case "QUALITY_CHECK":
          output =
            await executeQualityCheckStep(
              updatedTask,
              outputs
            );
          break;

        case "REVIEW":
          output = {
            type:
              "human_review",

            message:
              "This step requires human review.",

            requiresReview:
              true
          };
          break;

        default:
          output = {
            type:
              "manual_or_external",

            message:
              "This action requires an approved integration or human review.",

            requiresReview:
              true
          };
      }

      step.output =
        output;

      /*
       * A step that explicitly requires
       * review must not be marked completed.
       */
      if (
        output?.requiresReview
      ) {
        step.status =
          TASK_STEP_STATUS.NEEDS_REVIEW;
      } else {
        step.status =
          TASK_STEP_STATUS.COMPLETED;
      }

      outputs.push({
        stepId:
          step.id,

        order:
          step.order,

        action:
          step.action,

        output
      });

    } catch (error) {
      /*
       * Unexpected execution errors still
       * fail the task. Expected AI generation
       * errors are handled inside the step.
       */
      step.status =
        TASK_STEP_STATUS.FAILED;

      step.error =
        error.message;

      updatedTask.status =
        TASK_STATUS.FAILED;

      updatedTask.error =
        error.message;

      updatedTask.outputs =
        outputs;

      updatedTask.automationPercentage =
        calculateAutomation(
          updatedTask.steps
        );

      return updatedTask;
    }
  }

  /*
   * Find the quality-check result.
   */
  const qualityOutput =
    outputs.find(
      (item) =>
        String(
          item.action || ""
        ).toUpperCase() ===
        "QUALITY_CHECK"
    );

  const qualityCheck =
    qualityOutput?.output ||
    null;

  updatedTask.outputs =
    outputs;

  updatedTask.qualityCheck =
    qualityCheck;

  updatedTask.automationPercentage =
    calculateAutomation(
      updatedTask.steps
    );

  /*
   * The task is ready for review after
   * automatic execution.
   *
   * This does not mean it was submitted
   * externally.
   */
  updatedTask.status =
    TASK_STATUS.READY_FOR_REVIEW;

  return updatedTask;
}

// ============================================================
// APPROVAL
// ============================================================

export function approveTask(
  task,
  approval = {}
) {
  if (!task) {
    throw new Error(
      "Task is required."
    );
  }

  if (
    task.status !==
    TASK_STATUS.READY_FOR_REVIEW
  ) {
    throw new Error(
      `Task cannot be approved from status ${task.status}.`
    );
  }

  return {
    ...task,

    status:
      TASK_STATUS.APPROVED,

    approvedAt:
      new Date().toISOString(),

    approvedBy:
      approval.approvedBy ||
      null
  };
}

// ============================================================
// SUBMISSION
// ============================================================

export function markTaskSubmitted(
  task,
  submission = {}
) {
  if (!task) {
    throw new Error(
      "Task is required."
    );
  }

  if (
    task.status !==
    TASK_STATUS.APPROVED
  ) {
    throw new Error(
      `Task cannot be submitted from status ${task.status}.`
    );
  }

  return {
    ...task,

    status:
      TASK_STATUS.SUBMITTED,

    submittedAt:
      new Date().toISOString(),

    submission:
      submission || null
  };
}

// ============================================================
// COMPLETION
// ============================================================

export function markTaskCompleted(
  task,
  result = {}
) {
  if (!task) {
    throw new Error(
      "Task is required."
    );
  }

  if (
    task.status !==
      TASK_STATUS.SUBMITTED &&
    task.status !==
      TASK_STATUS.APPROVED
  ) {
    throw new Error(
      `Task cannot be completed from status ${task.status}.`
    );
  }

  return {
    ...task,

    status:
      TASK_STATUS.COMPLETED,

    completedAt:
      new Date().toISOString(),

    completion:
      result || null
  };
}

// ============================================================
// PAYMENT
// ============================================================

export function markTaskPaid(
  task,
  payment = {}
) {
  if (!task) {
    throw new Error(
      "Task is required."
    );
  }

  if (
    task.status !==
    TASK_STATUS.COMPLETED
  ) {
    throw new Error(
      `Task cannot be marked as paid from status ${task.status}.`
    );
  }

  return {
    ...task,

    status:
      TASK_STATUS.PAID,

    paidAt:
      new Date().toISOString(),

    payment:
      payment || null
  };
}

// ============================================================
// STATUS SUMMARY
// ============================================================

export function getTaskStatus(
  task
) {
  if (!task) {
    throw new Error(
      "Task is required."
    );
  }

  const steps =
    Array.isArray(task.steps)
      ? task.steps
      : [];

  const completed =
    steps.filter(
      (step) =>
        step.status ===
        TASK_STEP_STATUS.COMPLETED
    ).length;

  const blocked =
    steps.filter(
      (step) =>
        step.status ===
          TASK_STEP_STATUS.BLOCKED ||
        step.status ===
          TASK_STEP_STATUS.NEEDS_REVIEW
    ).length;

  const failed =
    steps.filter(
      (step) =>
        step.status ===
        TASK_STEP_STATUS.FAILED
    ).length;

  return {
    id:
      task.id,

    status:
      task.status,

    title:
      task.title,

    totalSteps:
      steps.length,

    completedSteps:
      completed,

    blockedSteps:
      blocked,

    failedSteps:
      failed,

    automationPercentage:
      calculateAutomation(
        steps
      ),

    qualityCheck:
      task.qualityCheck,

    createdAt:
      task.createdAt,

    startedAt:
      task.startedAt,

    approvedAt:
      task.approvedAt ||
      null,

    submittedAt:
      task.submittedAt ||
      null,

    completedAt:
      task.completedAt,

    paidAt:
      task.paidAt,

    error:
      task.error ||
      null
  };
}

// ============================================================
// FULL TASK PIPELINE
// ============================================================

export async function runTaskEngine(
  taskInput,
  context = {}
) {
  let task =
    createTask(
      taskInput
    );

  task =
    await planTask(
      task,
      context
    );

  task =
    await executeTask(
      task
    );

  return task;
}

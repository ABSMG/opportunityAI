import "dotenv/config";

import { randomUUID } from "crypto";
import { prepareOpportunity } from "./src/services/preparationService.js";

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

import {
  collectOpportunities,
  defaultSources
} from "./src/services/opportunitySources.js";

import {
  analyzeOpportunities
} from "./src/services/aiOpportunityAnalyzer.js";

import {
  rankOpportunities
} from "./src/services/opportunityEngine.js";

// =====================================
// AI TASK ENGINE
// =====================================

import {
  createTask,
  planTask,
  executeTask,
  approveTask,
  markTaskSubmitted,
  markTaskCompleted,
  markTaskPaid,
  getTaskStatus
} from "./src/services/aiTaskEngine.js";

// =====================================
// SUPABASE AI TASK PERSISTENCE
// =====================================

import {
  persistTask,
  getTaskFromSupabase,
  listTasksFromSupabase,
  logTaskActivity,
  saveTaskSubmission,
  saveTaskPayment
} from "./src/services/aiTaskPersistence.js";

const app = express();

const PORT =
  process.env.PORT || 10000;

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

// =====================================
// MIDDLEWARE
// =====================================

app.use(cors());

app.use(
  express.json({
    limit: "1mb"
  })
);

// =====================================
// SUPABASE
// =====================================

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY;

const supabase =
  SUPABASE_URL &&
  SUPABASE_SECRET_KEY
    ? createClient(
        SUPABASE_URL,
        SUPABASE_SECRET_KEY
      )
    : null;

// =====================================
// RUNTIME CACHE
// =====================================

const taskStore =
  new Map();

// =====================================
// HELPERS
// =====================================

function isValidUuid(value) {
  if (
    typeof value !== "string"
  ) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function ensureTaskUuid(task) {
  if (!task) {
    return task;
  }

  if (
    isValidUuid(task.id)
  ) {
    return task;
  }

  return {
    ...task,
    id: randomUUID()
  };
}

function isOfficialHttpUrl(value) {
  try {
    const url =
      new URL(
        String(
          value || ""
        )
      );

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function normalizeOpportunityForDatabase(
  opportunity,
  userProfile = {}
) {
  return {
    owner_id:
      userProfile.ownerId ||
      null,

    type:
      opportunity.type ||
      "remote_job",

    title:
      opportunity.title ||
      "Untitled Opportunity",

    description:
      opportunity.description ||
      "",

    company:
      opportunity.company ||
      "",

    url:
      opportunity.url ||
      "",

    payment:
      opportunity.payment ??
      null,

    currency:
      opportunity.currency ||
      "",

    remote:
      opportunity.remote ??
      true,

    skills:
      opportunity.skills ||
      "",

    deadline:
      opportunity.deadline ||
      null,

    source:
      opportunity.source ||
      "approved_source",

    source_external_id:
      opportunity.id ||
      opportunity.source_external_id ||
      null,

    match_score:
      opportunity.aiAnalysis
        ?.fitScore ??
      opportunity.matchScore ??
      null,

    opportunity_score:
      opportunity.opportunityScore ??
      null,

    ai_analysis:
      opportunity.aiAnalysis ||
      opportunity.ai_analysis ||
      null,

    status:
      opportunity.status ||
      "NEW"
  };
}

// =====================================
// TASK SERIALIZER
// =====================================

function serializeTask(task) {
  if (!task) {
    return null;
  }

  const summary =
    getTaskStatus(task) || {};

  const metadata =
    task.metadata || {};

  return {
    ...task,

    ...summary,

    id:
      task.id ??
      summary.id,

    title:
      task.title ??
      summary.title,

    description:
      task.description ??
      summary.description,

    type:
      task.type ??
      summary.type,

    source:
      task.source ??
      summary.source,

    ownerId:
      task.ownerId ??
      summary.ownerId ??
      null,

    status:
      task.status ??
      summary.status,

    automationPercentage:
      task.automationPercentage ??
      summary.automationPercentage ??
      0,

    plan:
      Array.isArray(task.plan)
        ? task.plan
        : [],

    steps:
      Array.isArray(task.steps)
        ? task.steps
        : [],

    outputs:
      Array.isArray(task.outputs)
        ? task.outputs
        : [],

    qualityCheck:
      task.qualityCheck ??
      summary.qualityCheck ??
      null,

    metadata,

    officialUrl:
      task.officialUrl ||
      metadata.officialUrl ||
      metadata.official_url ||
      null,

    officialSite:
      task.officialSite ||
      metadata.officialSite ||
      metadata.platform ||
      null,

    opportunityId:
      task.opportunityId ||
      metadata.opportunityId ||
      null,

    createdAt:
      task.createdAt ??
      summary.createdAt ??
      null,

    startedAt:
      task.startedAt ??
      summary.startedAt ??
      null,

    approvedAt:
      task.approvedAt ??
      summary.approvedAt ??
      null,

    submittedAt:
      task.submittedAt ??
      summary.submittedAt ??
      null,

    completedAt:
      task.completedAt ??
      summary.completedAt ??
      null,

    paidAt:
      task.paidAt ??
      summary.paidAt ??
      null,

    approvedBy:
      task.approvedBy ??
      null,

    submission:
      task.submission ??
      null,

    completion:
      task.completion ??
      null,

    payment:
      task.payment ??
      null,

    error:
      task.error ??
      null
  };
}

function getTaskOfficialUrl(task) {
  return (
    task?.officialUrl ||
    task?.metadata?.officialUrl ||
    task?.metadata?.official_url ||
    task?.metadata?.opportunityUrl ||
    null
  );
}

function isExternalTask(task) {
  return (
    String(
      task?.source || ""
    ).toLowerCase() !==
    "internal"
  );
}

function requireUserConfirmation(
  body,
  message
) {
  if (
    body?.confirmedByUser !==
    true
  ) {
    const error =
      new Error(message);

    error.statusCode = 400;

    throw error;
  }
}

// =====================================
// LOAD OPPORTUNITY
// =====================================

async function loadOpportunityById(
  id
) {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured."
    );
  }

  if (
    isValidUuid(id)
  ) {
    const {
      data,
      error
    } = await supabase
      .from("opportunities")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  const {
    data,
    error
  } = await supabase
    .from("opportunities")
    .select("*")
    .eq(
      "source_external_id",
      id
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

// =====================================
// LOAD TASK
// =====================================

async function loadTask(id) {
  let task =
    null;

  if (
    supabase &&
    isValidUuid(id)
  ) {
    task =
      await getTaskFromSupabase(
        id
      );
  }

  if (!task) {
    task =
      taskStore.get(id);
  }

  return task;
}

// =====================================
// SAFE SUBMISSION PERSISTENCE
// =====================================

async function persistSubmissionSafely(
  task,
  submission
) {
  try {
    return await saveTaskSubmission(
      task,
      submission
    );
  } catch (error) {
    /*
     * PostgREST may temporarily have an
     * old schema cache.
     *
     * confirmed_by_user has a database
     * default, so retry without explicitly
     * sending that column.
     */

    if (
      !/confirmed_by_user/i.test(
        error?.message || ""
      )
    ) {
      throw error;
    }

    const fallback = {
      ...submission
    };

    delete fallback.confirmedByUser;
    delete fallback.confirmed_by_user;

    if (!supabase) {
      throw error;
    }

    const {
      data,
      error:
        fallbackError
    } = await supabase
      .from(
        "ai_task_submissions"
      )
      .insert({
        task_id:
          task.id,

        owner_id:
          task.ownerId ||
          null,

        official_url:
          fallback.officialUrl ||
          fallback.official_url ||
          null,

        method:
          fallback.method ||
          "manual",

        reference:
          fallback.reference ||
          null,

        notes:
          fallback.notes ||
          null,

        submitted_at:
          fallback.submittedAt ||
          new Date().toISOString()
      })
      .select()
      .single();

    if (fallbackError) {
      throw fallbackError;
    }

    return data;
  }
}

// =====================================
// SAFE PAYMENT PERSISTENCE
// =====================================

async function persistPaymentSafely(
  task,
  payment
) {
  try {
    return await saveTaskPayment(
      task,
      payment
    );
  } catch (error) {
    if (
      !/confirmed_by_user/i.test(
        error?.message || ""
      )
    ) {
      throw error;
    }

    const fallback = {
      ...payment
    };

    delete fallback.confirmedByUser;
    delete fallback.confirmed_by_user;

    if (!supabase) {
      throw error;
    }

    const {
      data,
      error:
        fallbackError
    } = await supabase
      .from(
        "ai_task_payments"
      )
      .insert({
        task_id:
          task.id,

        amount:
          fallback.amount,

        currency:
          fallback.currency,

        payment_method:
          fallback.paymentMethod ||
          fallback.payment_method ||
          null,

        provider:
          fallback.provider ||
          null,

        provider_reference:
          fallback.providerReference ||
          fallback.provider_reference ||
          null,

        status:
          "PAID",

        expected_at:
          fallback.expectedAt ||
          fallback.expected_at ||
          null,

        paid_at:
          fallback.paidAt ||
          fallback.paid_at ||
          new Date().toISOString(),

        evidence:
          fallback.evidence ||
          null,

        notes:
          fallback.notes ||
          null
      })
      .select()
      .single();

    if (fallbackError) {
      throw fallbackError;
    }

    return data;
  }
}

// =====================================
// HEALTH
// =====================================

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success: true,

      service:
        "OpportunityAI",

      status:
        "online",

      supabase:
        Boolean(supabase),

      ai:
        Boolean(
          process.env.GEMINI_API_KEY
        ),

      taskEngine:
        true,

      workflow:
        "real-opportunity-human-submission-verified-payment"
    });
  }
);

// =====================================
// API ROOT
// =====================================

app.get(
  "/api",
  (req, res) => {
    res.json({
      success: true,

      service:
        "OpportunityAI API",

      version:
        "2.0.0",

      capabilities: [
        "real-opportunity-discovery",
        "official-source-links",
        "ai-analysis",
        "opportunity-matching",
        "opportunity-ranking",
        "opportunity-preparation",
        "human-reviewed-submission",
        "submission-evidence",
        "completion-tracking",
        "verified-payment-tracking",
        "supabase-storage",
        "ai-task-planning",
        "ai-task-execution",
        "ai-task-quality-check"
      ]
    });
  }
);

// =====================================
// GET OPPORTUNITIES
// =====================================

app.get(
  "/api/opportunities",
  async (req, res) => {
    try {
      if (!supabase) {
        return res.status(503).json({
          success: false,
          message:
            "Supabase is not configured."
        });
      }

      const limit =
        Math.min(
          Number(
            req.query.limit
          ) || 100,
          100
        );

      const {
        data,
        error
      } = await supabase
        .from("opportunities")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(limit);

      if (error) {
        throw error;
      }

      return res.json({
        success: true,

        count:
          data?.length || 0,

        opportunities:
          (
            data || []
          ).filter(
            (item) =>
              isOfficialHttpUrl(
                item.url
              )
          )
      });
    } catch (error) {
      console.error(
        "Get opportunities error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

// =====================================
// CREATE OPPORTUNITY
// =====================================

app.post(
  "/api/opportunities",
  async (req, res) => {
    try {
      if (!supabase) {
        return res.status(503).json({
          success: false,
          message:
            "Supabase is not configured."
        });
      }

      const opportunity =
        req.body || {};

      if (
        !opportunity.title
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Opportunity title is required."
        });
      }

      if (
        !isOfficialHttpUrl(
          opportunity.url
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A real HTTP/HTTPS official opportunity URL is required. Demo or empty links are not accepted."
        });
      }

      const allowedFields =
        normalizeOpportunityForDatabase(
          opportunity,
          {
            ownerId:
              opportunity.owner_id ||
              opportunity.ownerId
          }
        );

      const {
        data,
        error
      } = await supabase
        .from("opportunities")
        .insert(
          allowedFields
        )
        .select()
        .single();

      if (error) {
        throw error;
      }

      return res.status(201).json({
        success: true,
        opportunity:
          data
      });
    } catch (error) {
      console.error(
        "Create opportunity error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

// =====================================
// OFFICIAL OPPORTUNITY LINK
// =====================================

app.get(
  "/api/opportunities/:id/official-link",
  async (req, res) => {
    try {
      const opportunity =
        await loadOpportunityById(
          req.params.id
        );

      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message:
            "Opportunity not found."
        });
      }

      if (
        !isOfficialHttpUrl(
          opportunity.url
        )
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This opportunity does not have a valid official URL and cannot be submitted."
        });
      }

      return res.json({
        success: true,

        opportunityId:
          opportunity.id,

        title:
          opportunity.title,

        source:
          opportunity.source,

        company:
          opportunity.company,

        officialUrl:
          opportunity.url
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

// =====================================
// OPPORTUNITY PREPARATION
// =====================================

app.post(
  "/api/opportunities/:id/prepare",
  async (req, res) => {
    try {
      if (!supabase) {
        return res.status(503).json({
          success: false,
          message:
            "Supabase is not configured."
        });
      }

      const opportunity =
        await loadOpportunityById(
          req.params.id
        );

      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message:
            "Opportunity not found."
        });
      }

      if (
        !isOfficialHttpUrl(
          opportunity.url
        )
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This opportunity has no valid official URL. It cannot enter the real submission workflow."
        });
      }

      const userProfile =
        req.body?.userProfile ||
        {};

      const preparation =
        await prepareOpportunity(
          opportunity,
          userProfile
        );

      let savedPreparation =
        null;

      if (
        opportunity.type ===
          "remote_job" ||
        opportunity.type ===
          "freelance"
      ) {
        const packageData =
          preparation.package ||
          {};

        const proposal =
          packageData.proposal ||
          "";

        const notes =
          JSON.stringify({
            preparation,

            preparedAt:
              new Date().toISOString()
          });

        const {
          data:
            existingApplication,
          error:
            existingError
        } = await supabase
          .from(
            "applications"
          )
          .select("*")
          .eq(
            "opportunity_id",
            opportunity.id
          )
          .order(
            "created_at",
            {
              ascending: false
            }
          )
          .limit(1)
          .maybeSingle();

        if (existingError) {
          throw existingError;
        }

        if (
          existingApplication
        ) {
          const {
            data,
            error
          } = await supabase
            .from(
              "applications"
            )
            .update({
              proposal,

              notes,

              deadline:
                opportunity.deadline ||
                null,

              status:
                "READY_FOR_REVIEW",

              updated_at:
                new Date().toISOString()
            })
            .eq(
              "id",
              existingApplication.id
            )
            .select()
            .single();

          if (error) {
            throw error;
          }

          savedPreparation =
            data;
        } else {
          const {
            data,
            error
          } = await supabase
            .from(
              "applications"
            )
            .insert({
              owner_id:
                userProfile.ownerId ||
                null,

              opportunity_id:
                opportunity.id,

              status:
                "READY_FOR_REVIEW",

              proposal,

              notes,

              deadline:
                opportunity.deadline ||
                null
            })
            .select()
            .single();

          if (error) {
            throw error;
          }

          savedPreparation =
            data;
        }
      }

      const {
        data:
          updatedOpportunity,
        error:
          opportunityError
      } = await supabase
        .from(
          "opportunities"
        )
        .update({
          status:
            "PREPARED",

          updated_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          opportunity.id
        )
        .select()
        .single();

      if (opportunityError) {
        throw opportunityError;
      }

      return res.json({
        success: true,

        message:
          "Opportunity prepared and ready for human review.",

        opportunity:
          updatedOpportunity,

        preparation,

        savedPreparation,

        officialUrl:
          opportunity.url,

        nextAction:
          "Open the official site, review the prepared work, and manually submit it there."
      });
    } catch (error) {
      console.error(
        "Prepare opportunity error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        message:
          "Opportunity preparation failed.",

        error:
          error.message
      });
    }
  }
);

// =====================================
// APPLICATIONS
// =====================================

app.get(
  "/api/applications",
  async (req, res) => {
    try {
      if (!supabase) {
        return res.status(503).json({
          success: false,
          message:
            "Supabase is not configured."
        });
      }

      const {
        data,
        error
      } = await supabase
        .from(
          "applications"
        )
        .select(`
          *,
          opportunities (
            id,
            type,
            title,
            description,
            company,
            url,
            payment,
            currency,
            deadline,
            source,
            status
          )
        `)
        .order(
          "created_at",
          {
            ascending: false
          }
        );

      if (error) {
        throw error;
      }

      return res.json({
        success: true,

        count:
          data?.length || 0,

        applications:
          data || []
      });
    } catch (error) {
      console.error(
        "Get applications error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

app.get(
  "/api/applications/:id",
  async (req, res) => {
    try {
      if (!supabase) {
        return res.status(503).json({
          success: false,
          message:
            "Supabase is not configured."
        });
      }

      if (
        !isValidUuid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid application ID."
        });
      }

      const {
        data,
        error
      } = await supabase
        .from(
          "applications"
        )
        .select(`
          *,
          opportunities (
            id,
            type,
            title,
            description,
            company,
            url,
            payment,
            currency,
            deadline,
            source,
            status
          )
        `)
        .eq(
          "id",
          req.params.id
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message:
            "Application not found."
        });
      }

      return res.json({
        success: true,
        application:
          data
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

// =====================================
// APPLICATION APPROVAL
// =====================================

app.post(
  "/api/applications/:id/approve",
  async (req, res) => {
    try {
      if (!supabase) {
        return res.status(503).json({
          success: false,
          message:
            "Supabase is not configured."
        });
      }

      if (
        !isValidUuid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid application ID."
        });
      }

      const {
        data:
          application,
        error:
          findError
      } = await supabase
        .from(
          "applications"
        )
        .select(`
          *,
          opportunities (
            id,
            title,
            company,
            url,
            status
          )
        `)
        .eq(
          "id",
          req.params.id
        )
        .maybeSingle();

      if (findError) {
        throw findError;
      }

      if (!application) {
        return res.status(404).json({
          success: false,
          message:
            "Application not found."
        });
      }

      if (
        application.status !==
        "READY_FOR_REVIEW"
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Only READY_FOR_REVIEW applications can be approved.",

          currentStatus:
            application.status
        });
      }

      if (
        !isOfficialHttpUrl(
          application.opportunities
            ?.url
        )
      ) {
        return res.status(409).json({
          success: false,
          message:
            "The application has no valid official submission URL."
        });
      }

      const {
        data:
          approvedApplication,
        error:
          updateError
      } = await supabase
        .from(
          "applications"
        )
        .update({
          status:
            "APPROVED",

          updated_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          req.params.id
        )
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return res.json({
        success: true,

        message:
          "Application approved for manual submission.",

        application:
          approvedApplication,

        officialUrl:
          application.opportunities.url,

        nextAction:
          "Open the official URL and submit manually."
      });
    } catch (error) {
      return res.status(409).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

// =====================================
// APPLICATION MANUAL SUBMISSION
// =====================================

app.post(
  "/api/applications/:id/apply",
  async (req, res) => {
    try {
      if (!supabase) {
        return res.status(503).json({
          success: false,
          message:
            "Supabase is not configured."
        });
      }

      if (
        !isValidUuid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid application ID."
        });
      }

      requireUserConfirmation(
        req.body,

        "The application can only be recorded as submitted after the user confirms that they manually submitted it on the official site."
      );

      const {
        data:
          application,
        error:
          findError
      } = await supabase
        .from(
          "applications"
        )
        .select(`
          *,
          opportunities (
            id,
            title,
            company,
            url,
            status
          )
        `)
        .eq(
          "id",
          req.params.id
        )
        .maybeSingle();

      if (findError) {
        throw findError;
      }

      if (!application) {
        return res.status(404).json({
          success: false,
          message:
            "Application not found."
        });
      }

      if (
        application.status !==
        "APPROVED"
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Application must be approved before manual submission.",

          currentStatus:
            application.status
        });
      }

      if (
        !isOfficialHttpUrl(
          application.opportunities
            ?.url
        )
      ) {
        return res.status(409).json({
          success: false,
          message:
            "No valid official submission URL exists."
        });
      }

      const now =
        new Date().toISOString();

      const {
        data:
          appliedApplication,
        error:
          updateError
      } = await supabase
        .from(
          "applications"
        )
        .update({
          status:
            "APPLIED",

          applied_at:
            req.body?.submittedAt ||
            now,

          updated_at:
            now
        })
        .eq(
          "id",
          req.params.id
        )
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      if (
        application.opportunity_id
      ) {
        const {
          error:
            opportunityError
        } = await supabase
          .from(
            "opportunities"
          )
          .update({
            status:
              "APPLIED",

            updated_at:
              now
          })
          .eq(
            "id",
            application.opportunity_id
          );

        if (opportunityError) {
          throw opportunityError;
        }
      }

      return res.json({
        success: true,

        message:
          "Manual submission recorded.",

        application:
          appliedApplication,

        officialUrl:
          application.opportunities.url,

        submissionReference:
          req.body?.reference ||
          null,

        nextAction:
          "Wait for the provider/platform response."
      });
    } catch (error) {
      return res.status(
        error.statusCode ||
          409
      ).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

// =====================================
// REAL OPPORTUNITY SCANNER
// =====================================

app.post(
  "/api/scanner/run",
  async (req, res) => {
    const startedAt =
      Date.now();

    let automationRunId =
      null;

    try {
      if (!supabase) {
        return res.status(503).json({
          success: false,
          message:
            "Supabase is not configured."
        });
      }

      const {
        userProfile = {},

        sources =
          defaultSources,

        save = true
      } =
        req.body || {};

      const {
        data:
          runData,
        error:
          runError
      } = await supabase
        .from(
          "automation_runs"
        )
        .insert({
          owner_id:
            userProfile.ownerId ||
            null,

          run_type:
            "OPPORTUNITY_SCAN",

          status:
            "STARTED",

          metadata: {
            sourceCount:
              Array.isArray(
                sources
              )
                ? sources.length
                : 0
          }
        })
        .select()
        .single();

      if (runError) {
        throw runError;
      }

      automationRunId =
        runData?.id ||
        null;

      const discovered =
        await collectOpportunities(
          Array.isArray(
            sources
          )
            ? sources
            : defaultSources
        );

      /*
       * REAL OPPORTUNITY RULE:
       * no HTTP/HTTPS URL = do not save,
       * rank or expose as a usable opportunity.
       */
      const realOpportunities =
        discovered.filter(
          (item) =>
            isOfficialHttpUrl(
              item.url
            )
        );

      const analyzed =
        await analyzeOpportunities(
          realOpportunities,
          userProfile
        );

      const ranked =
        rankOpportunities(
          analyzed,
          userProfile
        );

      let saved = [];

      if (
        save &&
        ranked.length
      ) {
        const rows =
          ranked
            .filter(
              (item) =>
                isOfficialHttpUrl(
                  item.url
                )
            )
            .map(
              (item) =>
                normalizeOpportunityForDatabase(
                  item,
                  userProfile
                )
            );

        if (rows.length) {
          const {
            data,
            error
          } = await supabase
            .from(
              "opportunities"
            )
            .insert(rows)
            .select();

          if (error) {
            throw error;
          }

          saved =
            data || [];
        }
      }

      if (
        automationRunId
      ) {
        await supabase
          .from(
            "automation_runs"
          )
          .update({
            status:
              "COMPLETED",

            items_found:
              realOpportunities.length,

            items_processed:
              ranked.length,

            metadata: {
              savedCount:
                saved.length,

              discardedWithoutOfficialUrl:
                discovered.length -
                realOpportunities.length,

              durationMs:
                Date.now() -
                startedAt
            },

            completed_at:
              new Date().toISOString()
          })
          .eq(
            "id",
            automationRunId
          );
      }

      return res.json({
        success: true,

        message:
          "Real opportunity scan completed.",

        discovered:
          discovered.length,

        validRealOpportunities:
          realOpportunities.length,

        analyzed:
          analyzed.length,

        ranked:
          ranked.length,

        saved:
          saved.length,

        opportunities:
          ranked.filter(
            (item) =>
              isOfficialHttpUrl(
                item.url
              )
          ),

        durationMs:
          Date.now() -
          startedAt
      });
    } catch (error) {
      console.error(
        "Scanner error:",
        error.message
      );

      if (
        supabase &&
        automationRunId
      ) {
        await supabase
          .from(
            "automation_runs"
          )
          .update({
            status:
              "FAILED",

            error_message:
              error.message ||
              "Unknown scanner error",

            completed_at:
              new Date().toISOString(),

            metadata: {
              durationMs:
                Date.now() -
                startedAt,

              failed:
                true
            }
          })
          .eq(
            "id",
            automationRunId
          );
      }

      return res.status(500).json({
        success: false,

        message:
          "Opportunity scanner failed.",

        error:
          error.message
      });
    }
  }
);

// =====================================
// SCANNER STATUS
// =====================================

app.get(
  "/api/scanner/status",
  async (req, res) => {
    try {
      if (!supabase) {
        return res.status(503).json({
          success: false,
          message:
            "Supabase is not configured."
        });
      }

      const {
        data,
        error
      } = await supabase
        .from(
          "automation_runs"
        )
        .select("*")
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(20);

      if (error) {
        throw error;
      }

      return res.json({
        success: true,
        runs:
          data || []
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

// =====================================
// GET ALL AI TASKS
// =====================================

app.get(
  "/api/tasks",
  async (req, res) => {
    try {
      if (!supabase) {
        return res.status(503).json({
          success: false,
          message:
            "Supabase is not configured."
        });
      }

      const ownerId =
        req.query.ownerId ||
        null;

      const tasks =
        await listTasksFromSupabase(
          ownerId
        );

      return res.json({
        success: true,

        count:
          tasks.length,

        tasks:
          tasks.map(
            serializeTask
          )
      });
    } catch (error) {
      console.error(
        "Get AI tasks error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        message:
          "Could not retrieve AI tasks.",

        error:
          error.message
      });
    }
  }
);

// =====================================
// CREATE REAL AI TASK
// =====================================

app.post(
  "/api/tasks",
  async (req, res) => {
    try {
      if (!supabase) {
        return res.status(503).json({
          success: false,
          message:
            "Supabase is not configured."
        });
      }

      const {
        title,

        description,

        requirements =
          [],

        context =
          {},

        userProfile =
          {},

        opportunityId =
          null,

        source =
          "external",

        type =
          "general",

        ownerId =
          null,

        metadata =
          {}
      } =
        req.body || {};

      if (
        !title &&
        !description
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Task title or description is required."
        });
      }

      let opportunity =
        null;

      if (
        opportunityId
      ) {
        opportunity =
          await loadOpportunityById(
            opportunityId
          );

        if (!opportunity) {
          return res.status(404).json({
            success: false,

            message:
              "Linked opportunity not found."
          });
        }
      }

      const officialUrl =
        metadata.officialUrl ||
        metadata.official_url ||
        opportunity?.url ||
        null;

      const external =
        String(
          source
        ).toLowerCase() !==
        "internal";

      if (
        external &&
        !isOfficialHttpUrl(
          officialUrl
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "External tasks must be linked to a real official HTTP/HTTPS opportunity URL."
        });
      }

      let task =
        createTask({
          title:
            title ||
            opportunity?.title ||
            "Untitled Task",

          description:
            description ||
            opportunity?.description ||
            "",

          type,

          source,

          ownerId,

          metadata: {
            ...metadata,

            requirements,

            context,

            userProfile,

            opportunityId:
              opportunity?.id ||
              opportunityId ||
              null,

            officialUrl,

            officialSite:
              opportunity?.source ||
              metadata.platform ||
              null,

            company:
              opportunity?.company ||
              metadata.company ||
              null,

            sourceExternalId:
              opportunity?.source_external_id ||
              null,

            paymentOffered:
              opportunity?.payment ??
              metadata.paymentOffered ??
              null,

            paymentCurrency:
              opportunity?.currency ||
              metadata.paymentCurrency ||
              null
          }
        });

      task =
        ensureTaskUuid(
          task
        );

      const savedTask =
        await persistTask(
          task
        );

      taskStore.set(
        task.id,
        savedTask ||
        task
      );

      await logTaskActivity(
        savedTask ||
        task,

        "TASK_CREATED",

        {
          source:
            task.source,

          type:
            task.type,

          officialUrl
        },

        null
      );

      return res.status(201).json({
        success: true,

        message:
          "Real AI task created successfully.",

        task:
          serializeTask(
            savedTask ||
            task
          )
      });
    } catch (error) {
      console.error(
        "Create AI task error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        message:
          "Could not create AI task.",

        error:
          error.message
      });
    }
  }
);

// =====================================
// GET TASK
// =====================================

app.get(
  "/api/tasks/:id",
  async (req, res) => {
    try {
      const task =
        await loadTask(
          req.params.id
        );

      if (!task) {
        return res.status(404).json({
          success: false,

          message:
            "Task not found."
        });
      }

      return res.json({
        success: true,

        task:
          serializeTask(
            task
          )
      });
    } catch (error) {
      return res.status(500).json({
        success: false,

        message:
          "Could not retrieve AI task.",

        error:
          error.message
      });
    }
  }
);

// =====================================
// TASK OFFICIAL LINK
// =====================================

app.get(
  "/api/tasks/:id/official-link",
  async (req, res) => {
    try {
      const task =
        await loadTask(
          req.params.id
        );

      if (!task) {
        return res.status(404).json({
          success: false,
          message:
            "Task not found."
        });
      }

      const officialUrl =
        getTaskOfficialUrl(
          task
        );

      if (
        !isOfficialHttpUrl(
          officialUrl
        )
      ) {
        return res.status(409).json({
          success: false,

          message:
            "No valid official URL is attached to this task."
        });
      }

      return res.json({
        success: true,

        taskId:
          task.id,

        title:
          task.title,

        source:
          task.source,

        officialUrl
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

// =====================================
// RUN TASK
// =====================================

app.post(
  "/api/tasks/:id/run",
  async (req, res) => {
    try {
      const id =
        req.params.id;

      let task =
        await loadTask(id);

      if (!task) {
        return res.status(404).json({
          success: false,
          message:
            "Task not found."
        });
      }

      if (
        task.status !==
        "QUEUED"
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Only QUEUED tasks can be started.",

          currentStatus:
            task.status
        });
      }

      if (
        isExternalTask(
          task
        ) &&
        !isOfficialHttpUrl(
          getTaskOfficialUrl(
            task
          )
        )
      ) {
        return res.status(409).json({
          success: false,

          message:
            "This external task has no real official URL. It cannot run as a real opportunity task."
        });
      }

      const planningContext =
        {
          ...(task.metadata ||
            {}),

          ...(req.body?.context ||
            {})
        };

      const plannedTask =
        await planTask(
          task,
          planningContext
        );

      const savedPlannedTask =
        await persistTask(
          plannedTask
        );

      taskStore.set(
        id,
        savedPlannedTask ||
        plannedTask
      );

      await logTaskActivity(
        savedPlannedTask ||
        plannedTask,

        "TASK_PLANNED",

        {
          context:
            planningContext
        },

        task.status
      );

      const executedTask =
        await executeTask(
          savedPlannedTask ||
          plannedTask
        );

      const savedExecutedTask =
        await persistTask(
          executedTask
        );

      taskStore.set(
        id,
        savedExecutedTask ||
        executedTask
      );

      await logTaskActivity(
        savedExecutedTask ||
        executedTask,

        "TASK_EXECUTED",

        {},

        savedPlannedTask?.status ||
        plannedTask.status
      );

      return res.json({
        success: true,

        message:
          "AI task planned and executed.",

        task:
          serializeTask(
            savedExecutedTask ||
            executedTask
          )
      });
    } catch (error) {
      console.error(
        "Run AI task error:",
        error.message
      );

      const task =
        await loadTask(
          req.params.id
        ).catch(
          () => null
        );

      if (task) {
        const failedTask = {
          ...task,

          status:
            "FAILED",

          error:
            error.message,

          updatedAt:
            new Date().toISOString()
        };

        taskStore.set(
          failedTask.id,
          failedTask
        );

        try {
          await persistTask(
            failedTask
          );

          await logTaskActivity(
            failedTask,

            "TASK_FAILED",

            {
              error:
                error.message
            },

            task.status
          );
        } catch (
          persistenceError
        ) {
          console.error(
            "Failed to persist failed task:",
            persistenceError.message
          );
        }
      }

      return res.status(500).json({
        success: false,

        message:
          "AI task execution failed.",

        error:
          error.message,

        task:
          task
            ? serializeTask(
                task
              )
            : null
      });
    }
  }
);

// =====================================
// APPROVE TASK
// =====================================

app.post(
  "/api/tasks/:id/approve",
  async (req, res) => {
    try {
      const task =
        await loadTask(
          req.params.id
        );

      if (!task) {
        return res.status(404).json({
          success: false,
          message:
            "Task not found."
        });
      }

      if (
        isExternalTask(
          task
        ) &&
        !isOfficialHttpUrl(
          getTaskOfficialUrl(
            task
          )
        )
      ) {
        return res.status(409).json({
          success: false,

          message:
            "External task cannot be approved without its official URL."
        });
      }

      const approvedTask =
        approveTask(
          task,
          req.body || {}
        );

      const savedTask =
        await persistTask(
          approvedTask
        );

      taskStore.set(
        task.id,
        savedTask ||
        approvedTask
      );

      await logTaskActivity(
        savedTask ||
        approvedTask,

        "TASK_APPROVED",

        req.body || {},

        task.status
      );

      return res.json({
        success: true,

        message:
          "AI task approved for human-controlled submission.",

        task:
          serializeTask(
            savedTask ||
            approvedTask
          ),

        officialUrl:
          getTaskOfficialUrl(
            savedTask ||
            approvedTask
          ),

        nextAction:
          "Open the official site and submit manually."
      });
    } catch (error) {
      return res.status(409).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

// =====================================
// MANUAL EXTERNAL SUBMISSION
// =====================================

app.post(
  "/api/tasks/:id/submit",
  async (req, res) => {
    try {
      const task =
        await loadTask(
          req.params.id
        );

      if (!task) {
        return res.status(404).json({
          success: false,
          message:
            "Task not found."
        });
      }

      if (
        task.status !==
        "APPROVED"
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Task must be approved before it can be recorded as submitted.",

          currentStatus:
            task.status
        });
      }

      const officialUrl =
        getTaskOfficialUrl(
          task
        );

      if (
        !isOfficialHttpUrl(
          officialUrl
        )
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Cannot record submission because the task has no valid official URL."
        });
      }

      requireUserConfirmation(
        req.body,

        "Submission can only be recorded after you manually submit the work on the official website."
      );

      const submittedAt =
        req.body?.submittedAt ||
        new Date().toISOString();

      const submission = {
        ...(req.body || {}),

        officialUrl,

        confirmedByUser:
          true,

        submittedAt
      };

      /*
       * Persist the submission FIRST.
       *
       * If persistence fails, the task
       * remains APPROVED and is not falsely
       * marked SUBMITTED.
       */

      await persistSubmissionSafely(
        task,
        submission
      );

      const submittedTask =
        markTaskSubmitted(
          task,
          submission
        );

      const savedTask =
        await persistTask(
          submittedTask
        );

      taskStore.set(
        task.id,
        savedTask ||
        submittedTask
      );

      await logTaskActivity(
        savedTask ||
        submittedTask,

        "TASK_SUBMITTED",

        submission,

        task.status
      );

      return res.json({
        success: true,

        message:
          "Manual external submission recorded.",

        task:
          serializeTask(
            savedTask ||
            submittedTask
          ),

        officialUrl,

        nextAction:
          "Wait for the provider/platform response."
      });
    } catch (error) {
      console.error(
        "Submit AI task error:",
        error.message
      );

      return res.status(
        error.statusCode ||
        409
      ).json({
        success: false,

        message:
          error.message
      });
    }
  }
);

// =====================================
// PROVIDER-CONFIRMED COMPLETION
// =====================================

app.post(
  "/api/tasks/:id/complete",
  async (req, res) => {
    try {
      const task =
        await loadTask(
          req.params.id
        );

      if (!task) {
        return res.status(404).json({
          success: false,
          message:
            "Task not found."
        });
      }

      if (
        task.status !==
        "SUBMITTED"
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Only submitted tasks can be completed.",

          currentStatus:
            task.status
        });
      }

      requireUserConfirmation(
        req.body,

        "Completion must be confirmed after the provider accepts or confirms the work."
      );

      const completedTask =
        markTaskCompleted(
          task,
          req.body || {}
        );

      const savedTask =
        await persistTask(
          completedTask
        );

      taskStore.set(
        task.id,
        savedTask ||
        completedTask
      );

      await logTaskActivity(
        savedTask ||
        completedTask,

        "TASK_COMPLETED",

        req.body || {},

        task.status
      );

      return res.json({
        success: true,

        message:
          "Provider-confirmed completion recorded.",

        task:
          serializeTask(
            savedTask ||
            completedTask
          ),

        nextAction:
          "Record payment only after the payment has actually been received."
      });
    } catch (error) {
      return res.status(
        error.statusCode ||
        409
      ).json({
        success: false,

import "dotenv/config";

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
// IN-MEMORY AI TASK STORE
// =====================================
//
// MVP storage for the AI Task Engine.
// This will later be moved to Supabase
// after the task database schema is added.
//

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
// API HEALTH
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
        true
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
        "1.0.0",

      capabilities: [
        "opportunity-discovery",
        "ai-analysis",
        "opportunity-matching",
        "opportunity-ranking",
        "opportunity-preparation",
        "application-review",
        "application-approval",
        "application-tracking",
        "supabase-storage",
        "automation-runs",

        "ai-task-planning",
        "ai-task-execution",
        "ai-task-quality-check",
        "ai-task-review",
        "ai-task-approval",
        "ai-task-submission-tracking",
        "ai-task-completion-tracking",
        "ai-task-payment-tracking"
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
          data || []
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
        req.body;

      if (
        !opportunity ||
        !opportunity.title
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Opportunity title is required."
        });
      }

      const allowedFields = {
        owner_id:
          opportunity.owner_id ||
          null,

        type:
          opportunity.type ||
          "remote_job",

        title:
          opportunity.title,

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
          "manual",

        source_external_id:
          opportunity.source_external_id ||
          null,

        match_score:
          opportunity.match_score ??
          null,

        opportunity_score:
          opportunity.opportunity_score ??
          null,

        ai_analysis:
          opportunity.ai_analysis ||
          null,

        status:
          opportunity.status ||
          "NEW"
      };

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

      const {
        id
      } = req.params;

      const {
        userProfile = {}
      } = req.body || {};

      let opportunity =
        null;

      let findError =
        null;

      if (
        isValidUuid(id)
      ) {
        const result =
          await supabase
            .from(
              "opportunities"
            )
            .select("*")
            .eq(
              "id",
              id
            )
            .maybeSingle();

        opportunity =
          result.data;

        findError =
          result.error;
      } else {
        const result =
          await supabase
            .from(
              "opportunities"
            )
            .select("*")
            .eq(
              "source_external_id",
              id
            )
            .maybeSingle();

        opportunity =
          result.data;

        findError =
          result.error;
      }

      if (findError) {
        throw findError;
      }

      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message:
            "Opportunity not found."
        });
      }

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
            data:
              updatedApplication,
            error:
              updateError
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

          if (updateError) {
            throw updateError;
          }

          savedPreparation =
            updatedApplication;

        } else {
          const {
            data:
              createdApplication,
            error:
              createError
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

          if (createError) {
            throw createError;
          }

          savedPreparation =
            createdApplication;
        }
      }

      if (
        opportunity.type ===
        "customer"
      ) {
        const packageData =
          preparation.package ||
          {};

        const outreach =
          packageData.outreach ||
          {};

        const message =
          outreach.message ||
          {};

        const {
          data:
            existingMessage,
          error:
            existingMessageError
        } = await supabase
          .from(
            "outreach_messages"
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

        if (
          existingMessageError
        ) {
          throw existingMessageError;
        }

        const outreachData = {
          owner_id:
            userProfile.ownerId ||
            null,

          opportunity_id:
            opportunity.id,

          channel:
            outreach.channel ||
            "manual",

          subject:
            message.subject ||
            "",

          body:
            message.body ||
            "",

          status:
            "READY_FOR_REVIEW",

          user_approved:
            false,

          platform_allows_automation:
            false
        };

        if (
          existingMessage
        ) {
          const {
            data:
              updatedMessage,
            error:
              updateMessageError
          } = await supabase
            .from(
              "outreach_messages"
            )
            .update(
              outreachData
            )
            .eq(
              "id",
              existingMessage.id
            )
            .select()
            .single();

          if (
            updateMessageError
          ) {
            throw updateMessageError;
          }

          savedPreparation =
            updatedMessage;

        } else {
          const {
            data:
              createdMessage,
            error:
              createMessageError
          } = await supabase
            .from(
              "outreach_messages"
            )
            .insert(
              outreachData
            )
            .select()
            .single();

          if (
            createMessageError
          ) {
            throw createMessageError;
          }

          savedPreparation =
            createdMessage;
        }
      }

      const {
        data:
          updatedOpportunity,
        error:
          opportunityUpdateError
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

      if (
        opportunityUpdateError
      ) {
        throw opportunityUpdateError;
      }

      return res.json({
        success: true,

        message:
          "Opportunity prepared successfully and is ready for review.",

        opportunity:
          updatedOpportunity,

        preparation,

        savedPreparation,

        nextAction:
          "Review the prepared application before approval."
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
// APPLICATIONS - REVIEW
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

// =====================================
// APPLICATION - GET ONE
// =====================================

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

      const {
        id
      } = req.params;

      if (
        !isValidUuid(id)
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
          id
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
      console.error(
        "Get application error:",
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
// APPLICATION - APPROVE
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

      const {
        id
      } = req.params;

      if (
        !isValidUuid(id)
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
        .select("*")
        .eq(
          "id",
          id
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
          id
        )
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return res.json({
        success: true,

        message:
          "Application approved successfully.",

        application:
          approvedApplication,

        nextAction:
          "Manually submit the application through the permitted platform, then mark it as APPLIED."
      });

    } catch (error) {
      console.error(
        "Approve application error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        message:
          "Application approval failed.",

        error:
          error.message
      });
    }
  }
);

// =====================================
// APPLICATION - MARK AS APPLIED
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

      const {
        id
      } = req.params;

      if (
        !isValidUuid(id)
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
          id
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
            "Application must be approved before it can be marked as applied.",

          currentStatus:
            application.status
        });
      }

      const {
        data:
          appliedApplication,
        error:
          updateApplicationError
      } = await supabase
        .from(
          "applications"
        )
        .update({
          status:
            "APPLIED",

          applied_at:
            new Date().toISOString(),

          updated_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          id
        )
        .select()
        .single();

      if (
        updateApplicationError
      ) {
        throw updateApplicationError;
      }

      let updatedOpportunity =
        null;

      if (
        application.opportunity_id
      ) {
        const {
          data:
            opportunityData,
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
              new Date().toISOString()
          })
          .eq(
            "id",
            application.opportunity_id
          )
          .select()
          .single();

        if (
          opportunityError
        ) {
          throw opportunityError;
        }

        updatedOpportunity =
          opportunityData;
      }

      return res.json({
        success: true,

        message:
          "Application marked as APPLIED.",

        application:
          appliedApplication,

        opportunity:
          updatedOpportunity,

        nextAction:
          "Application has been recorded. Continue tracking the application status."
      });

    } catch (error) {
      console.error(
        "Mark application applied error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        message:
          "Could not mark application as applied.",

        error:
          error.message
      });
    }
  }
);

// =====================================
// OPPORTUNITY SCANNER
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
        data: runData,
        error: runError
      } =
        await supabase
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

      if (runData) {
        automationRunId =
          runData.id;
      }

      console.log(
        "OpportunityAI scanner: starting discovery..."
      );

      const discovered =
        await collectOpportunities(
          Array.isArray(
            sources
          )
            ? sources
            : defaultSources
        );

      console.log(
        `OpportunityAI scanner: discovered ${discovered.length} opportunities.`
      );

      if (
        !discovered.length
      ) {
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
                0,

              items_processed:
                0,

              metadata: {
                message:
                  "Scanner completed. No opportunities were found.",

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
            "Scanner completed, but no opportunities were found.",

          discovered:
            0,

          analyzed:
            0,

          ranked:
            0,

          saved:
            0,

          opportunities:
            [],

          durationMs:
            Date.now() -
            startedAt
        });
      }

      console.log(
        `OpportunityAI scanner: analyzing ${discovered.length} opportunities...`
      );

      const analyzed =
        await analyzeOpportunities(
          discovered,
          userProfile
        );

      console.log(
        `OpportunityAI scanner: analyzed ${analyzed.length} opportunities.`
      );

      const ranked =
        rankOpportunities(
          analyzed,
          userProfile
        );

      console.log(
        `OpportunityAI scanner: ranked ${ranked.length} opportunities.`
      );

      let saved = [];

      if (
        save &&
        ranked.length
      ) {
        const rows =
          ranked.map(
            (opportunity) =>
              normalizeOpportunityForDatabase(
                opportunity,
                userProfile
              )
          );

        const {
          data: savedData,
          error: saveError
        } =
          await supabase
            .from(
              "opportunities"
            )
            .insert(
              rows
            )
            .select();

        if (saveError) {
          throw saveError;
        }

        saved =
          savedData ||
          [];

        console.log(
          `OpportunityAI scanner: saved ${saved.length} opportunities.`
        );
      }

      const savedByExternalId =
        new Map();

      for (
        const savedOpportunity
        of saved
      ) {
        if (
          savedOpportunity
            .source_external_id
        ) {
          savedByExternalId.set(
            String(
              savedOpportunity
                .source_external_id
            ),
            savedOpportunity
          );
        }
      }

      const opportunitiesWithDatabaseIds =
        ranked.map(
          (opportunity) => {
            const savedOpportunity =
              savedByExternalId.get(
                String(
                  opportunity.id ||
                    opportunity.source_external_id ||
                    ""
                )
              );

            if (
              savedOpportunity
            ) {
              return {
                ...opportunity,

                id:
                  savedOpportunity.id,

                databaseId:
                  savedOpportunity.id,

                source_external_id:
                  savedOpportunity
                    .source_external_id,

                status:
                  savedOpportunity.status
              };
            }

            return {
              ...opportunity,

              databaseId:
                null
            };
          }
        );

      if (
        automationRunId
      ) {
        const {
          error:
            completeError
        } =
          await supabase
            .from(
              "automation_runs"
            )
            .update({
              status:
                "COMPLETED",

              items_found:
                discovered.length,

              items_processed:
                ranked.length,

              metadata: {
                savedCount:
                  saved.length,

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

        if (
          completeError
        ) {
          console.error(
            "Failed to complete automation run:",
            completeError.message
          );
        }
      }

      return res.json({
        success: true,

        message:
          "Opportunity scan completed.",

        discovered:
          discovered.length,

        analyzed:
          analyzed.length,

        ranked:
          ranked.length,

        saved:
          saved.length,

        opportunities:
          opportunitiesWithDatabaseIds,

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
        try {
          const {
            error:
              updateError
          } =
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

          if (
            updateError
          ) {
            console.error(
              "Failed to update automation run:",
              updateError.message
            );
          }

        } catch (
          updateError
        ) {
          console.error(
            "Automation failure update error:",
            updateError.message
          );
        }
      }

      return res.status(500).json({
        success: false,

        message:
          "Opportunity scanner failed.",

        error:
          error.message ||
          "Unknown scanner error",

        durationMs:
          Date.now() -
          startedAt
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
      } =
        await supabase
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
      console.error(
        "Scanner status error:",
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
// AI TASK ENGINE
// =====================================

// -------------------------------------
// CREATE TASK
// -------------------------------------

app.post(
  "/api/tasks",
  async (req, res) => {
    try {
      const {
        title,
        description,
        requirements = [],
        context = {},
        userProfile = {},
        opportunityId = null,
        source = "manual",
        type = "general",
        ownerId = null,
        metadata = {}
      } = req.body || {};

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

      const task =
        createTask({
          title:
            title ||
            "Untitled Task",

          description:
            description ||
            "Task created without a description.",

          type,

          source,

          ownerId,

          metadata: {
            ...metadata,

            requirements,

            context,

            userProfile,

            opportunityId
          }
        });

      taskStore.set(
        task.id,
        task
      );

      return res.status(201).json({
        success: true,

        message:
          "AI task created successfully.",

        task
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

// -------------------------------------
// GET TASK
// -------------------------------------

app.get(
  "/api/tasks/:id",
  async (req, res) => {
    try {
      const {
        id
      } = req.params;

      const task =
        taskStore.get(id);

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
          getTaskStatus(task)
      });

    } catch (error) {
      console.error(
        "Get AI task error:",
        error.message
      );

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

// -------------------------------------
// RUN TASK
// -------------------------------------

app.post(
  "/api/tasks/:id/run",
  async (req, res) => {
    try {
      const {
        id
      } = req.params;

      const task =
        taskStore.get(id);

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

      console.log(
        `AI Task Engine: planning task ${id}...`
      );

      const planningContext =
        task.metadata || {};

      const plannedTask =
        await planTask(
          task,
          planningContext
        );

      taskStore.set(
        id,
        plannedTask
      );

      console.log(
        `AI Task Engine: executing task ${id}...`
      );

      const executedTask =
        await executeTask(
          plannedTask
        );

      taskStore.set(
        id,
        executedTask
      );

      return res.json({
        success: true,

        message:
          "AI task planned and executed.",

        task:
          getTaskStatus(
            executedTask
          )
      });

    } catch (error) {
      console.error(
        "Run AI task error:",
        error.message
      );

      const task =
        taskStore.get(
          req.params.id
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
      }

      return res.status(500).json({
        success: false,

        message:
          "AI task execution failed.",

        error:
          error.message
      });
    }
  }
);

// -------------------------------------
// APPROVE TASK
// -------------------------------------

app.post(
  "/api/tasks/:id/approve",
  async (req, res) => {
    try {
      const {
        id
      } = req.params;

      const task =
        taskStore.get(id);

      if (!task) {
        return res.status(404).json({
          success: false,

          message:
            "Task not found."
        });
      }

      const approvedTask =
        approveTask(
          task,
          req.body || {}
        );

      taskStore.set(
        id,
        approvedTask
      );

      return res.json({
        success: true,

        message:
          "AI task approved successfully.",

        task:
          getTaskStatus(
            approvedTask
          )
      });

    } catch (error) {
      console.error(
        "Approve AI task error:",
        error.message
      );

      return res.status(409).json({
        success: false,

        message:
          error.message
      });
    }
  }
);

// -------------------------------------
// MARK TASK AS SUBMITTED
// -------------------------------------

app.post(
  "/api/tasks/:id/submit",
  async (req, res) => {
    try {
      const {
        id
      } = req.params;

      const task =
        taskStore.get(id);

      if (!task) {
        return res.status(404).json({
          success: false,

          message:
            "Task not found."
        });
      }

      const submittedTask =
        markTaskSubmitted(
          task,
          req.body || {}
        );

      taskStore.set(
        id,
        submittedTask
      );

      return res.json({
        success: true,

        message:
          "Task marked as submitted.",

        task:
          getTaskStatus(
            submittedTask
          )
      });

    } catch (error) {
      console.error(
        "Submit AI task error:",
        error.message
      );

      return res.status(409).json({
        success: false,

        message:
          error.message
      });
    }
  }
);

// -------------------------------------
// MARK TASK AS COMPLETED
// -------------------------------------

app.post(
  "/api/tasks/:id/complete",
  async (req, res) => {
    try {
      const {
        id
      } = req.params;

      const task =
        taskStore.get(id);

      if (!task) {
        return res.status(404).json({
          success: false,

          message:
            "Task not found."
        });
      }

      const completedTask =
        markTaskCompleted(
          task,
          req.body || {}
        );

      taskStore.set(
        id,
        completedTask
      );

      return res.json({
        success: true,

        message:
          "Task marked as completed.",

        task:
          getTaskStatus(
            completedTask
          )
      });

    } catch (error) {
      console.error(
        "Complete AI task error:",
        error.message
      );

      return res.status(409).json({
        success: false,

        message:
          error.message
      });
    }
  }
);

// -------------------------------------
// MARK TASK AS PAID
// -------------------------------------

app.post(
  "/api/tasks/:id/paid",
  async (req, res) => {
    try {
      const {
        id
      } = req.params;

      const task =
        taskStore.get(id);

      if (!task) {
        return res.status(404).json({
          success: false,

          message:
            "Task not found."
        });
      }

      const paidTask =
        markTaskPaid(
          task,
          req.body || {}
        );

      taskStore.set(
        id,
        paidTask
      );

      return res.json({
        success: true,

        message:
          "Task marked as paid.",

        task:
          getTaskStatus(
            paidTask
          )
      });

    } catch (error) {
      console.error(
        "Mark AI task paid error:",
        error.message
      );

      return res.status(409).json({
        success: false,

        message:
          error.message
      });
    }
  }
);

// =====================================
// FRONTEND
// =====================================

const distPath =
  path.join(
    __dirname,
    "dist"
  );

app.use(
  express.static(
    distPath
  )
);

// =====================================
// SPA FALLBACK
// =====================================

app.get(
  "/{*splat}",
  (req, res, next) => {
    if (
      req.path.startsWith(
        "/api/"
      )
    ) {
      return next();
    }

    res.sendFile(
      path.join(
        distPath,
        "index.html"
      )
    );
  }
);

// =====================================
// 404
// =====================================

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,

      message:
        "Route not found."
    });
  }
);

// =====================================
// ERROR HANDLER
// =====================================

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(
      "Unhandled server error:",
      err
    );

    res.status(500).json({
      success: false,

      message:
        "Internal server error."
    });
  }
);

// =====================================
// START SERVER
// =====================================

app.listen(
  PORT,
  () => {
    console.log(
      `OpportunityAI running on port ${PORT}`
    );
  }
);

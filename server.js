import "dotenv/config";

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

const app = express();

const PORT = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const SUPABASE_URL = process.env.SUPABASE_URL;

const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_SECRET_KEY
    ? createClient(
        SUPABASE_URL,
        SUPABASE_SECRET_KEY
      )
    : null;

// =====================================
// API HEALTH
// =====================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "OpportunityAI",
    status: "online",
    supabase: Boolean(supabase),
    ai: Boolean(process.env.GEMINI_API_KEY)
  });
});

// =====================================
// API ROOT
// =====================================

app.get("/api", (req, res) => {
  res.json({
    success: true,
    service: "OpportunityAI API",
    version: "1.0.0",
    capabilities: [
      "opportunity-discovery",
      "ai-analysis",
      "opportunity-matching",
      "opportunity-ranking",
      "supabase-storage"
    ]
  });
});

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

      const limit = Math.min(
        Number(req.query.limit) || 100,
        100
      );

      const {
        data,
        error
      } = await supabase
        .from("opportunities")
        .select("*")
        .order("created_at", {
          ascending: false
        })
        .limit(limit);

      if (error) {
        throw error;
      }

      return res.json({
        success: true,
        count: data?.length || 0,
        opportunities: data || []
      });
    } catch (error) {
      console.error(
        "Get opportunities error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: error.message
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

      const opportunity = req.body;

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
          opportunity.owner_id || null,

        type:
          opportunity.type ||
          "remote_job",

        title:
          opportunity.title,

        description:
          opportunity.description || "",

        company:
          opportunity.company || "",

        url:
          opportunity.url || "",

        payment:
          opportunity.payment ?? null,

        currency:
          opportunity.currency || "",

        remote:
          opportunity.remote ?? true,

        skills:
          opportunity.skills || "",

        deadline:
          opportunity.deadline || null,

        source:
          opportunity.source || "manual",

        source_external_id:
          opportunity.source_external_id ||
          null,

        match_score:
          opportunity.match_score ?? null,

        opportunity_score:
          opportunity.opportunity_score ??
          null,

        ai_analysis:
          opportunity.ai_analysis || null,

        status:
          opportunity.status || "NEW"
      };

      const {
        data,
        error
      } = await supabase
        .from("opportunities")
        .insert(allowedFields)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return res.status(201).json({
        success: true,
        opportunity: data
      });
    } catch (error) {
      console.error(
        "Create opportunity error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: error.message
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
    const startedAt = Date.now();

    // IMPORTANT:
    // Keep this outside try so the catch block
    // can update the automation run.
    let automationRunId = null;

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
        sources = defaultSources,
        save = true
      } = req.body || {};

      // ---------------------------------
      // 1. START AUTOMATION RUN
      // ---------------------------------

      const {
        data: runData,
        error: runError
      } = await supabase
        .from("automation_runs")
        .insert({
          owner_id:
            userProfile.ownerId || null,

          run_type:
            "OPPORTUNITY_SCAN",

          status:
            "STARTED",

          metadata: {
            sourceCount:
              Array.isArray(sources)
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

      // ---------------------------------
      // 2. DISCOVER
      // ---------------------------------

      console.log(
        "OpportunityAI scanner: starting discovery..."
      );

      const discovered =
        await collectOpportunities(
          Array.isArray(sources)
            ? sources
            : defaultSources
        );

      console.log(
        `OpportunityAI scanner: discovered ${discovered.length} opportunities.`
      );

      // ---------------------------------
      // NO RESULTS
      // ---------------------------------

      if (!discovered.length) {
        if (automationRunId) {
          await supabase
            .from("automation_runs")
            .update({
              status: "COMPLETED",

              items_found: 0,

              items_processed: 0,

              metadata: {
                message:
                  "Scanner completed. No opportunities were found.",
                durationMs:
                  Date.now() - startedAt
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

          discovered: 0,

          analyzed: 0,

          ranked: 0,

          saved: 0,

          opportunities: [],

          durationMs:
            Date.now() - startedAt
        });
      }

      // ---------------------------------
      // 3. AI ANALYZE
      // ---------------------------------

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

      // ---------------------------------
      // 4. MATCH + RANK
      // ---------------------------------

      const ranked =
        rankOpportunities(
          analyzed,
          userProfile
        );

      console.log(
        `OpportunityAI scanner: ranked ${ranked.length} opportunities.`
      );

      // ---------------------------------
      // 5. SAVE TO SUPABASE
      // ---------------------------------

      let saved = [];

      if (
        save &&
        ranked.length
      ) {
        const rows =
          ranked.map(
            (opportunity) => ({
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
                null,

              status:
                "NEW"
            })
          );

        const {
          data: savedData,
          error: saveError
        } = await supabase
          .from("opportunities")
          .insert(rows)
          .select();

        if (saveError) {
          throw saveError;
        }

        saved =
          savedData || [];

        console.log(
          `OpportunityAI scanner: saved ${saved.length} opportunities.`
        );
      }

      // ---------------------------------
      // 6. COMPLETE AUTOMATION RUN
      // ---------------------------------

      if (automationRunId) {
        const {
          error: completeError
        } = await supabase
          .from("automation_runs")
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

        if (completeError) {
          console.error(
            "Failed to complete automation run:",
            completeError.message
          );
        }
      }

      // ---------------------------------
      // 7. RESPONSE
      // ---------------------------------

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
          ranked,

        durationMs:
          Date.now() - startedAt
      });
    } catch (error) {
      console.error(
        "Scanner error:",
        error.message
      );

      // ---------------------------------
      // MARK AUTOMATION RUN AS FAILED
      // ---------------------------------

      if (
        supabase &&
        automationRunId
      ) {
        try {
          const {
            error: updateError
          } = await supabase
            .from("automation_runs")
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

                failed: true
              }
            })
            .eq(
              "id",
              automationRunId
            );

          if (updateError) {
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
          Date.now() - startedAt
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
        .from("automation_runs")
        .select("*")
        .order("created_at", {
          ascending: false
        })
        .limit(20);

      if (error) {
        throw error;
      }

      return res.json({
        success: true,
        runs: data || []
      });
    } catch (error) {
      console.error(
        "Scanner status error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: error.message
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

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  SUPABASE_URL &&
  SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(
  express.json({
    limit: "1mb"
  })
);

/*
 * Health check
 */
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "OpportunityAI",
    status: "online",
    supabase:
      Boolean(supabase),
    ai:
      Boolean(
        process.env.GEMINI_API_KEY
      ),
    timestamp:
      new Date().toISOString()
  });
});

/*
 * API information
 */
app.get("/api", (req, res) => {
  res.json({
    success: true,
    name: "OpportunityAI API",
    version: "1.0.0",

    features: [
      "opportunity-discovery",
      "ai-analysis",
      "outreach-preparation",
      "application-tracking",
      "revenue-tracking",
      "supabase-storage"
    ]
  });
});

/*
 * Get opportunities
 */
app.get(
  "/api/opportunities",
  async (req, res) => {
    try {
      if (!supabase) {
        return res.status(503).json({
          success: false,
          error:
            "Supabase is not configured."
        });
      }

      const {
        type = "all",
        limit = "20"
      } = req.query;

      const allowedTypes = [
        "all",
        "remote_job",
        "freelance",
        "customer"
      ];

      if (
        !allowedTypes.includes(type)
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid opportunity type."
        });
      }

      const safeLimit = Math.min(
        Math.max(
          Number(limit) || 20,
          1
        ),
        50
      );

      let query = supabase
        .from("opportunities")
        .select("*")
        .order(
          "opportunity_score",
          {
            ascending: false,
            nullsFirst: false
          }
        )
        .limit(safeLimit);

      if (type !== "all") {
        query = query.eq(
          "type",
          type
        );
      }

      const {
        data,
        error
      } = await query;

      if (error) {
        console.error(
          "Supabase opportunity error:",
          error
        );

        return res.status(500).json({
          success: false,
          error:
            "Unable to load opportunities."
        });
      }

      return res.json({
        success: true,
        count: data?.length || 0,
        type,
        opportunities:
          data || []
      });
    } catch (error) {
      console.error(
        "Opportunity API error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to load opportunities."
      });
    }
  }
);

/*
 * Create an opportunity
 */
app.post(
  "/api/opportunities",
  async (req, res) => {
    try {
      if (!supabase) {
        return res.status(503).json({
          success: false,
          error:
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
          error:
            "Opportunity title is required."
        });
      }

      const allowedTypes = [
        "remote_job",
        "freelance",
        "customer"
      ];

      const type =
        opportunity.type ||
        "remote_job";

      if (
        !allowedTypes.includes(type)
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid opportunity type."
        });
      }

      const record = {
        owner_id:
          opportunity.owner_id ||
          null,

        type,

        title:
          opportunity.title,

        description:
          opportunity.description ||
          null,

        company:
          opportunity.company ||
          null,

        url:
          opportunity.url ||
          null,

        payment:
          opportunity.payment ??
          null,

        currency:
          opportunity.currency ||
          null,

        remote:
          opportunity.remote ??
          true,

        skills:
          opportunity.skills ||
          null,

        deadline:
          opportunity.deadline ||
          null,

        source:
          opportunity.source ||
          "unknown",

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
        .insert(record)
        .select()
        .single();

      if (error) {
        console.error(
          "Supabase insert error:",
          error
        );

        return res.status(500).json({
          success: false,
          error:
            "Unable to save opportunity."
        });
      }

      return res.status(201).json({
        success: true,
        opportunity: data
      });
    } catch (error) {
      console.error(
        "Create opportunity error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to create opportunity."
      });
    }
  }
);

/*
 * AI opportunity analysis
 */
app.post(
  "/api/ai/analyze",
  async (req, res) => {
    try {
      const {
        opportunity,
        userProfile
      } = req.body;

      if (!opportunity) {
        return res.status(400).json({
          success: false,
          error:
            "Opportunity is required."
        });
      }

      if (!userProfile) {
        return res.status(400).json({
          success: false,
          error:
            "User profile is required."
        });
      }

      const apiKey =
        process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(503).json({
          success: false,
          error:
            "AI service is not configured."
        });
      }

      const ai =
        new GoogleGenAI({
          apiKey
        });

      const prompt = `
Analyze this opportunity for the user.

Opportunity:
${JSON.stringify(
  opportunity,
  null,
  2
)}

User profile:
${JSON.stringify(
  userProfile,
  null,
  2
)}

Return ONLY valid JSON:

{
  "fitScore": 0,
  "earningPotential": "UNKNOWN",
  "priority": "LOW",
  "matchedSkills": [],
  "missingSkills": [],
  "risks": [],
  "recommendedAction": "",
  "reason": ""
}

Rules:
- Never guarantee income.
- Never invent payment.
- Never invent requirements.
- If payment is unknown, use UNKNOWN.
- Consider the user's actual skills.
- Do not recommend violating platform rules.
`;

      const response =
        await ai.models.generateContent({
          model:
            "gemini-2.5-flash",

          contents: prompt,

          config: {
            responseMimeType:
              "application/json"
          }
        });

      const text =
        response.text;

      let analysis;

      try {
        analysis =
          JSON.parse(text);
      } catch {
        analysis = {
          fitScore: 0,
          earningPotential:
            "UNKNOWN",
          priority: "LOW",
          matchedSkills: [],
          missingSkills: [],
          risks: [
            "Invalid AI response."
          ],
          recommendedAction:
            "REVIEW_MANUALLY",
          reason:
            "Manual review is required."
        };
      }

      return res.json({
        success: true,

        opportunityId:
          opportunity.id || null,

        analysis
      });
    } catch (error) {
      console.error(
        "AI analysis error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to analyze opportunity."
      });
    }
  }
);

/*
 * Prepare outreach
 */
app.post(
  "/api/outreach/prepare",
  async (req, res) => {
    try {
      const {
        customer,
        userProfile,
        channel,
        service
      } = req.body;

      if (!customer) {
        return res.status(400).json({
          success: false,
          error:
            "Customer is required."
        });
      }

      return res.json({
        success: true,

        status:
          "OUTREACH_READY",

        customerId:
          customer.id || null,

        channel:
          channel || "manual",

        service:
          service ||
          userProfile?.primaryService ||
          "digital services",

        message:
          "Outreach prepared for review."
      });
    } catch (error) {
      console.error(
        "Outreach error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to prepare outreach."
      });
    }
  }
);

/*
 * API 404
 */
app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      success: false,
      error:
        "API endpoint not found."
    });
  }
);

/*
 * Global error handler
 */
app.use(
  (error, req, res, next) => {
    console.error(
      "Server error:",
      error
    );

    res.status(500).json({
      success: false,
      error:
        "Internal server error."
    });
  }
);

app.listen(
  PORT,
  () => {
    console.log(
      `OpportunityAI API running on port ${PORT}`
    );
  }
);

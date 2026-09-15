import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT =
  process.env.PORT || 3000;

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

/**
 * Health check
 */
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "OpportunityAI",
    status: "online",
    timestamp:
      new Date().toISOString()
  });
});

/**
 * Basic API information
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
      "revenue-tracking"
    ]
  });
});

/**
 * Analyze an opportunity.
 *
 * AI integration will be connected here
 * after the backend environment variables
 * are configured.
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

      /*
       * Gemini integration will be added
       * on the server side.
       *
       * The API key must NEVER be sent
       * from the frontend.
       */

      return res.json({
        success: true,

        status:
          "AI_ANALYSIS_READY",

        opportunityId:
          opportunity.id || null,

        message:
          "Backend AI analysis endpoint is ready."
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

/**
 * Prepare outreach request.
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
          "Outreach preparation endpoint is ready for the next integration."
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

/**
 * Simple 404 handler for API routes.
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

/**
 * Global error handler.
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

app.listen(PORT, () => {
  console.log(
    `OpportunityAI API running on port ${PORT}`
  );
});

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// ===============================
// SUPABASE
// ===============================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_SECRET_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY)
    : null;

// ===============================
// API HEALTH
// ===============================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "OpportunityAI",
    status: "online",
    supabase: Boolean(supabase),
    ai: Boolean(process.env.GEMINI_API_KEY)
  });
});

// ===============================
// API ROOT
// ===============================

app.get("/api", (req, res) => {
  res.json({
    success: true,
    service: "OpportunityAI API"
  });
});

// ===============================
// OPPORTUNITIES
// ===============================

app.get("/api/opportunities", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: "Supabase is not configured."
      });
    }

    const { data, error } = await supabase
      .from("opportunities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      count: data?.length || 0,
      opportunities: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ===============================
// CREATE OPPORTUNITY
// ===============================

app.post("/api/opportunities", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: "Supabase is not configured."
      });
    }

    const opportunity = req.body;

    const { data, error } = await supabase
      .from("opportunities")
      .insert(opportunity)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      opportunity: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ===============================
// FRONTEND
// ===============================

const distPath = path.join(__dirname, "dist");

app.use(express.static(distPath));

app.get("/{*splat}", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile(path.join(distPath, "index.html"));
});

// ===============================
// 404
// ===============================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found."
  });
});

// ===============================
// ERROR HANDLER
// ===============================

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    success: false,
    message: "Internal server error."
  });
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
  console.log(`OpportunityAI running on port ${PORT}`);
});

import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({
    apiKey
  });
}

function fallbackAnalysis(opportunity, userProfile = {}) {
  const skills = Array.isArray(userProfile.skills)
    ? userProfile.skills.map((s) => String(s).toLowerCase())
    : [];

  const text = `
    ${opportunity.title || ""}
    ${opportunity.description || ""}
    ${opportunity.skills || ""}
  `.toLowerCase();

  const matchedSkills = skills.filter((skill) =>
    text.includes(skill)
  );

  const matchScore = skills.length
    ? Math.round((matchedSkills.length / skills.length) * 100)
    : 0;

  return {
    fitScore: matchScore,
    earningPotential: opportunity.payment
      ? "known"
      : "unknown",
    priority:
      matchScore >= 80
        ? "HIGH"
        : matchScore >= 60
        ? "MEDIUM"
        : "LOW",
    matchedSkills,
    missingSkills: [],
    risks: [
      "AI analysis unavailable; local matching rules were used."
    ],
    recommendedAction:
      matchScore >= 60
        ? "Review and prepare the opportunity."
        : "Skip unless additional information improves the match.",
    reason:
      "Match calculated from the available user skills and opportunity information."
  };
}

export async function analyzeOpportunity(
  opportunity,
  userProfile = {}
) {
  if (!opportunity) {
    throw new Error("Opportunity is required.");
  }

  const ai = getAI();

  if (!ai) {
    return fallbackAnalysis(
      opportunity,
      userProfile
    );
  }

  const prompt = `
You are the AI opportunity-analysis engine for OpportunityAI.

Analyze the opportunity objectively for the user.

USER PROFILE:
${JSON.stringify(userProfile)}

OPPORTUNITY:
${JSON.stringify(opportunity)}

Return ONLY valid JSON:

{
  "fitScore": 0,
  "earningPotential": "low|medium|high|unknown",
  "priority": "LOW|MEDIUM|HIGH",
  "matchedSkills": [],
  "missingSkills": [],
  "risks": [],
  "recommendedAction": "",
  "reason": ""
}

Rules:
- Never guarantee income.
- Never invent salary, payment or requirements.
- If payment is unknown, use "unknown".
- Do not recommend violating platform rules.
- Do not recommend spam.
- HIGH priority only when strongly relevant.
- Use only information contained in the user profile and opportunity.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text =
      response.text ||
      response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Empty AI response.");
    }

    const analysis = JSON.parse(text);

    return {
      fitScore: Number(analysis.fitScore) || 0,
      earningPotential:
        analysis.earningPotential || "unknown",
      priority:
        analysis.priority || "LOW",
      matchedSkills:
        Array.isArray(analysis.matchedSkills)
          ? analysis.matchedSkills
          : [],
      missingSkills:
        Array.isArray(analysis.missingSkills)
          ? analysis.missingSkills
          : [],
      risks:
        Array.isArray(analysis.risks)
          ? analysis.risks
          : [],
      recommendedAction:
        analysis.recommendedAction || "Review opportunity.",
      reason:
        analysis.reason || ""
    };
  } catch (error) {
    console.error(
      "AI opportunity analysis failed:",
      error.message
    );

    return fallbackAnalysis(
      opportunity,
      userProfile
    );
  }
}

export async function analyzeOpportunities(
  opportunities = [],
  userProfile = {}
) {
  const results = [];

  for (const opportunity of opportunities) {
    const analysis = await analyzeOpportunity(
      opportunity,
      userProfile
    );

    results.push({
      ...opportunity,
      aiAnalysis: analysis
    });
  }

  return results.sort(
    (a, b) =>
      (b.aiAnalysis?.fitScore || 0) -
      (a.aiAnalysis?.fitScore || 0)
  );
}

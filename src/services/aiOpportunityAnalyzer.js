import { GoogleGenAI } from "@google/genai";

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    })
  : null;

function fallbackAnalysis(opportunity, userProfile) {
  const skills = (userProfile.skills || []).map((s) =>
    s.toLowerCase()
  );

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
    earningPotential: opportunity.payment ? "known" : "unknown",
    priority:
      matchScore >= 80
        ? "HIGH"
        : matchScore >= 60
        ? "MEDIUM"
        : "LOW",
    matchedSkills,
    risks: [
      "AI analysis unavailable; using local matching rules."
    ],
    recommendedAction:
      matchScore >= 60
        ? "Review and prepare application."
        : "Skip unless additional information improves the match."
  };
}

export async function analyzeOpportunity(
  opportunity,
  userProfile
) {
  if (!opportunity) {
    throw new Error("Opportunity is required.");
  }

  if (!ai) {
    return fallbackAnalysis(
      opportunity,
      userProfile
    );
  }

  const prompt = `
You are the opportunity-analysis engine for an
income-focused opportunity platform.

Analyze this opportunity objectively.

USER PROFILE:
${JSON.stringify(userProfile)}

OPPORTUNITY:
${JSON.stringify(opportunity)}

Return ONLY valid JSON with this structure:

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
- If payment is unknown, say unknown.
- Do not recommend violating platform rules.
- Give HIGH priority only when the opportunity is strongly relevant.
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

    return JSON.parse(text);
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
  opportunities,
  userProfile
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

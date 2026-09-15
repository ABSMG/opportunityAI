const OPPORTUNITY_TYPES = {
  REMOTE_JOB: "remote_job",
  FREELANCE: "freelance",
  CUSTOMER: "customer"
};

const MIN_SCORE = 60;

/**
 * Normalize text so the matching engine can compare
 * opportunities and user skills consistently.
 */
function normalizeText(value = "") {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculate how closely an opportunity matches
 * the user's declared skills.
 */
export function calculateMatchScore(opportunity, userProfile) {
  const text = normalizeText(
    `${opportunity.title || ""} ${opportunity.description || ""} ${
      opportunity.skills || ""
    }`
  );

  const skills = (userProfile.skills || [])
    .map(normalizeText)
    .filter(Boolean);

  if (!skills.length) return 0;

  let matches = 0;

  for (const skill of skills) {
    if (text.includes(skill)) {
      matches++;
    }
  }

  return Math.round((matches / skills.length) * 100);
}

/**
 * Estimate whether an opportunity is worth reviewing.
 * This is a prioritization score, NOT a guarantee of income.
 */
export function calculateOpportunityScore(opportunity, userProfile) {
  const matchScore = calculateMatchScore(opportunity, userProfile);

  let score = matchScore;

  if (opportunity.payment) {
    score += 10;
  }

  if (opportunity.remote === true) {
    score += 5;
  }

  if (opportunity.deadline) {
    score += 5;
  }

  return Math.min(score, 100);
}

/**
 * Filter and rank opportunities.
 */
export function rankOpportunities(opportunities, userProfile) {
  return opportunities
    .map((opportunity) => ({
      ...opportunity,
      matchScore: calculateMatchScore(opportunity, userProfile),
      opportunityScore: calculateOpportunityScore(
        opportunity,
        userProfile
      )
    }))
    .filter(
      (opportunity) =>
        opportunity.opportunityScore >= MIN_SCORE
    )
    .sort(
      (a, b) =>
        b.opportunityScore - a.opportunityScore
    );
}

/**
 * Create a structured opportunity record.
 */
export function createOpportunity(data) {
  return {
    id:
      data.id ||
      `opp_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    type: data.type || OPPORTUNITY_TYPES.REMOTE_JOB,

    title: data.title || "Untitled Opportunity",

    description: data.description || "",

    company: data.company || "",

    url: data.url || "",

    payment: data.payment || null,

    currency: data.currency || "",

    remote: data.remote ?? true,

    skills: data.skills || "",

    deadline: data.deadline || null,

    source: data.source || "unknown",

    discoveredAt:
      data.discoveredAt || new Date().toISOString()
  };
}

/**
 * Decide what the AI should do next.
 */
export function getRecommendedAction(opportunity) {
  if (opportunity.opportunityScore >= 85) {
    return "HIGH_PRIORITY_REVIEW";
  }

  if (opportunity.opportunityScore >= 70) {
    return "REVIEW_AND_PREPARE";
  }

  return "LOW_PRIORITY";
}

export {
  OPPORTUNITY_TYPES,
  MIN_SCORE
};

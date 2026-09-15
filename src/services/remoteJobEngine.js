import {
  collectOpportunities,
  defaultSources
} from "./opportunitySources.js";

import {
  analyzeOpportunities
} from "./aiOpportunityAnalyzer.js";

import {
  OPPORTUNITY_TYPES
} from "./opportunityEngine.js";

/**
 * Collect remote-job opportunities from configured,
 * permitted sources and analyze them with AI.
 */
export async function discoverRemoteJobs(
  userProfile,
  sources = defaultSources
) {
  const remoteSources = sources.filter(
    (source) =>
      source.type === OPPORTUNITY_TYPES.REMOTE_JOB
  );

  if (!remoteSources.length) {
    return {
      success: true,
      opportunities: [],
      message:
        "No approved remote-job sources configured yet."
    };
  }

  const opportunities =
    await collectOpportunities(remoteSources);

  const analyzed =
    await analyzeOpportunities(
      opportunities,
      userProfile
    );

  return {
    success: true,
    count: analyzed.length,
    opportunities: analyzed
  };
}

/**
 * Select only strong opportunities that deserve
 * the user's attention.
 */
export function getHighPriorityRemoteJobs(
  opportunities
) {
  return opportunities.filter(
    (opportunity) =>
      opportunity.type ===
        OPPORTUNITY_TYPES.REMOTE_JOB &&
      opportunity.aiAnalysis?.priority === "HIGH"
  );
}

/**
 * Create an application-preparation package.
 *
 * This does NOT automatically submit applications.
 * It prepares information for user review.
 */
export function prepareRemoteJobApplication(
  opportunity,
  userProfile
) {
  if (!opportunity) {
    throw new Error("Opportunity is required.");
  }

  return {
    opportunityId: opportunity.id,

    jobTitle: opportunity.title,

    company: opportunity.company,

    jobUrl: opportunity.url,

    candidateProfile: {
      name: userProfile.name || "",
      skills: userProfile.skills || [],
      experience: userProfile.experience || "",
      education: userProfile.education || ""
    },

    applicationStatus: "READY_FOR_REVIEW",

    nextAction:
      "Review the application package before submitting."
  };
}

/**
 * Rank remote jobs according to AI fit score.
 */
export function rankRemoteJobs(
  opportunities
) {
  return [...opportunities].sort(
    (a, b) =>
      (b.aiAnalysis?.fitScore || 0) -
      (a.aiAnalysis?.fitScore || 0)
  );
}

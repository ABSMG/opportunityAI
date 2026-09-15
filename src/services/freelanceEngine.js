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
 * Discover freelance opportunities from
 * configured and permitted sources.
 */
export async function discoverFreelanceGigs(
  userProfile,
  sources = defaultSources
) {
  const freelanceSources = sources.filter(
    (source) =>
      source.type === OPPORTUNITY_TYPES.FREELANCE
  );

  if (!freelanceSources.length) {
    return {
      success: true,
      opportunities: [],
      message:
        "No approved freelance sources configured yet."
    };
  }

  const opportunities =
    await collectOpportunities(
      freelanceSources
    );

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
 * Return freelance gigs with strong AI relevance.
 */
export function getHighPriorityFreelanceGigs(
  opportunities
) {
  return opportunities.filter(
    (opportunity) =>
      opportunity.type ===
        OPPORTUNITY_TYPES.FREELANCE &&
      opportunity.aiAnalysis?.priority === "HIGH"
  );
}

/**
 * Prepare a freelance proposal package.
 *
 * This prepares the proposal for review rather than
 * automatically submitting it on a platform.
 */
export function prepareFreelanceProposal(
  opportunity,
  userProfile
) {
  if (!opportunity) {
    throw new Error("Opportunity is required.");
  }

  return {
    opportunityId: opportunity.id,

    projectTitle: opportunity.title,

    client:
      opportunity.company || "Potential Client",

    projectUrl: opportunity.url,

    budget: opportunity.payment,

    currency: opportunity.currency,

    freelancer: {
      name: userProfile.name || "",

      skills:
        userProfile.skills || [],

      experience:
        userProfile.experience || "",

      portfolio:
        userProfile.portfolio || ""
    },

    proposalStatus:
      "READY_FOR_REVIEW",

    nextAction:
      "Review proposal before submitting."
  };
}

/**
 * Rank freelance opportunities by AI fit.
 */
export function rankFreelanceGigs(
  opportunities
) {
  return [...opportunities].sort(
    (a, b) =>
      (b.aiAnalysis?.fitScore || 0) -
      (a.aiAnalysis?.fitScore || 0)
  );
}

import {
  OPPORTUNITY_TYPES
} from "./opportunityEngine.js";

/**
 * Generate a personalized freelance proposal.
 */
export function generateProposal(
  opportunity,
  userProfile
) {
  if (!opportunity) {
    throw new Error("Opportunity is required.");
  }

  const clientName =
    opportunity.company ||
    "the client";

  const userName =
    userProfile.name ||
    "I";

  const skills =
    userProfile.skills || [];

  const skillText =
    skills.length
      ? skills.join(", ")
      : "the required skills";

  const service =
    userProfile.primaryService ||
    "the requested service";

  return {
    opportunityId:
      opportunity.id,

    type:
      opportunity.type ||
      OPPORTUNITY_TYPES.FREELANCE,

    subject:
      `Proposal for ${opportunity.title}`,

    proposal:
`Hi ${clientName},

I’m ${userName}, and I’m interested in helping with "${opportunity.title}".

My relevant skills include ${skillText}.

Based on the requirements, I believe I can help deliver ${service} in a clear and reliable way.

I would first review the project requirements carefully, confirm the expected deliverables, and then work according to the agreed scope and timeline.

I’d be happy to discuss the project further.

Best regards,
${userName}`,

    status:
      "READY_FOR_REVIEW",

    createdAt:
      new Date().toISOString(),

    nextAction:
      "Review the proposal and submit it through the permitted platform."
  };
}

/**
 * Generate proposals for multiple opportunities.
 */
export function generateProposals(
  opportunities,
  userProfile
) {
  if (!Array.isArray(opportunities)) {
    return [];
  }

  return opportunities.map(
    (opportunity) =>
      generateProposal(
        opportunity,
        userProfile
      )
  );
}

/**
 * Improve a proposal with additional project context.
 */
export function enhanceProposal(
  proposal,
  additionalContext = ""
) {
  if (!proposal) {
    throw new Error("Proposal is required.");
  }

  if (!additionalContext.trim()) {
    return proposal;
  }

  return {
    ...proposal,

    proposal:
      `${proposal.proposal}

Additional project context:
${additionalContext.trim()}`,

    updatedAt:
      new Date().toISOString()
  };
}

/**
 * Validate a proposal before review.
 */
export function validateProposal(
  proposal
) {
  const errors = [];

  if (!proposal?.opportunityId) {
    errors.push(
      "Opportunity ID is missing."
    );
  }

  if (!proposal?.proposal?.trim()) {
    errors.push(
      "Proposal content is empty."
    );
  }

  if (!proposal?.status) {
    errors.push(
      "Proposal status is missing."
    );
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

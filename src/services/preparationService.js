import {
  generateProposal,
  validateProposal
} from "./proposalGenerator.js";

import {
  prepareRemoteJobApplication
} from "./remoteJobEngine.js";

import {
  prepareFreelanceProposal
} from "./freelanceEngine.js";

import {
  prepareCustomerOutreach
} from "./customerFinder.js";

/**
 * Build a review-ready preparation package.
 *
 * Never submits applications or sends outreach automatically.
 */
export function prepareOpportunity(
  opportunity,
  userProfile = {}
) {
  if (!opportunity) {
    throw new Error("Opportunity is required.");
  }

  const type =
    opportunity.type || "remote_job";

  /**
   * FREELANCE
   */
  if (type === "freelance") {
    const base =
      prepareFreelanceProposal(
        opportunity,
        userProfile
      );

    const proposal =
      generateProposal(
        opportunity,
        userProfile
      );

    const validation =
      validateProposal(proposal);

    return {
      opportunityId:
        opportunity.id,

      type,

      status:
        validation.valid
          ? "READY_FOR_REVIEW"
          : "NEEDS_REVIEW",

      package: {
        ...base,

        proposal:
          proposal.proposal,

        subject:
          proposal.subject
      },

      validation,

      nextAction:
        "Review the proposal and submit it through the permitted platform."
    };
  }

  /**
   * CUSTOMER
   *
   * Creates a complete outreach package.
   * Nothing is sent automatically.
   */
  if (type === "customer") {
    const outreach =
      prepareCustomerOutreach(
        opportunity,
        userProfile,
        "manual"
      );

    return {
      opportunityId:
        opportunity.id,

      type,

      status:
        "READY_FOR_REVIEW",

      package:
        outreach,

      validation: {
        valid: true,
        errors: []
      },

      nextAction:
        "Review the customer details and outreach message before sending."
    };
  }

  /**
   * REMOTE JOB
   */
  const application =
    prepareRemoteJobApplication(
      opportunity,
      userProfile
    );

  return {
    opportunityId:
      opportunity.id,

    type:
      "remote_job",

    status:
      "READY_FOR_REVIEW",

    package:
      application,

    validation: {
      valid: true,
      errors: []
    },

    nextAction:
      "Review the application package before submitting."
  };
}

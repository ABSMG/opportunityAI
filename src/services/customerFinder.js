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

import {
  prepareOutreach
} from "./outreachManager.js";

/**
 * Discover potential customers from approved
 * business/lead sources.
 */
export async function discoverCustomers(
  userProfile,
  sources = defaultSources
) {
  const customerSources = sources.filter(
    (source) =>
      source.type === OPPORTUNITY_TYPES.CUSTOMER
  );

  if (!customerSources.length) {
    return {
      success: true,
      customers: [],
      message:
        "No approved customer-data sources configured yet."
    };
  }

  const customers =
    await collectOpportunities(
      customerSources
    );

  const analyzed =
    await analyzeOpportunities(
      customers,
      userProfile
    );

  return {
    success: true,
    count: analyzed.length,
    customers: analyzed
  };
}

/**
 * Select high-priority potential customers.
 */
export function getHighPriorityCustomers(
  customers
) {
  return customers.filter(
    (customer) =>
      customer.type ===
        OPPORTUNITY_TYPES.CUSTOMER &&
      customer.aiAnalysis?.priority === "HIGH"
  );
}

/**
 * Prepare a complete customer outreach package.
 *
 * This does NOT send anything automatically.
 * It creates a message that must be reviewed
 * and approved by the user first.
 */
export function prepareCustomerOutreach(
  customer,
  userProfile,
  channel = "manual"
) {
  if (!customer) {
    throw new Error("Customer is required.");
  }

  const outreach =
    prepareOutreach({
      customer,
      userProfile,
      channel,
      service:
        userProfile.primaryService ||
        "Professional digital service"
    });

  return {
    customerId:
      customer.id,

    businessName:
      customer.company ||
      customer.title ||
      "Potential Customer",

    website:
      customer.url || "",

    service:
      userProfile.primaryService ||
      "Professional digital service",

    sender: {
      name:
        userProfile.name || "",

      skills:
        userProfile.skills || [],

      portfolio:
        userProfile.portfolio || ""
    },

    outreach,

    outreachStatus:
      "READY_FOR_REVIEW",

    nextAction:
      "Review the message and approve it before sending."
  };
}

/**
 * Rank potential customers according
 * to AI relevance.
 */
export function rankCustomers(
  customers
) {
  return [...customers].sort(
    (a, b) =>
      (b.aiAnalysis?.fitScore || 0) -
      (a.aiAnalysis?.fitScore || 0)
  );
}

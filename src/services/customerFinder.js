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
 * Prepare a customer outreach package.
 */
export function prepareCustomerOutreach(
  customer,
  userProfile
) {
  if (!customer) {
    throw new Error("Customer is required.");
  }

  return {
    customerId: customer.id,

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
      name: userProfile.name || "",
      skills: userProfile.skills || [],
      portfolio:
        userProfile.portfolio || ""
    },

    outreachStatus:
      "READY_FOR_REVIEW",

    nextAction:
      "Review the message before sending."
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

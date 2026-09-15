/**
 * Opportunity Sources
 *
 * This layer is responsible for collecting opportunities from
 * legitimate, permitted sources.
 *
 * IMPORTANT:
 * - Do not scrape sites that prohibit automated access.
 * - Prefer official APIs, RSS feeds, public datasets, or
 *   user-authorized integrations.
 * - Every returned item is normalized before entering the
 *   OpportunityAI ranking engine.
 */

import {
  createOpportunity,
  OPPORTUNITY_TYPES
} from "./opportunityEngine.js";

/**
 * Normalize a raw opportunity from any supported source.
 */
export function normalizeOpportunity(raw, type) {
  return createOpportunity({
    id: raw.id || raw.guid || raw.url,

    type,

    title:
      raw.title ||
      raw.name ||
      "Untitled opportunity",

    description:
      raw.description ||
      raw.summary ||
      "",

    company:
      raw.company ||
      raw.organization ||
      raw.employer ||
      "",

    url:
      raw.url ||
      raw.link ||
      "",

    payment:
      raw.payment ||
      raw.salary ||
      raw.budget ||
      null,

    currency:
      raw.currency ||
      "",

    remote:
      raw.remote ??
      true,

    skills:
      raw.skills ||
      raw.tags ||
      "",

    deadline:
      raw.deadline ||
      raw.closingDate ||
      null,

    source:
      raw.source ||
      "approved_source"
  });
}

/**
 * Fetch opportunities from a JSON API.
 *
 * The actual endpoint is intentionally supplied through
 * configuration instead of hard-coding a third-party website.
 */
export async function fetchJsonSource({
  url,
  type,
  headers = {}
}) {
  if (!url) {
    throw new Error("Source URL is required.");
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...headers
    }
  });

  if (!response.ok) {
    throw new Error(
      `Opportunity source failed: ${response.status}`
    );
  }

  const data = await response.json();

  const records = Array.isArray(data)
    ? data
    : data.items || data.results || data.data || [];

  return records.map((item) =>
    normalizeOpportunity(item, type)
  );
}

/**
 * Fetch an RSS/Atom feed.
 *
 * XML parsing is kept separate so the backend can use a proper
 * XML parser when this source type is enabled.
 */
export async function fetchFeedSource({
  url,
  type
}) {
  if (!url) {
    throw new Error("Feed URL is required.");
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Feed source failed: ${response.status}`
    );
  }

  const xml = await response.text();

  return {
    type,
    url,
    xml
  };
}

/**
 * Remove duplicate opportunities.
 */
export function deduplicateOpportunities(
  opportunities
) {
  const seen = new Set();

  return opportunities.filter((item) => {
    const key =
      item.url ||
      `${item.title}-${item.company}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

/**
 * Main source collector.
 *
 * Sources are passed into this function by the backend.
 * This makes it possible to add or remove sources without
 * changing the ranking engine.
 */
export async function collectOpportunities(
  sources = []
) {
  const collected = [];

  for (const source of sources) {
    try {
      if (source.kind === "json") {
        const items = await fetchJsonSource({
          url: source.url,
          type: source.type,
          headers: source.headers
        });

        collected.push(...items);
      }

      if (source.kind === "feed") {
        const result = await fetchFeedSource({
          url: source.url,
          type: source.type
        });

        collected.push(result);
      }
    } catch (error) {
      console.error(
        `Source error: ${source.name || source.url}`,
        error.message
      );
    }
  }

  return deduplicateOpportunities(
    collected
  );
}

/**
 * Example source configuration.
 *
 * Keep URLs empty until an approved/official source
 * is configured.
 */
export const defaultSources = [
  {
    name: "Remote Jobs API",
    kind: "json",
    type: OPPORTUNITY_TYPES.REMOTE_JOB,
    url: ""
  },

  {
    name: "Freelance Opportunities API",
    kind: "json",
    type: OPPORTUNITY_TYPES.FREELANCE,
    url: ""
  },

  {
    name: "Customer Lead Source",
    kind: "json",
    type: OPPORTUNITY_TYPES.CUSTOMER,
    url: ""
  }
];

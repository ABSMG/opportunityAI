/**
 * OpportunityAI — Opportunity Sources
 *
 * Collects opportunities from legitimate, permitted sources.
 *
 * Supported source types:
 * - Official JSON APIs
 * - RSS / Atom feeds
 * - Public datasets
 * - User-authorized integrations
 *
 * No unauthorized scraping.
 */

import {
  createOpportunity,
  OPPORTUNITY_TYPES
} from "./opportunityEngine.js";

/**
 * Normalize a raw opportunity into the OpportunityAI format.
 */
export function normalizeOpportunity(raw = {}, type) {
  return createOpportunity({
    id:
      raw.id ||
      raw.guid ||
      raw.external_id ||
      raw.url ||
      undefined,

    type,

    title:
      raw.title ||
      raw.name ||
      raw.position ||
      "Untitled opportunity",

    description:
      raw.description ||
      raw.summary ||
      raw.snippet ||
      "",

    company:
      raw.company ||
      raw.organization ||
      raw.employer ||
      raw.company_name ||
      "",

    url:
      raw.url ||
      raw.link ||
      raw.apply_url ||
      "",

    payment:
      raw.payment ??
      raw.salary ??
      raw.budget ??
      raw.compensation ??
      null,

    currency:
      raw.currency ||
      raw.salary_currency ||
      "",

    remote:
      raw.remote ??
      raw.is_remote ??
      true,

    skills:
      raw.skills ||
      raw.tags ||
      raw.keywords ||
      "",

    deadline:
      raw.deadline ||
      raw.closingDate ||
      raw.closing_date ||
      null,

    source:
      raw.source ||
      raw.source_name ||
      "approved_source"
  });
}

/**
 * Fetch JSON from an approved API.
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
    : Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.results)
    ? data.results
    : Array.isArray(data.data)
    ? data.data
    : [];

  return records.map((item) =>
    normalizeOpportunity(item, type)
  );
}

/**
 * Fetch RSS or Atom feed.
 *
 * XML parsing can be added with a dedicated parser.
 */
export async function fetchFeedSource({
  url,
  type
}) {
  if (!url) {
    throw new Error("Feed URL is required.");
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml"
    }
  });

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
  opportunities = []
) {
  const seen = new Set();

  return opportunities.filter((item) => {
    const key =
      item.url ||
      item.id ||
      `${item.title}-${item.company}`;

    if (!key) {
      return true;
    }

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

/**
 * Collect opportunities from configured sources.
 */
export async function collectOpportunities(
  sources = []
) {
  const collected = [];

  for (const source of sources) {
    try {
      if (!source || !source.url) {
        continue;
      }

      if (source.kind === "json") {
        const items = await fetchJsonSource({
          url: source.url,
          type: source.type,
          headers: source.headers || {}
        });

        collected.push(...items);
      }

      if (source.kind === "feed") {
        const result = await fetchFeedSource({
          url: source.url,
          type: source.type
        });

        /*
         * XML is intentionally not converted into
         * fake opportunities here.
         */
        if (result.xml) {
          console.log(
            `Feed received from ${source.name || source.url}`
          );
        }
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
 * Source configuration.
 *
 * URLs remain empty until an approved source
 * is intentionally configured.
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

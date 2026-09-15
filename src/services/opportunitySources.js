/**
 * OpportunityAI — Opportunity Sources
 *
 * Collects opportunities from legitimate, permitted sources.
 *
 * Supported:
 * - Official JSON APIs
 * - Public job-board APIs
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

// =====================================
// NORMALIZE OPPORTUNITY
// =====================================

export function normalizeOpportunity(
  raw = {},
  type,
  sourceName = "approved_source"
) {
  return createOpportunity({
    id:
      raw.id ||
      raw.guid ||
      raw.external_id ||
      raw.job_id ||
      raw.url ||
      undefined,

    type,

    title:
      raw.title ||
      raw.name ||
      raw.position ||
      raw.job_title ||
      "Untitled opportunity",

    description:
      raw.description ||
      raw.summary ||
      raw.snippet ||
      raw.content ||
      "",

    company:
      raw.company ||
      raw.organization ||
      raw.employer ||
      raw.company_name ||
      raw.company?.name ||
      "",

    url:
      raw.url ||
      raw.link ||
      raw.apply_url ||
      raw.job_url ||
      "",

    payment:
      raw.payment ??
      raw.salary ??
      raw.budget ??
      raw.compensation ??
      raw.salary_min ??
      null,

    currency:
      raw.currency ||
      raw.salary_currency ||
      "",

    remote:
      raw.remote ??
      raw.is_remote ??
      raw.remote_ok ??
      true,

    skills:
      raw.skills ||
      raw.tags ||
      raw.keywords ||
      raw.category ||
      "",

    deadline:
      raw.deadline ||
      raw.closingDate ||
      raw.closing_date ||
      null,

    source:
      raw.source ||
      raw.source_name ||
      sourceName
  });
}

// =====================================
// FETCH JSON SOURCE
// =====================================

export async function fetchJsonSource({
  url,
  type,
  sourceName = "approved_source",
  headers = {}
}) {
  if (!url) {
    throw new Error(
      "Source URL is required."
    );
  }

  const response = await fetch(url, {
    method: "GET",

    headers: {
      Accept:
        "application/json",
      ...headers
    }
  });

  if (!response.ok) {
    throw new Error(
      `Source failed: ${response.status}`
    );
  }

  const data =
    await response.json();

  /*
   * Different APIs return arrays
   * using different property names.
   */

  const records =
    Array.isArray(data)
      ? data
      : Array.isArray(data.jobs)
      ? data.jobs
      : Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.results)
      ? data.results
      : Array.isArray(data.data)
      ? data.data
      : [];

  return records.map(
    (item) =>
      normalizeOpportunity(
        item,
        type,
        sourceName
      )
  );
}

// =====================================
// FETCH RSS / ATOM FEED
// =====================================

export async function fetchFeedSource({
  url,
  type,
  sourceName = "approved_feed"
}) {
  if (!url) {
    throw new Error(
      "Feed URL is required."
    );
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

  const xml =
    await response.text();

  return {
    type,
    source: sourceName,
    url,
    xml
  };
}

// =====================================
// DEDUPLICATE
// =====================================

export function deduplicateOpportunities(
  opportunities = []
) {
  const seen =
    new Set();

  return opportunities.filter(
    (item) => {
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
    }
  );
}

// =====================================
// COLLECT OPPORTUNITIES
// =====================================

export async function collectOpportunities(
  sources = []
) {
  const collected = [];

  for (const source of sources) {
    try {
      if (
        !source ||
        !source.url
      ) {
        continue;
      }

      // -------------------------------
      // JSON API
      // -------------------------------

      if (
        source.kind === "json"
      ) {
        const items =
          await fetchJsonSource({
            url: source.url,

            type: source.type,

            sourceName:
              source.name,

            headers:
              source.headers || {}
          });

        collected.push(
          ...items
        );
      }

      // -------------------------------
      // RSS / ATOM
      // -------------------------------

      if (
        source.kind === "feed"
      ) {
        const result =
          await fetchFeedSource({
            url: source.url,

            type: source.type,

            sourceName:
              source.name
          });

        /*
         * XML parsing will be added
         * separately.
         *
         * We do not create fake
         * opportunities from raw XML.
         */

        if (result.xml) {
          console.log(
            `Feed received from ${source.name}`
          );
        }
      }
    } catch (error) {
      console.error(
        `Source error: ${
          source.name ||
          source.url
        }`,
        error.message
      );
    }
  }

  return deduplicateOpportunities(
    collected
  );
}

// =====================================
// APPROVED DEFAULT SOURCES
// =====================================

export const defaultSources = [

  // -----------------------------------
  // REMOTIVE
  // -----------------------------------

  {
    name:
      "Remotive Remote Jobs",

    kind:
      "json",

    type:
      OPPORTUNITY_TYPES.REMOTE_JOB,

    url:
      "https://remotive.com/api/remote-jobs",

    headers: {
      Accept:
        "application/json"
    }
  },

  // -----------------------------------
  // ARBEITNOW
  // -----------------------------------

  {
    name:
      "Arbeitnow Job Board",

    kind:
      "json",

    type:
      OPPORTUNITY_TYPES.REMOTE_JOB,

    url:
      "https://www.arbeitnow.com/api/job-board-api",

    headers: {
      Accept:
        "application/json"
    }
  },

  // -----------------------------------
  // REMOTIVE RSS
  // -----------------------------------

  {
    name:
      "Remotive RSS",

    kind:
      "feed",

    type:
      OPPORTUNITY_TYPES.REMOTE_JOB,

    url:
      "https://remotive.com/remote-jobs/rss-feed"
  }
];

// =====================================
// SOURCE INFORMATION
// =====================================

export const sourceInformation = {
  remotive: {
    name:
      "Remotive",

    type:
      "remote_jobs",

    official:
      "https://remotive.com/"
  },

  arbeitnow: {
    name:
      "Arbeitnow",

    type:
      "job_board_api",

    official:
      "https://www.arbeitnow.com/"
  }
};

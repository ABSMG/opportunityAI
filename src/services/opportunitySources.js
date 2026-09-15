/**
 * OpportunityAI — Opportunity Sources
 *
 * Collects opportunities from legitimate, permitted sources.
 *
 * Features:
 * - Official JSON APIs
 * - Public job-board APIs
 * - RSS / Atom feeds
 * - Per-source timeout
 * - Parallel source scanning
 * - Failed sources do not stop the scanner
 * - Deduplication
 *
 * No unauthorized scraping.
 */

import {
  createOpportunity,
  OPPORTUNITY_TYPES
} from "./opportunityEngine.js";

const SOURCE_TIMEOUT_MS = 12000;
const MAX_ITEMS_PER_SOURCE = 100;

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
      raw.company?.name ||
      raw.company ||
      raw.organization ||
      raw.employer ||
      raw.company_name ||
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
// FETCH WITH TIMEOUT
// =====================================

export async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = SOURCE_TIMEOUT_MS
) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        `Source timeout after ${timeoutMs}ms`
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
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

  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...headers
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `Source failed: ${response.status}`
    );
  }

  const data = await response.json();

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

  return records
    .slice(0, MAX_ITEMS_PER_SOURCE)
    .map((item) =>
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

  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `Feed source failed: ${response.status}`
    );
  }

  const xml = await response.text();

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
  const seen = new Set();

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
// SCAN ONE SOURCE
// =====================================

async function scanSource(source) {
  if (!source || !source.url) {
    throw new Error(
      "Invalid opportunity source."
    );
  }

  if (source.kind === "json") {
    return await fetchJsonSource({
      url: source.url,
      type: source.type,
      sourceName: source.name,
      headers: source.headers || {}
    });
  }

  if (source.kind === "feed") {
    const result =
      await fetchFeedSource({
        url: source.url,
        type: source.type,
        sourceName: source.name
      });

    /*
     * We intentionally do not create
     * fake opportunities from XML.
     *
     * RSS parsing can be added later.
     */

    if (result.xml) {
      console.log(
        `Feed received from ${source.name}`
      );
    }

    return [];
  }

  throw new Error(
    `Unsupported source type: ${source.kind}`
  );
}

// =====================================
// COLLECT OPPORTUNITIES
// =====================================

export async function collectOpportunities(
  sources = []
) {
  if (!Array.isArray(sources)) {
    return [];
  }

  const validSources =
    sources.filter(
      (source) =>
        source &&
        source.url
    );

  if (!validSources.length) {
    console.warn(
      "No valid opportunity sources configured."
    );

    return [];
  }

  console.log(
    `Starting opportunity scan across ${validSources.length} sources...`
  );

  /*
   * Scan all sources in parallel.
   *
   * Promise.allSettled ensures that one
   * failed source does not stop the others.
   */

  const results =
    await Promise.allSettled(
      validSources.map(
        async (source) => {
          const startedAt =
            Date.now();

          try {
            const items =
              await scanSource(
                source
              );

            console.log(
              `Source success: ${
                source.name
              } — ${
                items.length
              } opportunities — ${
                Date.now() -
                startedAt
              }ms`
            );

            return {
              source:
                source.name ||
                source.url,

              success: true,

              count:
                items.length,

              items
            };
          } catch (error) {
            console.error(
              `Source failed: ${
                source.name ||
                source.url
              } — ${
                error.message
              }`
            );

            return {
              source:
                source.name ||
                source.url,

              success: false,

              count: 0,

              items: [],

              error:
                error.message
            };
          }
        }
      )
    );

  const collected = [];

  const sourceResults = [];

  for (const result of results) {
    if (
      result.status ===
      "fulfilled"
    ) {
      sourceResults.push(
        result.value
      );

      if (
        Array.isArray(
          result.value.items
        )
      ) {
        collected.push(
          ...result.value.items
        );
      }
    } else {
      sourceResults.push({
        success: false,
        count: 0,
        items: [],
        error:
          result.reason?.message ||
          "Unknown source error"
      });
    }
  }

  const unique =
    deduplicateOpportunities(
      collected
    );

  console.log(
    `Opportunity scan completed: ${unique.length} unique opportunities found.`
  );

  /*
   * Keep source information available
   * for server-side logging/debugging.
   */

  console.log(
    "Source results:",
    JSON.stringify(
      sourceResults
    )
  );

  return unique;
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

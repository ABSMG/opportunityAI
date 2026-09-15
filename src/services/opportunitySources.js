const DEFAULT_TIMEOUT_MS = 12000;

function normalizeText(value = "") {
  return String(value)
    .replace(/\s+/g, " ")
    .trim();
}

// =====================================
// PAYMENT NORMALIZATION
// =====================================

function normalizePayment(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  // Already numeric
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : null;
  }

  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  // Examples:
  // "$14/hour" -> 14
  // "$500/month" -> 500
  // "€20/day" -> 20
  // "£100" -> 100
  // "TZS 50,000" -> 50000

  const match = text.match(
    /-?\d+(?:[.,]\d+)?/
  );

  if (!match) {
    return null;
  }

  const number = Number(
    match[0].replace(/,/g, "")
  );

  return Number.isFinite(number)
    ? number
    : null;
}

// =====================================
// CURRENCY NORMALIZATION
// =====================================

function normalizeCurrency(value = "") {
  const text = normalizeText(value);

  if (!text) {
    return "";
  }

  if (
    text.includes("$") ||
    text.toLowerCase().includes("usd")
  ) {
    return "USD";
  }

  if (
    text.includes("€") ||
    text.toLowerCase().includes("eur")
  ) {
    return "EUR";
  }

  if (
    text.includes("£") ||
    text.toLowerCase().includes("gbp")
  ) {
    return "GBP";
  }

  if (
    text.toLowerCase().includes("tzs") ||
    text.toLowerCase().includes("tsh")
  ) {
    return "TZS";
  }

  return text
    .toUpperCase()
    .slice(0, 10);
}

// =====================================
// OPPORTUNITY NORMALIZATION
// =====================================

function normalizeOpportunity(
  opportunity = {},
  source = "unknown"
) {
  const rawPayment =
    opportunity.payment ??
    opportunity.salary ??
    opportunity.compensation ??
    opportunity.pay ??
    null;

  const payment =
    normalizePayment(rawPayment);

  const currency =
    normalizeCurrency(
      opportunity.currency ||
        opportunity.currencyCode ||
        rawPayment ||
        ""
    );

  return {
    id:
      opportunity.id ||
      opportunity.slug ||
      `${source}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    type:
      opportunity.type ||
      "remote_job",

    title:
      normalizeText(
        opportunity.title ||
          opportunity.name ||
          "Untitled Opportunity"
      ),

    description:
      normalizeText(
        opportunity.description ||
          opportunity.summary ||
          ""
      ),

    company:
      normalizeText(
        opportunity.company ||
          opportunity.company_name ||
          opportunity.organization ||
          ""
      ),

    url:
      opportunity.url ||
      opportunity.apply_url ||
      opportunity.link ||
      "",

    payment,

    currency,

    remote:
      opportunity.remote ??
      true,

    skills:
      normalizeText(
        Array.isArray(
          opportunity.skills
        )
          ? opportunity.skills.join(", ")
          : opportunity.skills ||
              opportunity.tags ||
              ""
      ),

    deadline:
      opportunity.deadline ||
      opportunity.application_deadline ||
      null,

    source,

    discoveredAt:
      opportunity.discoveredAt ||
      new Date().toISOString()
  };
}

// =====================================
// FETCH WITH TIMEOUT
// =====================================

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  try {
    const response =
      await fetch(url, {
        ...options,
        signal:
          controller.signal,
        headers: {
          Accept:
            "application/json",
          "User-Agent":
            "OpportunityAI/1.0",
          ...(options.headers || {})
        }
      });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} from ${url}`
      );
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// =====================================
// JSON SOURCE
// =====================================

async function fetchJsonSource(
  source
) {
  try {
    const response =
      await fetchWithTimeout(
        source.url
      );

    const data =
      await response.json();

    let items = [];

    if (Array.isArray(data)) {
      items = data;
    } else if (
      Array.isArray(data.jobs)
    ) {
      items = data.jobs;
    } else if (
      Array.isArray(data.data)
    ) {
      items = data.data;
    } else if (
      Array.isArray(data.results)
    ) {
      items = data.results;
    } else {
      console.warn(
        `No supported array found in ${source.name}`
      );
    }

    return items
      .slice(0, 100)
      .map((item) =>
        normalizeOpportunity(
          item,
          source.name
        )
      );
  } catch (error) {
    console.error(
      `Source failed: ${source.name}`,
      error.message
    );

    return [];
  }
}

// =====================================
// RSS SOURCE
// =====================================

async function fetchFeedSource(
  source
) {
  try {
    const response =
      await fetchWithTimeout(
        source.url,
        {
          headers: {
            Accept:
              "application/rss+xml, application/xml, text/xml"
          }
        }
      );

    const xml =
      await response.text();

    if (!xml) {
      return [];
    }

    // Lightweight RSS parser.
    // Keeps the project dependency-free.

    const items = [];

    const itemMatches =
      xml.match(
        /<item[\s\S]*?<\/item>/gi
      ) || [];

    for (
      const itemXml of itemMatches.slice(
        0,
        100
      )
    ) {
      const getTag = (
        tag
      ) => {
        const regex =
          new RegExp(
            `<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
            "i"
          );

        const match =
          itemXml.match(regex);

        if (!match) {
          return "";
        }

        return match[1]
          .replace(
            /<!\[CDATA\[([\s\S]*?)\]\]>/g,
            "$1"
          )
          .replace(
            /<[^>]+>/g,
            " "
          )
          .trim();
      };

      const title =
        getTag("title");

      const description =
        getTag("description");

      const link =
        getTag("link");

      const guid =
        getTag("guid");

      if (
        title ||
        description ||
        link
      ) {
        items.push(
          normalizeOpportunity(
            {
              id:
                guid ||
                link ||
                `${source.name}_${items.length}`,

              title,

              description,

              url: link,

              remote: true
            },
            source.name
          )
        );
      }
    }

    return items;
  } catch (error) {
    console.error(
      `Feed failed: ${source.name}`,
      error.message
    );

    return [];
  }
}

// =====================================
// DEDUPLICATION
// =====================================

function deduplicateOpportunities(
  opportunities
) {
  const seen =
    new Set();

  return opportunities.filter(
    (opportunity) => {
      const key =
        opportunity.url ||
        `${opportunity.source}:${opportunity.id}`;

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

async function scanSource(
  source
) {
  if (
    !source ||
    !source.url
  ) {
    return [];
  }

  const type =
    String(
      source.type || "json"
    ).toLowerCase();

  if (
    type === "rss" ||
    type === "feed" ||
    type === "xml"
  ) {
    return fetchFeedSource(
      source
    );
  }

  return fetchJsonSource(
    source
  );
}

// =====================================
// COLLECT ALL OPPORTUNITIES
// =====================================

export async function collectOpportunities(
  sources = defaultSources
) {
  if (
    !Array.isArray(sources) ||
    !sources.length
  ) {
    return [];
  }

  console.log(
    `OpportunityAI: scanning ${sources.length} sources...`
  );

  const results =
    await Promise.allSettled(
      sources.map(
        (source) =>
          scanSource(source)
      )
    );

  const opportunities = [];

  for (
    const result of results
  ) {
    if (
      result.status ===
      "fulfilled"
    ) {
      opportunities.push(
        ...result.value
      );
    } else {
      console.error(
        "Source scan error:",
        result.reason?.message ||
          result.reason
      );
    }
  }

  const unique =
    deduplicateOpportunities(
      opportunities
    );

  console.log(
    `OpportunityAI: ${unique.length} unique opportunities collected.`
  );

  return unique;
}

// =====================================
// DEFAULT SOURCES
// =====================================

export const defaultSources = [
  {
    name:
      "Remotive Remote Jobs",

    type:
      "json",

    url:
      "https://remotive.com/api/remote-jobs"
  },

  {
    name:
      "Arbeitnow Job Board",

    type:
      "json",

    url:
      "https://www.arbeitnow.com/api/job-board-api"
  },

  {
    name:
      "Remotive RSS",

    type:
      "rss",

    url:
      "https://remotive.com/remote-jobs/rss-feed"
  }
];

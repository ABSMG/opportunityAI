const APPLICATION_STATUS = {
  SAVED: "SAVED",
  PREPARED: "PREPARED",
  APPLIED: "APPLIED",
  REVIEWING: "REVIEWING",
  INTERVIEW: "INTERVIEW",
  OFFER: "OFFER",
  WON: "WON",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN"
};

/**
 * Create a new application record.
 */
export function createApplication({
  opportunity,
  userProfile,
  proposal = null
}) {
  if (!opportunity) {
    throw new Error("Opportunity is required.");
  }

  return {
    id:
      `app_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    opportunityId:
      opportunity.id,

    title:
      opportunity.title ||
      "Untitled Opportunity",

    company:
      opportunity.company || "",

    url:
      opportunity.url || "",

    source:
      opportunity.source || "unknown",

    applicant:
      userProfile?.name || "",

    proposal,

    status:
      APPLICATION_STATUS.SAVED,

    deadline:
      opportunity.deadline || null,

    notes: "",

    createdAt:
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString()
  };
}

/**
 * Update application status.
 */
export function updateApplicationStatus(
  application,
  status
) {
  if (!application) {
    throw new Error(
      "Application is required."
    );
  }

  if (
    !Object.values(
      APPLICATION_STATUS
    ).includes(status)
  ) {
    throw new Error(
      `Invalid application status: ${status}`
    );
  }

  return {
    ...application,

    status,

    updatedAt:
      new Date().toISOString()
  };
}

/**
 * Add notes to an application.
 */
export function addApplicationNote(
  application,
  note
) {
  if (!application) {
    throw new Error(
      "Application is required."
    );
  }

  return {
    ...application,

    notes:
      note || application.notes || "",

    updatedAt:
      new Date().toISOString()
  };
}

/**
 * Get applications by status.
 */
export function filterApplications(
  applications,
  status
) {
  if (!Array.isArray(applications)) {
    return [];
  }

  if (!status) {
    return applications;
  }

  return applications.filter(
    (application) =>
      application.status === status
  );
}

/**
 * Get applications that need attention.
 */
export function getActiveApplications(
  applications
) {
  const activeStatuses = [
    APPLICATION_STATUS.APPLIED,
    APPLICATION_STATUS.REVIEWING,
    APPLICATION_STATUS.INTERVIEW,
    APPLICATION_STATUS.OFFER
  ];

  return filterApplicationsByStatuses(
    applications,
    activeStatuses
  );
}

/**
 * Filter by multiple statuses.
 */
export function filterApplicationsByStatuses(
  applications,
  statuses = []
) {
  if (!Array.isArray(applications)) {
    return [];
  }

  return applications.filter(
    (application) =>
      statuses.includes(
        application.status
      )
  );
}

/**
 * Calculate application statistics.
 */
export function getApplicationStats(
  applications
) {
  if (!Array.isArray(applications)) {
    return {
      total: 0,
      applied: 0,
      interviews: 0,
      offers: 0,
      won: 0,
      rejected: 0
    };
  }

  return {
    total: applications.length,

    applied:
      applications.filter(
        (a) =>
          a.status ===
          APPLICATION_STATUS.APPLIED
      ).length,

    interviews:
      applications.filter(
        (a) =>
          a.status ===
          APPLICATION_STATUS.INTERVIEW
      ).length,

    offers:
      applications.filter(
        (a) =>
          a.status ===
          APPLICATION_STATUS.OFFER
      ).length,

    won:
      applications.filter(
        (a) =>
          a.status ===
          APPLICATION_STATUS.WON
      ).length,

    rejected:
      applications.filter(
        (a) =>
          a.status ===
          APPLICATION_STATUS.REJECTED
      ).length
  };
}

export {
  APPLICATION_STATUS
};

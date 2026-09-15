const REVENUE_STATUS = {
  PENDING: "PENDING",
  RECEIVED: "RECEIVED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED"
};

const REVENUE_TYPES = {
  FREELANCE: "FREELANCE",
  REMOTE_JOB: "REMOTE_JOB",
  CUSTOMER: "CUSTOMER",
  OTHER: "OTHER"
};

/**
 * Create a revenue record.
 */
export function createRevenueRecord({
  sourceId,
  sourceType = REVENUE_TYPES.OTHER,
  description = "",
  amount = 0,
  currency = "TZS",
  status = REVENUE_STATUS.PENDING,
  receivedAt = null
}) {
  const numericAmount =
    Number(amount);

  if (
    !Number.isFinite(
      numericAmount
    ) ||
    numericAmount < 0
  ) {
    throw new Error(
      "Revenue amount must be a valid positive number."
    );
  }

  return {
    id:
      `rev_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    sourceId:
      sourceId || null,

    sourceType,

    description,

    amount:
      numericAmount,

    currency,

    status,

    receivedAt,

    createdAt:
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString()
  };
}

/**
 * Mark revenue as received.
 */
export function markRevenueReceived(
  revenue,
  receivedAt = new Date().toISOString()
) {
  if (!revenue) {
    throw new Error(
      "Revenue record is required."
    );
  }

  return {
    ...revenue,

    status:
      REVENUE_STATUS.RECEIVED,

    receivedAt,

    updatedAt:
      new Date().toISOString()
  };
}

/**
 * Calculate total received revenue.
 */
export function calculateTotalRevenue(
  revenueRecords,
  currency = null
) {
  if (!Array.isArray(revenueRecords)) {
    return 0;
  }

  return revenueRecords
    .filter(
      (record) =>
        record.status ===
        REVENUE_STATUS.RECEIVED
    )
    .filter(
      (record) =>
        !currency ||
        record.currency === currency
    )
    .reduce(
      (total, record) =>
        total +
        Number(record.amount || 0),
      0
    );
}

/**
 * Calculate pending revenue.
 */
export function calculatePendingRevenue(
  revenueRecords,
  currency = null
) {
  if (!Array.isArray(revenueRecords)) {
    return 0;
  }

  return revenueRecords
    .filter(
      (record) =>
        record.status ===
        REVENUE_STATUS.PENDING
    )
    .filter(
      (record) =>
        !currency ||
        record.currency === currency
    )
    .reduce(
      (total, record) =>
        total +
        Number(record.amount || 0),
      0
    );
}

/**
 * Group revenue by source type.
 */
export function revenueByType(
  revenueRecords
) {
  const result = {};

  if (!Array.isArray(revenueRecords)) {
    return result;
  }

  for (const record of revenueRecords) {
    if (
      record.status !==
      REVENUE_STATUS.RECEIVED
    ) {
      continue;
    }

    const type =
      record.sourceType ||
      REVENUE_TYPES.OTHER;

    result[type] =
      (result[type] || 0) +
      Number(record.amount || 0);
  }

  return result;
}

/**
 * Get a revenue dashboard summary.
 */
export function getRevenueSummary(
  revenueRecords,
  currency = "TZS"
) {
  const received =
    calculateTotalRevenue(
      revenueRecords,
      currency
    );

  const pending =
    calculatePendingRevenue(
      revenueRecords,
      currency
    );

  const receivedRecords =
    Array.isArray(revenueRecords)
      ? revenueRecords.filter(
          (record) =>
            record.status ===
              REVENUE_STATUS.RECEIVED &&
            record.currency === currency
        )
      : [];

  return {
    currency,

    received,

    pending,

    totalRecords:
      Array.isArray(revenueRecords)
        ? revenueRecords.length
        : 0,

    successfulPayments:
      receivedRecords.length,

    byType:
      revenueByType(
        revenueRecords
      )
  };
}

export {
  REVENUE_STATUS,
  REVENUE_TYPES
};

const ALLOWED_CHANNELS = [
  "email",
  "telegram",
  "webhook",
  "manual"
];

const OUTREACH_STATUS = {
  DRAFT: "DRAFT",
  READY_FOR_REVIEW: "READY_FOR_REVIEW",
  APPROVED: "APPROVED",
  SENT: "SENT",
  REPLIED: "REPLIED",
  FAILED: "FAILED"
};

/**
 * Build a personalized outreach message.
 */
export function buildOutreachMessage(
  customer,
  userProfile,
  service
) {
  const businessName =
    customer.company ||
    customer.title ||
    "your business";

  const senderName =
    userProfile.name ||
    "Our team";

  const selectedService =
    service ||
    userProfile.primaryService ||
    "digital services";

  return {
    subject:
      `A quick idea for ${businessName}`,

    body:
      `Hi ${businessName} team,

I came across your business and noticed an opportunity where ${selectedService} could potentially help.

I’m ${senderName}, and I provide ${selectedService}.

If this is relevant to your current goals, I’d be happy to share a simple idea or discuss what you may need.

Best regards,
${senderName}`,

    personalization: {
      businessName,
      service: selectedService
    }
  };
}

/**
 * Check whether an outreach action is allowed.
 *
 * Automation should only be used when the selected
 * channel/platform permits it and the user has enabled it.
 */
export function canSendOutreach({
  channel,
  userApproved = false,
  platformAllowsAutomation = false
}) {
  if (!ALLOWED_CHANNELS.includes(channel)) {
    return {
      allowed: false,
      reason: "Unsupported outreach channel."
    };
  }

  if (!userApproved) {
    return {
      allowed: false,
      reason:
        "User approval is required before sending."
    };
  }

  if (
    channel !== "manual" &&
    !platformAllowsAutomation
  ) {
    return {
      allowed: false,
      reason:
        "Automation is not enabled for this channel."
    };
  }

  return {
    allowed: true,
    reason: "Outreach is allowed."
  };
}

/**
 * Prepare an outreach task for review.
 */
export function prepareOutreach({
  customer,
  userProfile,
  channel = "manual",
  service
}) {
  if (!customer) {
    throw new Error("Customer is required.");
  }

  const message =
    buildOutreachMessage(
      customer,
      userProfile,
      service
    );

  return {
    id:
      `outreach_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    customerId: customer.id,

    channel,

    message,

    status:
      OUTREACH_STATUS.READY_FOR_REVIEW,

    createdAt:
      new Date().toISOString(),

    nextAction:
      "Review and approve before sending."
  };
}

/**
 * Record the result of an outreach attempt.
 */
export function recordOutreachResult(
  outreach,
  result
) {
  if (!outreach) {
    throw new Error("Outreach task is required.");
  }

  return {
    ...outreach,

    status:
      result.status ||
      OUTREACH_STATUS.SENT,

    response:
      result.response || null,

    error:
      result.error || null,

    completedAt:
      new Date().toISOString()
  };
}

/**
 * Mark an outreach as replied.
 */
export function markOutreachReplied(
  outreach,
  response
) {
  return recordOutreachResult(
    outreach,
    {
      status:
        OUTREACH_STATUS.REPLIED,

      response
    }
  );
}

export {
  ALLOWED_CHANNELS,
  OUTREACH_STATUS
};

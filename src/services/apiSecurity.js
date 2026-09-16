import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY;

const supabase =
  SUPABASE_URL &&
  SUPABASE_SECRET_KEY
    ? createClient(
        SUPABASE_URL,
        SUPABASE_SECRET_KEY
      )
    : null;

/**
 * Require a valid Supabase access token.
 *
 * Usage:
 * app.use("/api/protected-route", requireAuth);
 */
export async function requireAuth(
  req,
  res,
  next
) {
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        message:
          "Supabase authentication is not configured."
      });
    }

    const authorization =
      req.get("authorization") || "";

    const match =
      authorization.match(
        /^Bearer\s+(.+)$/i
      );

    if (!match) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required."
      });
    }

    const accessToken =
      match[1].trim();

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authentication token."
      });
    }

    const {
      data,
      error
    } =
      await supabase.auth.getUser(
        accessToken
      );

    if (
      error ||
      !data?.user
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid or expired authentication token."
      });
    }

    req.user = data.user;

    next();
  } catch (error) {
    console.error(
      "Authentication error:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message:
        "Authentication failed."
    });
  }
}

/**
 * Confirm that the authenticated user
 * owns a resource.
 */
export function requireOwner(
  ownerId
) {
  return (
    req,
    res,
    next
  ) => {
    if (
      !req.user?.id
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required."
      });
    }

    if (
      !ownerId ||
      ownerId !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to access this resource."
      });
    }

    next();
  };
}

/**
 * Validate official external URLs.
 */
export function isOfficialHttpUrl(
  value
) {
  try {
    const url =
      new URL(
        String(value || "")
      );

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

/**
 * User confirmation helper.
 */
export function requireUserConfirmation(
  body,
  message
) {
  if (
    body?.confirmedByUser !==
    true
  ) {
    const error =
      new Error(
        message ||
          "User confirmation is required."
      );

    error.statusCode = 400;

    throw error;
  }
}

/**
 * Validate payment evidence.
 */
export function validatePayment(
  body
) {
  const amount =
    Number(body?.amount);

  const currency =
    String(
      body?.currency || ""
    )
      .trim()
      .toUpperCase();

  const provider =
    String(
      body?.provider || ""
    ).trim();

  const paymentMethod =
    String(
      body?.paymentMethod ||
        body?.payment_method ||
        ""
    ).trim();

  const providerReference =
    String(
      body?.providerReference ||
        body?.provider_reference ||
        ""
    ).trim();

  const evidence =
    body?.evidence ??
    body?.proof ??
    null;

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return {
      valid: false,
      message:
        "A valid positive payment amount is required."
    };
  }

  if (!currency) {
    return {
      valid: false,
      message:
        "Payment currency is required."
    };
  }

  if (!provider) {
    return {
      valid: false,
      message:
        "Payment provider is required."
    };
  }

  if (!paymentMethod) {
    return {
      valid: false,
      message:
        "Payment method is required."
    };
  }

  if (
    !evidence ||
    (
      typeof evidence ===
        "string" &&
      !evidence.trim()
    )
  ) {
    return {
      valid: false,
      message:
        "Payment evidence or proof is required."
    };
  }

  return {
    valid: true,

    payment: {
      amount,

      currency,

      provider,

      paymentMethod,

      providerReference:
        providerReference ||
        null,

      evidence,

      confirmedByUser:
        true,

      status:
        "PAID",

      paidAt:
        body?.paidAt ||
        new Date().toISOString(),

      notes:
        body?.notes ||
        null
    }
  };
}

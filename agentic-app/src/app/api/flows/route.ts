import { NextResponse } from "next/server";
import {
  DelayUnit,
  FlowRequestPayload,
  StepStatus,
  buildFlowDefinition,
} from "@/lib/klaviyo";

const KLAVIYO_API_URL = "https://a.klaviyo.com/api/flows/";
const KLAVIYO_REVISION = "2024-10-15";

const VALID_STATUSES: StepStatus[] = ["draft", "live", "manual", "disabled"];
const VALID_UNITS: DelayUnit[] = ["minutes", "hours", "days"];

const normalizeDelayUnit = (unit: string | undefined): DelayUnit => {
  return VALID_UNITS.includes(unit as DelayUnit) ? (unit as DelayUnit) : "days";
};

const normalizeStatus = (status: string | undefined): StepStatus => {
  return VALID_STATUSES.includes(status as StepStatus)
    ? (status as StepStatus)
    : "draft";
};

const sanitizePayload = (payload: FlowRequestPayload): FlowRequestPayload => {
  const steps = payload.steps.map((step) => ({
    internalName: step.internalName?.trim() ?? "",
    subjectLine: step.subjectLine?.trim() ?? "",
    previewText: step.previewText?.trim() ?? "",
    fromEmail: step.fromEmail?.trim() ?? "",
    fromName: step.fromName?.trim() ?? "",
    replyToEmail: step.replyToEmail?.trim() ?? "",
    ccEmail: step.ccEmail?.trim() ?? "",
    bccEmail: step.bccEmail?.trim() ?? "",
    templateId: step.templateId?.trim() ?? "",
    smartSendingEnabled: Boolean(step.smartSendingEnabled),
    status: normalizeStatus(step.status),
    delay:
      step.delay && typeof step.delay.value === "number" && step.delay.value > 0
        ? {
            value: Math.max(0, Math.round(step.delay.value)),
            unit: normalizeDelayUnit(step.delay.unit),
            timezone: step.delay.timezone?.trim() || "profile",
          }
        : null,
    customTracking: Array.isArray(step.customTracking)
      ? step.customTracking
          .map((track) => ({
            param: `${track.param ?? ""}`.trim(),
            value: `${track.value ?? ""}`.trim(),
          }))
          .filter((track) => track.param && track.value)
      : [],
  }));

  return {
    flowName: payload.flowName.trim(),
    trigger: {
      type: payload.trigger.type,
      id: payload.trigger.id.trim(),
    },
    steps,
  };
};

const validatePayload = (payload: FlowRequestPayload) => {
  if (!payload.flowName) {
    return "Flow name is required.";
  }

  if (!["list", "segment"].includes(payload.trigger.type)) {
    return "Unsupported trigger type. Only list and segment triggers are supported.";
  }

  if (!payload.trigger.id) {
    return "Trigger identifier is required.";
  }

  if (!payload.steps.length) {
    return "At least one email step is required.";
  }

  const invalidStepIndex = payload.steps.findIndex(
    (step) => !step.subjectLine || !step.fromEmail || !step.fromName,
  );

  if (invalidStepIndex !== -1) {
    return `Step ${invalidStepIndex + 1} is missing subject, from name, or from email.`;
  }

  return null;
};

export async function POST(request: Request) {
  const apiKey = process.env.KLAVIYO_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "KLAVIYO_API_KEY is not configured on the server.",
      },
      { status: 500 },
    );
  }

  let rawPayload: FlowRequestPayload;
  try {
    rawPayload = (await request.json()) as FlowRequestPayload;
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid JSON payload.",
        details:
          error instanceof Error ? error.message : "Unable to parse request.",
      },
      { status: 400 },
    );
  }

  const sanitizedPayload = sanitizePayload(rawPayload);
  const validationError = validatePayload(sanitizedPayload);

  if (validationError) {
    return NextResponse.json(
      {
        error: validationError,
      },
      { status: 400 },
    );
  }

  let definition;
  try {
    definition = buildFlowDefinition(sanitizedPayload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to construct Klaviyo flow payload.",
      },
      { status: 400 },
    );
  }

  const klaviyoPayload = {
    data: {
      type: "flow" as const,
      attributes: {
        name: sanitizedPayload.flowName,
        definition,
      },
    },
  };

  try {
    const response = await fetch(KLAVIYO_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
        revision: KLAVIYO_REVISION,
      },
      body: JSON.stringify(klaviyoPayload),
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Klaviyo API request failed.",
          details: json ?? undefined,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      data: json,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to reach Klaviyo API.",
        details: error instanceof Error ? error.message : error,
      },
      { status: 502 },
    );
  }
}


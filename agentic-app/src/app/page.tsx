'use client';

import { FormEvent, useMemo, useState } from "react";

type TriggerType = "list" | "segment";

type StepStatus = "draft" | "live" | "manual" | "disabled";

type DelayUnit = "minutes" | "hours" | "days";

interface TrackingRow {
  id: string;
  param: string;
  value: string;
}

interface EmailStepForm {
  id: string;
  internalName: string;
  subjectLine: string;
  previewText: string;
  fromEmail: string;
  fromName: string;
  replyToEmail: string;
  ccEmail: string;
  bccEmail: string;
  templateId: string;
  smartSendingEnabled: boolean;
  status: StepStatus;
  addTrackingParams: boolean;
  trackingRows: TrackingRow[];
  delayEnabled: boolean;
  delayValue: number;
  delayUnit: DelayUnit;
  delayTimezone: string;
}

interface CreateFlowResponse {
  data?: {
    data?: {
      id?: string;
      attributes?: {
        name?: string;
      };
    };
  };
  error?: string;
  details?: unknown;
}

const createId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
};

const createTrackingRow = (): TrackingRow => ({
  id: createId("tracking"),
  param: "",
  value: "",
});

const createEmptyStep = (): EmailStepForm => ({
  id: createId("step"),
  internalName: "",
  subjectLine: "",
  previewText: "",
  fromEmail: "",
  fromName: "",
  replyToEmail: "",
  ccEmail: "",
  bccEmail: "",
  templateId: "",
  smartSendingEnabled: true,
  status: "draft",
  addTrackingParams: false,
  trackingRows: [],
  delayEnabled: false,
  delayValue: 1,
  delayUnit: "days",
  delayTimezone: "profile",
});

export default function Home() {
  const [flowName, setFlowName] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("list");
  const [triggerId, setTriggerId] = useState("");
  const [steps, setSteps] = useState<EmailStepForm[]>([createEmptyStep()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiResponse, setApiResponse] = useState<CreateFlowResponse | null>(
    null,
  );

  const flowSummary = useMemo(() => {
    if (!apiResponse?.data?.data?.id) {
      return null;
    }

    return {
      id: apiResponse.data.data.id,
      name: apiResponse.data.data.attributes?.name ?? flowName,
    };
  }, [apiResponse, flowName]);

  const detailsString = useMemo(() => {
    if (
      !apiResponse ||
      typeof apiResponse.details === "undefined" ||
      apiResponse.details === null
    ) {
      return null;
    }

    try {
      return JSON.stringify(apiResponse.details, null, 2);
    } catch {
      return String(apiResponse.details);
    }
  }, [apiResponse]);

  const handleAddStep = () => {
    setSteps((prev) => [...prev, createEmptyStep()]);
  };

  const handleRemoveStep = (id: string) => {
    setSteps((prev) =>
      prev.length > 1 ? prev.filter((step) => step.id !== id) : prev,
    );
  };

  const updateStep = <Field extends keyof EmailStepForm>(
    id: string,
    field: Field,
    value: EmailStepForm[Field],
  ) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, [field]: value } : step)),
    );
  };

  const updateTrackingRow = (
    stepId: string,
    rowId: string,
    field: "param" | "value",
    value: string,
  ) => {
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== stepId) return step;
        return {
          ...step,
          trackingRows: step.trackingRows.map((row) =>
            row.id === rowId ? { ...row, [field]: value } : row,
          ),
        };
      }),
    );
  };

  const addTrackingRow = (stepId: string) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId
          ? {
              ...step,
              trackingRows: [...step.trackingRows, createTrackingRow()],
            }
          : step,
      ),
    );
  };

  const removeTrackingRow = (stepId: string, rowId: string) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId
          ? {
              ...step,
              trackingRows: step.trackingRows.filter((row) => row.id !== rowId),
            }
          : step,
      ),
    );
  };

  const validateForm = () => {
    if (!flowName.trim()) {
      return "Flow name is required.";
    }

    if (!triggerId.trim()) {
      return "Enter the Klaviyo trigger identifier (list or segment ID).";
    }

    const invalidStepIndex = steps.findIndex(
      (step) =>
        !step.subjectLine.trim() ||
        !step.fromEmail.trim() ||
        !step.fromName.trim(),
    );

    if (invalidStepIndex !== -1) {
      return `Step ${invalidStepIndex + 1} is missing required fields (subject, from name, or from email).`;
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setApiResponse(null);

    const validationMessage = validateForm();
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    const payload = {
      flowName: flowName.trim(),
      trigger: {
        type: triggerType,
        id: triggerId.trim(),
      },
      steps: steps.map((step) => ({
        internalName: step.internalName.trim(),
        subjectLine: step.subjectLine.trim(),
        previewText: step.previewText.trim(),
        fromEmail: step.fromEmail.trim(),
        fromName: step.fromName.trim(),
        replyToEmail: (step.replyToEmail || step.fromEmail).trim(),
        ccEmail: step.ccEmail.trim(),
        bccEmail: step.bccEmail.trim(),
        templateId: step.templateId.trim(),
        smartSendingEnabled: step.smartSendingEnabled,
        status: step.status,
        delay: step.delayEnabled
          ? {
              value: Number.isFinite(step.delayValue)
                ? Math.max(0, Math.round(step.delayValue))
                : 0,
              unit: step.delayUnit,
              timezone: step.delayTimezone,
            }
          : null,
        customTracking: step.addTrackingParams
          ? step.trackingRows
              .map((row) => ({
                param: row.param.trim(),
                value: row.value.trim(),
              }))
              .filter((row) => row.param && row.value)
          : [],
      })),
    };

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/flows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data: CreateFlowResponse = await response.json();

      if (!response.ok) {
        setFormError(
          data.error ??
            "The Klaviyo API returned an error. Review the details and try again.",
        );
        setApiResponse(data);
        return;
      }

      setApiResponse(data);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unexpected error creating Klaviyo flow.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-12 text-slate-100">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 md:grid-cols-[2fr_1fr]">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Klaviyo Email Sequence Builder
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Configure a flow, add email steps, and submit to create the sequence
            inside your Klaviyo account via the official API.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-xl shadow-slate-900/30 backdrop-blur"
          >
            <section>
              <h2 className="text-lg font-medium text-white">Flow Settings</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-medium text-slate-200">Flow name</span>
                  <input
                    className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                    placeholder="Welcome series"
                    value={flowName}
                    onChange={(event) => setFlowName(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-medium text-slate-200">
                    Trigger type
                  </span>
                  <select
                    className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                    value={triggerType}
                    onChange={(event) =>
                      setTriggerType(event.target.value as TriggerType)
                    }
                  >
                    <option value="list">List</option>
                    <option value="segment">Segment</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm md:col-span-2">
                  <span className="font-medium text-slate-200">
                    Trigger identifier
                  </span>
                  <input
                    className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                    placeholder={
                      triggerType === "list"
                        ? "List ID (e.g. YyZxA)"
                        : "Segment ID (e.g. Px1Ab)"
                    }
                    value={triggerId}
                    onChange={(event) => setTriggerId(event.target.value)}
                  />
                </label>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-white">
                  Email steps
                </h2>
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="rounded-lg border border-indigo-500 px-4 py-2 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/10 focus-visible:outline-none focus-visible:ring focus-visible:ring-indigo-500/40"
                >
                  Add step
                </button>
              </div>

              <div className="space-y-8">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="space-y-6 rounded-xl border border-slate-800 bg-slate-950/40 p-6 shadow-inner shadow-slate-950/30"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-white">
                          Step {index + 1}
                        </h3>
                        <p className="text-xs text-slate-400">
                          Configure delay, content, and delivery settings for
                          this email.
                        </p>
                      </div>
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(step.id)}
                          className="rounded-lg border border-transparent px-3 py-1 text-xs font-medium text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring focus-visible:ring-rose-500/40"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="flex flex-col gap-2 text-xs md:col-span-1">
                        <span className="font-medium uppercase tracking-wide text-slate-400">
                          Internal name
                        </span>
                        <input
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                          placeholder="Welcome email #1"
                          value={step.internalName}
                          onChange={(event) =>
                            updateStep(
                              step.id,
                              "internalName",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-xs md:col-span-2">
                        <span className="font-medium uppercase tracking-wide text-slate-400">
                          Subject line*
                        </span>
                        <input
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                          placeholder="Thanks for joining!"
                          value={step.subjectLine}
                          onChange={(event) =>
                            updateStep(
                              step.id,
                              "subjectLine",
                              event.target.value,
                            )
                          }
                          required
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-xs md:col-span-3">
                        <span className="font-medium uppercase tracking-wide text-slate-400">
                          Preview text
                        </span>
                        <input
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                          placeholder="Sneak peek copy that appears in inbox previews"
                          value={step.previewText}
                          onChange={(event) =>
                            updateStep(
                              step.id,
                              "previewText",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="flex flex-col gap-2 text-xs">
                        <span className="font-medium uppercase tracking-wide text-slate-400">
                          From name*
                        </span>
                        <input
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                          placeholder="Brand team"
                          value={step.fromName}
                          onChange={(event) =>
                            updateStep(step.id, "fromName", event.target.value)
                          }
                          required
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-xs">
                        <span className="font-medium uppercase tracking-wide text-slate-400">
                          From email*
                        </span>
                        <input
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                          placeholder="hello@example.com"
                          value={step.fromEmail}
                          onChange={(event) =>
                            updateStep(
                              step.id,
                              "fromEmail",
                              event.target.value,
                            )
                          }
                          required
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-xs">
                        <span className="font-medium uppercase tracking-wide text-slate-400">
                          Reply-to email
                        </span>
                        <input
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                          placeholder="support@example.com"
                          value={step.replyToEmail}
                          onChange={(event) =>
                            updateStep(
                              step.id,
                              "replyToEmail",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-xs">
                        <span className="font-medium uppercase tracking-wide text-slate-400">
                          Template ID (optional)
                        </span>
                        <input
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                          placeholder="Template ID"
                          value={step.templateId}
                          onChange={(event) =>
                            updateStep(
                              step.id,
                              "templateId",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-xs">
                        <span className="font-medium uppercase tracking-wide text-slate-400">
                          CC email
                        </span>
                        <input
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                          placeholder="cc@example.com"
                          value={step.ccEmail}
                          onChange={(event) =>
                            updateStep(step.id, "ccEmail", event.target.value)
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-xs">
                        <span className="font-medium uppercase tracking-wide text-slate-400">
                          BCC email
                        </span>
                        <input
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                          placeholder="bcc@example.com"
                          value={step.bccEmail}
                          onChange={(event) =>
                            updateStep(step.id, "bccEmail", event.target.value)
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-xs">
                        <span className="font-medium uppercase tracking-wide text-slate-400">
                          Delivery status
                        </span>
                        <select
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                          value={step.status}
                          onChange={(event) =>
                            updateStep(
                              step.id,
                              "status",
                              event.target.value as StepStatus,
                            )
                          }
                        >
                          <option value="draft">Draft</option>
                          <option value="live">Live</option>
                          <option value="manual">Manual</option>
                          <option value="disabled">Disabled</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-3 text-xs">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-indigo-500 focus:ring-0"
                          checked={step.smartSendingEnabled}
                          onChange={(event) =>
                            updateStep(
                              step.id,
                              "smartSendingEnabled",
                              event.target.checked,
                            )
                          }
                        />
                        <span className="font-medium uppercase tracking-wide text-slate-400">
                          Enable smart sending
                        </span>
                      </label>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                      <label className="flex items-center justify-between gap-4 text-xs">
                        <div>
                          <span className="font-semibold uppercase tracking-wide text-slate-300">
                            Add delay before send
                          </span>
                          <p className="mt-1 text-[11px] text-slate-400">
                            Inserts a time delay action before this email.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-indigo-500 focus:ring-0"
                          checked={step.delayEnabled}
                          onChange={(event) =>
                            updateStep(
                              step.id,
                              "delayEnabled",
                              event.target.checked,
                            )
                          }
                        />
                      </label>

                      {step.delayEnabled && (
                        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                          <label className="flex flex-col gap-2 text-xs">
                            <span className="font-medium uppercase tracking-wide text-slate-400">
                              Value
                            </span>
                            <input
                              type="number"
                              min={0}
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                              value={step.delayValue}
                              onChange={(event) =>
                                updateStep(
                                  step.id,
                                  "delayValue",
                                  Number(event.target.value),
                                )
                              }
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-xs">
                            <span className="font-medium uppercase tracking-wide text-slate-400">
                              Units
                            </span>
                            <select
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                              value={step.delayUnit}
                              onChange={(event) =>
                                updateStep(
                                  step.id,
                                  "delayUnit",
                                  event.target.value as DelayUnit,
                                )
                              }
                            >
                              <option value="minutes">Minutes</option>
                              <option value="hours">Hours</option>
                              <option value="days">Days</option>
                            </select>
                          </label>
                          <label className="flex flex-col gap-2 text-xs">
                            <span className="font-medium uppercase tracking-wide text-slate-400">
                              Timezone
                            </span>
                            <input
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                              value={step.delayTimezone}
                              onChange={(event) =>
                                updateStep(
                                  step.id,
                                  "delayTimezone",
                                  event.target.value,
                                )
                              }
                              placeholder="profile"
                            />
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                      <label className="flex items-center justify-between gap-4 text-xs">
                        <div>
                          <span className="font-semibold uppercase tracking-wide text-slate-300">
                            Custom tracking parameters
                          </span>
                          <p className="mt-1 text-[11px] text-slate-400">
                            Define additional UTM parameters for this email.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-indigo-500 focus:ring-0"
                          checked={step.addTrackingParams}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            updateStep(step.id, "addTrackingParams", checked);
                            if (checked && step.trackingRows.length === 0) {
                              addTrackingRow(step.id);
                            }
                            if (!checked) {
                              updateStep(step.id, "trackingRows", []);
                            }
                          }}
                        />
                      </label>

                      {step.addTrackingParams && (
                        <div className="mt-4 space-y-3">
                          {step.trackingRows.map((row) => (
                            <div
                              key={row.id}
                              className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                            >
                              <input
                                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                                placeholder="utm_medium"
                                value={row.param}
                                onChange={(event) =>
                                  updateTrackingRow(
                                    step.id,
                                    row.id,
                                    "param",
                                    event.target.value,
                                  )
                                }
                              />
                              <input
                                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-indigo-400 focus:ring focus:ring-indigo-500/20"
                                placeholder="email"
                                value={row.value}
                                onChange={(event) =>
                                  updateTrackingRow(
                                    step.id,
                                    row.id,
                                    "value",
                                    event.target.value,
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="rounded-lg border border-transparent px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:bg-slate-500/10 focus-visible:outline-none focus-visible:ring focus-visible:ring-indigo-500/40"
                                onClick={() => removeTrackingRow(step.id, row.id)}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addTrackingRow(step.id)}
                            className="rounded-lg border border-indigo-500 px-3 py-2 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/10 focus-visible:outline-none focus-visible:ring focus-visible:ring-indigo-500/40"
                          >
                            Add parameter
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {formError && (
              <div className="rounded-lg border border-rose-400/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-3 rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-500/60"
            >
              {isSubmitting ? "Creating flow..." : "Create Klaviyo flow"}
            </button>
          </form>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Deployment checklist
            </h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-xs text-slate-300">
              <li>Set the `KLAVIYO_API_KEY` environment variable.</li>
              <li>Confirm trigger IDs (list or segment) exist in Klaviyo.</li>
              <li>After creation, adjust templates and creatives in Klaviyo.</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              API response
            </h2>
            {flowSummary ? (
              <div className="mt-3 space-y-2 text-xs text-emerald-200">
                <p>
                  Flow <span className="font-semibold">{flowSummary.name}</span>{" "}
                  created.
                </p>
                <p>
                  Flow ID:{" "}
                  <span className="font-mono">{flowSummary.id}</span>
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                Submit the form to see Klaviyo API responses.
              </p>
            )}

            {detailsString && (
              <pre className="mt-4 max-h-64 overflow-auto rounded-lg bg-slate-950/80 p-3 text-[11px] leading-relaxed text-slate-200">
                {detailsString}
              </pre>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

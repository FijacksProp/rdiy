type FormType = "newsletter" | "contact" | "donation" | "donation-confirmation";

interface ApiResponse {
  ok: boolean;
  message: string;
  reference?: string;
  emailSent?: boolean;
  checkoutUrl?: string;
  status?: "pending" | "completed" | "failed" | "cancelled" | "expired";
  amount?: string;
  currency?: string;
  bankTransfer?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    currency: string;
    amount: string;
    reference: string;
  };
}

function responseFailureMessage(response: Response, requestId: string | null): string {
  const supportReference = requestId ? ` Support reference: ${requestId}.` : "";

  switch (response.status) {
    case 404:
      return `The website could not find the requested service (HTTP 404). Please refresh the page and try again.${supportReference}`;
    case 500:
      return `The server encountered an error while processing this request (HTTP 500). Please try again shortly.${supportReference}`;
    case 502:
      return `The payment service could not be reached correctly (HTTP 502). Please try again or use bank transfer.${supportReference}`;
    case 503:
      return `The payment service is temporarily unavailable (HTTP 503). Please try again or use bank transfer.${supportReference}`;
    case 504:
      return `The payment request timed out (HTTP 504). Please wait a moment before trying again.${supportReference}`;
    default:
      return `The server returned an invalid response (HTTP ${response.status}). Please try again shortly.${supportReference}`;
  }
}

async function readApiResponse(response: Response): Promise<ApiResponse> {
  const requestId = response.headers.get("x-vercel-id");
  const body = await response.text();

  if (!body.trim()) throw new Error(responseFailureMessage(response, requestId));

  let result: unknown;
  try {
    result = JSON.parse(body) as unknown;
  } catch {
    throw new Error(responseFailureMessage(response, requestId));
  }

  if (
    typeof result !== "object"
    || result === null
    || typeof (result as Partial<ApiResponse>).ok !== "boolean"
    || typeof (result as Partial<ApiResponse>).message !== "string"
  ) {
    throw new Error(responseFailureMessage(response, requestId));
  }

  return result as ApiResponse;
}

const toggle = document.getElementById("menu-toggle");
const nav = document.getElementById("nav");

function closeNavigation(): void {
  if (!(toggle instanceof HTMLButtonElement) || !nav) return;

  nav.classList.remove("active");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Open navigation menu");
  toggle.textContent = "☰";
}

if (toggle instanceof HTMLButtonElement && nav) {
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = nav.classList.toggle("active");

    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
    toggle.textContent = isOpen ? "×" : "☰";
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) closeNavigation();
  });

  document.addEventListener("click", (event) => {
    if (event.target instanceof Node && !nav.contains(event.target)) closeNavigation();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("active")) {
      closeNavigation();
      toggle.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 991) closeNavigation();
  });
}

const currentPage = window.location.pathname.split("/").pop() || "index.html";

document.querySelectorAll<HTMLAnchorElement>(".nav a").forEach((link) => {
  const linkPage = new URL(link.href, window.location.href).pathname.split("/").pop();

  if (linkPage === currentPage) {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  }
});

document.querySelectorAll<HTMLElement>("[data-current-year]").forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});

function setupAdaptiveContactForm(): void {
  const form = document.querySelector<HTMLFormElement>('[data-api-form="contact"]');
  const typeSelect = document.getElementById("contact-type");
  const help = document.getElementById("contact-type-help");

  if (!form || !(typeSelect instanceof HTMLSelectElement)) return;

  const conditionalFields = Array.from(form.querySelectorAll<HTMLElement>("[data-contact-types]"));
  const helpText: Record<string, string> = {
    "": "Choose the closest option. The form will show any additional details we need.",
    "general-inquiry": "For questions that do not fit another category.",
    partnership: "Tell us who you represent and the kind of partnership you would like to explore.",
    collaboration: "Share the organization and programme area you would like to work on with RDIY.",
    "donation-support": "Ask about making a donation or provide a reference for an existing donation.",
    volunteering: "Tell us how you would like to contribute and when you are generally available.",
    "media-request": "Provide the media outlet or organization and any relevant response date."
  };

  const updateFields = () => {
    const selectedType = typeSelect.value;

    conditionalFields.forEach((field) => {
      const visibleFor = field.dataset.contactTypes?.split(/\s+/) ?? [];
      const isVisible = visibleFor.includes(selectedType);
      field.hidden = !isVisible;

      field.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")
        .forEach((control) => {
          control.disabled = !isVisible;
          control.required = isVisible && control.hasAttribute("data-required-when-visible");
        });
    });

    if (help) {
      help.textContent = helpText[selectedType]
        ?? "Choose the closest option. The form will show any additional details we need.";
    }
  };

  typeSelect.addEventListener("change", updateFields);
  form.addEventListener("reset", () => window.setTimeout(updateFields, 0));
  updateFields();
}

setupAdaptiveContactForm();

function getStatusElement(form: HTMLFormElement, formType: FormType): HTMLElement | null {
  return form.querySelector<HTMLElement>(".form-status")
    ?? document.getElementById(`${formType}-status`);
}

function setFormState(status: HTMLElement | null, message: string, state: "success" | "error" | "pending"): void {
  if (!status) return;

  status.textContent = message;
  status.classList.remove("is-success", "is-error", "is-pending");
  status.classList.add(`is-${state}`);
}

type BankTransferDetails = NonNullable<ApiResponse["bankTransfer"]>;

function showBankTransferDetails(details: BankTransferDetails): void {
  const panel = document.getElementById("bank-transfer-panel");
  if (!(panel instanceof HTMLElement)) return;

  Object.entries(details).forEach(([field, value]) => {
    const target = panel.querySelector<HTMLElement>(`[data-bank-transfer-field="${field}"]`);
    if (target) target.textContent = value;
  });

  panel.hidden = false;
  panel.focus({ preventScroll: true });
  panel.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start"
  });
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const fallback = document.createElement("textarea");
  fallback.value = value;
  fallback.setAttribute("readonly", "");
  fallback.style.position = "fixed";
  fallback.style.opacity = "0";
  document.body.append(fallback);
  fallback.select();
  const copied = document.execCommand("copy");
  fallback.remove();
  if (!copied) throw new Error("Copy failed");
}

function setupBankDetailCopies(): void {
  const panel = document.getElementById("bank-transfer-panel");
  const copyStatus = document.getElementById("bank-copy-status");
  if (!(panel instanceof HTMLElement)) return;

  const setCopyStatus = (message: string, isError = false) => {
    if (!copyStatus) return;
    copyStatus.textContent = message;
    copyStatus.classList.toggle("is-error", isError);
  };

  panel.querySelectorAll<HTMLButtonElement>("[data-copy-transfer-field]").forEach((button) => {
    button.addEventListener("click", async () => {
      const field = button.dataset.copyTransferField;
      const target = field
        ? panel.querySelector<HTMLElement>(`[data-bank-transfer-field="${field}"]`)
        : null;
      if (!target) return;

      try {
        await copyText(target.textContent?.trim() ?? "");
        setCopyStatus(`${button.textContent?.trim() || "Detail"} copied.`);
      } catch {
        setCopyStatus("Copying was blocked. Please press and hold the detail to copy it.", true);
      }
    });
  });

  panel.querySelector<HTMLButtonElement>("[data-copy-bank-transfer]")?.addEventListener("click", async () => {
    const value = [
      `Amount: ${panel.querySelector<HTMLElement>('[data-bank-transfer-field="amount"]')?.textContent?.trim()} ${panel.querySelector<HTMLElement>('[data-bank-transfer-field="currency"]')?.textContent?.trim()}`,
      `Bank: ${panel.querySelector<HTMLElement>('[data-bank-transfer-field="bankName"]')?.textContent?.trim()}`,
      `Account name: ${panel.querySelector<HTMLElement>('[data-bank-transfer-field="accountName"]')?.textContent?.trim()}`,
      `Account number: ${panel.querySelector<HTMLElement>('[data-bank-transfer-field="accountNumber"]')?.textContent?.trim()}`,
      `Reference: ${panel.querySelector<HTMLElement>('[data-bank-transfer-field="reference"]')?.textContent?.trim()}`
    ].join("\n");

    try {
      await copyText(value);
      setCopyStatus("All transfer details copied.");
    } catch {
      setCopyStatus("Copying was blocked. Please copy each detail individually.", true);
    }
  });
}

setupBankDetailCopies();

async function submitApiForm(form: HTMLFormElement, formType: FormType, submitter?: HTMLElement | null): Promise<void> {
  const status = getStatusElement(form, formType);
  const submitButton = submitter instanceof HTMLButtonElement
    ? submitter
    : form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const submitButtons = Array.from(form.querySelectorAll<HTMLButtonElement>('button[type="submit"]'));
  const originalButtonText = submitButton?.textContent ?? "Submit";

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  const isMonimeCheckout = formType === "donation" && submitter?.dataset.donationFlow !== "bank";
  const endpoint = submitter instanceof HTMLButtonElement && submitter.formAction
    ? submitter.formAction
    : form.action;
  setFormState(status, isMonimeCheckout ? "Preparing secure checkout…" : "Submitting…", "pending");

  if (submitButton) {
    submitButtons.forEach((button) => { button.disabled = true; });
    submitButton.textContent = isMonimeCheckout ? "Preparing checkout…" : "Submitting…";
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await readApiResponse(response);
    if (!response.ok || !result.ok) throw new Error(result.message || "The request could not be completed.");

    if (isMonimeCheckout) {
      if (!result.checkoutUrl) throw new Error("The secure checkout link was not returned. Please try again.");
      setFormState(status, "Secure checkout is ready. Redirecting to Monime…", "success");
      window.location.assign(result.checkoutUrl);
      return;
    }

    let message = result.message;
    if (result.reference) message += ` Your reference is ${result.reference}.`;
    if (formType === "donation" && result.bankTransfer) {
      message += result.emailSent
        ? " The same instructions have been emailed to you."
        : " Please save or copy the transfer details shown below.";
      showBankTransferDetails(result.bankTransfer);
    }

    setFormState(status, message, "success");

    if (formType === "donation" && result.reference) {
      const confirmationReference = document.getElementById("confirmation-donation-reference");
      if (confirmationReference instanceof HTMLInputElement) confirmationReference.value = result.reference;

      const confirmationSender = document.getElementById("confirmation-sender-name");
      if (confirmationSender instanceof HTMLInputElement && typeof payload.fullName === "string") {
        confirmationSender.value = payload.fullName;
      }
    }

    form.reset();
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Something went wrong. Please try again later.";
    setFormState(status, message, "error");
  } finally {
    if (submitButton) {
      submitButtons.forEach((button) => { button.disabled = false; });
      submitButton.textContent = originalButtonText.trim();
    }
  }
}

document.querySelectorAll<HTMLFormElement>("[data-api-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const submitter = event instanceof SubmitEvent && event.submitter instanceof HTMLElement
      ? event.submitter
      : null;
    void submitApiForm(form, form.dataset.apiForm as FormType, submitter);
  });
});

function paymentStatusMessage(status: ApiResponse["status"], reference: string): { message: string; state: "success" | "error" | "pending" } {
  switch (status) {
    case "completed":
      return { message: `Thank you. Your donation ${reference} has been confirmed. A receipt will be emailed to you.`, state: "success" };
    case "failed":
      return { message: `Payment ${reference} was not completed. No successful donation was recorded. You can try again below.`, state: "error" };
    case "cancelled":
      return { message: `Checkout ${reference} was cancelled. No payment was taken.`, state: "error" };
    case "expired":
      return { message: `Checkout ${reference} expired before payment. Please start a new donation.`, state: "error" };
    default:
      return { message: `Payment ${reference} is still being confirmed. This page will check again automatically.`, state: "pending" };
  }
}

async function showReturnedPaymentStatus(): Promise<void> {
  const panel = document.getElementById("payment-result");
  const message = document.getElementById("payment-result-message");
  if (!(panel instanceof HTMLElement) || !(message instanceof HTMLElement)) return;

  const parameters = new URLSearchParams(window.location.search);
  const paymentReturn = parameters.get("payment");
  const reference = parameters.get("reference")?.trim().toUpperCase();
  if (!paymentReturn || !reference) return;

  panel.hidden = false;
  if (paymentReturn === "cancelled") {
    const display = paymentStatusMessage("cancelled", reference);
    setFormState(message, display.message, display.state);
    return;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(`/api/donation-status?reference=${encodeURIComponent(reference)}`, {
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });
      const result = await readApiResponse(response);
      if (!response.ok || !result.ok) throw new Error(result.message);
      const display = paymentStatusMessage(result.status, reference);
      setFormState(message, display.message, display.state);
      if (result.status !== "pending") return;
    } catch {
      setFormState(message, `We have your reference ${reference}, but confirmation is temporarily unavailable. Please check again shortly.`, "pending");
    }
    await new Promise((resolve) => window.setTimeout(resolve, 3_000));
  }
}

void showReturnedPaymentStatus();

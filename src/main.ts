type FormType = "newsletter" | "contact" | "donation" | "donation-confirmation";

interface ApiResponse {
  ok: boolean;
  message: string;
  reference?: string;
  instructions?: string;
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

async function submitApiForm(form: HTMLFormElement, formType: FormType): Promise<void> {
  const status = getStatusElement(form, formType);
  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const originalButtonText = submitButton?.textContent ?? "Submit";

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  setFormState(status, "Submitting…", "pending");

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Submitting…";
  }

  try {
    const response = await fetch(form.action, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json() as ApiResponse;
    if (!response.ok || !result.ok) throw new Error(result.message || "The request could not be completed.");

    let message = result.message;
    if (result.reference) message += ` Your reference is ${result.reference}.`;
    if (result.instructions) message += ` ${result.instructions}`;

    setFormState(status, message, "success");

    if (formType === "donation" && result.reference) {
      const confirmationReference = document.getElementById("confirmation-donation-reference");
      if (confirmationReference instanceof HTMLInputElement) confirmationReference.value = result.reference;
    }

    form.reset();
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Something went wrong. Please try again later.";
    setFormState(status, message, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText.trim();
    }
  }
}

document.querySelectorAll<HTMLFormElement>("[data-api-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitApiForm(form, form.dataset.apiForm as FormType);
  });
});

export type NexoraDialogTone = "info" | "success" | "warning" | "danger";

export type NexoraAlertOptions = {
  title?: string;
  message: string;
  tone?: NexoraDialogTone;
  confirmText?: string;
};

export type NexoraConfirmOptions = NexoraAlertOptions & {
  cancelText?: string;
};

export type NexoraPromptOptions = NexoraConfirmOptions & {
  defaultValue?: string;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "url";
};

export type NexoraDialogApi = {
  alert: (options: NexoraAlertOptions) => Promise<void>;
  confirm: (options: NexoraConfirmOptions) => Promise<boolean>;
  prompt: (options: NexoraPromptOptions) => Promise<string | null>;
};

declare global {
  interface Window {
    nexoraDialog?: NexoraDialogApi;
  }
}

function toMessage(input: string | NexoraAlertOptions) {
  return typeof input === "string" ? { message: input } : input;
}

export async function nexoraAlert(input: string | NexoraAlertOptions) {
  const options = toMessage(input);
  if (typeof window === "undefined" || !window.nexoraDialog) {
    return;
  }

  await window.nexoraDialog.alert(options);
}

export async function nexoraConfirm(input: string | NexoraConfirmOptions) {
  const options = typeof input === "string" ? { message: input } : input;
  if (typeof window === "undefined" || !window.nexoraDialog) {
    return typeof window !== "undefined" ? window.confirm(options.message) : false;
  }

  return window.nexoraDialog.confirm(options);
}

export async function nexoraPrompt(input: string | NexoraPromptOptions) {
  const options = typeof input === "string" ? { message: input } : input;
  if (typeof window === "undefined" || !window.nexoraDialog) {
    return typeof window !== "undefined"
      ? window.prompt(options.message, options.defaultValue || "")
      : null;
  }

  return window.nexoraDialog.prompt(options);
}

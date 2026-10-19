type DesktopRuntime = {
  nexoraDesktop?: { isDesktop?: boolean; isGameDesktop?: boolean };
  navigator?: { userAgent: string };
};

// Display routing only. Native capabilities and authentication still require IPC.
export function isInstalledGameRuntime(runtime: DesktopRuntime): boolean {
  if (runtime.nexoraDesktop?.isGameDesktop === true) return true;
  const agent = runtime.navigator?.userAgent ?? '';
  return /\bElectron\//i.test(agent) &&
    /\b(?:nexora-card-game|NexoraCardGame|NEXORA CARD GAME)\/[\d.]+/i.test(agent);
}

// Reads the server's settings from the environment, and refuses to start in an unsafe setup.

export type ServerConfig = {
  port: number;
  host: string;
  demo: boolean;
  hostPasscode?: string;
};

export const MIN_PASSCODE_LENGTH = 12;

// allowOpen is for local development only (the dev scripts pass --allow-open):
// it lets the server run without a host passcode.
export function readConfig(env: Record<string, string | undefined>, allowOpen = false): ServerConfig {
  const demo = env.DEMO === "1" || env.DEMO === "true";
  const passcode =
    env.HOST_PASSCODE === undefined || env.HOST_PASSCODE === "" ? undefined : env.HOST_PASSCODE;

  if (passcode !== undefined && passcode.length < MIN_PASSCODE_LENGTH) {
    throw new Error(`HOST_PASSCODE must be at least ${MIN_PASSCODE_LENGTH} characters long.`);
  }
  // Fail closed: a real site must never run with room creation open to everyone.
  if (passcode === undefined && !demo && !allowOpen) {
    throw new Error(
      "HOST_PASSCODE is not set. A site that is not a demo needs one so that only the host can create rooms. " +
        "(Set DEMO=1 for a demo site, or pass --allow-open for local development.)",
    );
  }
  return {
    port: Number(env.PORT ?? 3001),
    host: env.HOST ?? "0.0.0.0",
    demo,
    hostPasscode: passcode,
  };
}

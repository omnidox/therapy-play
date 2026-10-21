import { useEffect, useState } from "react";

export type SiteConfig = { demo: boolean; passcodeRequired: boolean; loaded: boolean };

// What the server says about itself: is it a demo site, and does creating a room need a passcode?
export function useConfig(): SiteConfig {
  const [config, setConfig] = useState<SiteConfig>({ demo: false, passcodeRequired: false, loaded: false });

  useEffect(() => {
    let active = true;
    fetch("/config")
      .then((res) => (res.ok ? res.json() : {}))
      .then((body: { demo?: boolean; passcodeRequired?: boolean }) => {
        if (active) {
          setConfig({
            demo: body.demo === true,
            passcodeRequired: body.passcodeRequired === true,
            loaded: true,
          });
        }
      })
      .catch(() => {
        // No config means no banner and no passcode field; a locked server still answers 401.
        if (active) setConfig({ demo: false, passcodeRequired: false, loaded: true });
      });
    return () => {
      active = false;
    };
  }, []);

  return config;
}

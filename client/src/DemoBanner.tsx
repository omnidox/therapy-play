import { useEffect, useState } from "react";

// On a demo site (the server's DEMO setting) every page starts with a plain warning.
export function DemoBanner() {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/config")
      .then((res) => (res.ok ? res.json() : { demo: false }))
      .then((config: { demo?: boolean }) => {
        if (active) setDemo(config.demo === true);
      })
      .catch(() => {
        // No config means no banner; the app still works.
      });
    return () => {
      active = false;
    };
  }, []);

  if (!demo) return null;
  return (
    <p role="note" className="demo-banner">
      <strong>Demo site.</strong> Use made-up content only. Do not enter real names or any information about a
      real person.
    </p>
  );
}

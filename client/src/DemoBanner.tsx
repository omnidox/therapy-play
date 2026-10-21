import { useConfig } from "./useConfig";

// On a demo site (the server's DEMO setting) every page starts with a plain warning.
export function DemoBanner() {
  const { demo } = useConfig();
  if (!demo) return null;
  return (
    <p role="note" className="demo-banner">
      <strong>Demo site.</strong> Use made-up content only. Do not enter real names or any information about a
      real person.
    </p>
  );
}

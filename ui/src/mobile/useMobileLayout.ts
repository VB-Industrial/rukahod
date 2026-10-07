import { useEffect, useState } from "preact/hooks";
// A query override lets operators preview either layout on their workstation.
const QUERY = "(max-width: 950px), (pointer: coarse) and (max-width: 1400px)";
export function useMobileLayout() {
  const override = new URLSearchParams(window.location.search).get("layout");
  const [media] = useState(() => window.matchMedia(QUERY));
  const [matches, setMatches] = useState(media.matches);
  useEffect(() => {
    const update = () => setMatches(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return override === "mobile" || (override !== "desktop" && matches);
}

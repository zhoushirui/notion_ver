import { useEffect, useState } from "react";

export type Route =
  | { name: "notebooks" }
  | { name: "documents"; notebookId: string }
  | { name: "editor"; notebookId: string; docId: string };

function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, "");
  const parts = clean.split("/").filter(Boolean);
  if (parts[0] === "notebook" && parts[1] && parts[2] === "doc" && parts[3]) {
    return { name: "editor", notebookId: parts[1], docId: parts[3] };
  }
  if (parts[0] === "notebook" && parts[1]) {
    return { name: "documents", notebookId: parts[1] };
  }
  return { name: "notebooks" };
}

export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRouteState] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRouteState(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const setRoute = (r: Route) => {
    const hash =
      r.name === "notebooks"
        ? "#/notebooks"
        : r.name === "documents"
        ? `#/notebook/${r.notebookId}`
        : `#/notebook/${r.notebookId}/doc/${r.docId}`;
    window.location.hash = hash;
  };

  return [route, setRoute];
}

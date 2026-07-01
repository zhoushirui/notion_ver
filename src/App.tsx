import React from "react";
import { useHashRoute } from "./useHashRoute";
import NotebooksPage from "./pages/NotebooksPage";
import DocumentsPage from "./pages/DocumentsPage";
import EditorPage from "./pages/EditorPage";
import { useWorkspace } from "./store";

export default function App() {
  const [route, setRoute] = useHashRoute();
  const { getNotebook, getDocument } = useWorkspace();

  if (route.name === "documents") {
    const notebook = getNotebook(route.notebookId);
    if (!notebook) {
      setRoute({ name: "notebooks" });
      return null;
    }
    return <DocumentsPage notebook={notebook} onNavigate={setRoute} />;
  }

  if (route.name === "editor") {
    const notebook = getNotebook(route.notebookId);
    const doc = getDocument(route.docId);
    if (!notebook || !doc) {
      setRoute({ name: "notebooks" });
      return null;
    }
    return <EditorPage notebook={notebook} doc={doc} onNavigate={setRoute} />;
  }

  return <NotebooksPage onNavigate={setRoute} />;
}

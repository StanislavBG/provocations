import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Document, Lens, Provocation, OutlineItem, LensType, WorkspaceState, ReferenceDocument, EditHistoryEntry } from "@shared/schema";

interface WorkspaceContextType {
  state: WorkspaceState;
  setDocument: (doc: Document | null) => void;
  setObjective: (objective: string) => void;
  setReferenceDocuments: (docs: ReferenceDocument[]) => void;
  addReferenceDocument: (doc: ReferenceDocument) => void;
  removeReferenceDocument: (id: string) => void;
  addEditHistoryEntry: (entry: EditHistoryEntry) => void;
  clearEditHistory: () => void;
  setLenses: (lenses: Lens[]) => void;
  setActiveLens: (lens: LensType | null) => void;
  setProvocations: (provocations: Provocation[]) => void;
  updateProvocationStatus: (id: string, status: Provocation["status"]) => void;
  setOutline: (outline: OutlineItem[]) => void;
  addOutlineItem: (item: OutlineItem) => void;
  updateOutlineItem: (id: string, updates: Partial<OutlineItem>) => void;
  removeOutlineItem: (id: string) => void;
  reorderOutline: (items: OutlineItem[]) => void;
  setPhase: (phase: WorkspaceState["currentPhase"]) => void;
  reset: () => void;
}

const initialState: WorkspaceState = {
  document: null,
  objective: "",
  referenceDocuments: [],
  editHistory: [],
  lenses: [],
  activeLens: null,
  provocations: [],
  outline: [],
  currentPhase: "input",
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(initialState);

  const setDocument = useCallback((doc: Document | null) => {
    setState((prev) => ({ ...prev, document: doc }));
  }, []);

  const setObjective = useCallback((objective: string) => {
    setState((prev) => ({ ...prev, objective }));
  }, []);

  const setReferenceDocuments = useCallback((referenceDocuments: ReferenceDocument[]) => {
    setState((prev) => ({ ...prev, referenceDocuments }));
  }, []);

  const addReferenceDocument = useCallback((doc: ReferenceDocument) => {
    setState((prev) => ({
      ...prev,
      referenceDocuments: [...prev.referenceDocuments, doc],
    }));
  }, []);

  const removeReferenceDocument = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      referenceDocuments: prev.referenceDocuments.filter((d) => d.id !== id),
    }));
  }, []);

  const addEditHistoryEntry = useCallback((entry: EditHistoryEntry) => {
    setState((prev) => ({
      ...prev,
      // Keep last 10 entries to avoid context bloat
      editHistory: [...prev.editHistory.slice(-9), entry],
    }));
  }, []);

  const clearEditHistory = useCallback(() => {
    setState((prev) => ({ ...prev, editHistory: [] }));
  }, []);

  const setLenses = useCallback((lenses: Lens[]) => {
    setState((prev) => ({ ...prev, lenses }));
  }, []);

  const setActiveLens = useCallback((lens: LensType | null) => {
    setState((prev) => ({ ...prev, activeLens: lens }));
  }, []);

  const setProvocations = useCallback((provocations: Provocation[]) => {
    setState((prev) => ({ ...prev, provocations }));
  }, []);

  const updateProvocationStatus = useCallback((id: string, status: Provocation["status"]) => {
    setState((prev) => ({
      ...prev,
      provocations: prev.provocations.map((p) =>
        p.id === id ? { ...p, status } : p
      ),
    }));
  }, []);

  const setOutline = useCallback((outline: OutlineItem[]) => {
    setState((prev) => ({ ...prev, outline }));
  }, []);

  const addOutlineItem = useCallback((item: OutlineItem) => {
    setState((prev) => ({
      ...prev,
      outline: [...prev.outline, item],
    }));
  }, []);

  const updateOutlineItem = useCallback((id: string, updates: Partial<OutlineItem>) => {
    setState((prev) => ({
      ...prev,
      outline: prev.outline.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  }, []);

  const removeOutlineItem = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      outline: prev.outline.filter((item) => item.id !== id),
    }));
  }, []);

  const reorderOutline = useCallback((items: OutlineItem[]) => {
    setState((prev) => ({ ...prev, outline: items }));
  }, []);

  const setPhase = useCallback((phase: WorkspaceState["currentPhase"]) => {
    setState((prev) => ({ ...prev, currentPhase: phase }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        state,
        setDocument,
        setObjective,
        setReferenceDocuments,
        addReferenceDocument,
        removeReferenceDocument,
        addEditHistoryEntry,
        clearEditHistory,
        setLenses,
        setActiveLens,
        setProvocations,
        updateProvocationStatus,
        setOutline,
        addOutlineItem,
        updateOutlineItem,
        removeOutlineItem,
        reorderOutline,
        setPhase,
        reset,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}

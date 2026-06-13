'use client';
import { createContext, useContext, useState } from 'react';

const BetslipContext = createContext(null);

export function BetslipProvider({ children }) {
  const [selections, setSelections] = useState([]);

  function addSelection(selection) {
    setSelections(prev => {
      const exists = prev.some(
        s => s.matchId === selection.matchId && s.outcome === selection.outcome
      );
      if (exists) return prev;
      return [...prev, selection];
    });
  }

  function removeSelection(matchId, outcome) {
    setSelections(prev =>
      prev.filter(s => !(s.matchId === matchId && s.outcome === outcome))
    );
  }

  return (
    <BetslipContext.Provider value={{ selections, addSelection, removeSelection }}>
      {children}
    </BetslipContext.Provider>
  );
}

export function useBetslip() {
  const ctx = useContext(BetslipContext);
  if (!ctx) throw new Error('useBetslip must be used inside BetslipProvider');
  return ctx;
}

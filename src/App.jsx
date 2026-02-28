import React from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { HistoryGameApp } from "./HistoryGameApp";
import "./history-game.css";

function App() {
  return (
    <ErrorBoundary>
      <HistoryGameApp />
    </ErrorBoundary>
  );
}

export default App;

import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import { App } from "./app/app";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

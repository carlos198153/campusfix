import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./styles.css";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});
const useHashRouter =
  location.protocol === "file:" ||
  import.meta.env.VITE_USE_HASH_ROUTER === "true";
const Router = useHashRouter ? HashRouter : BrowserRouter;
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router basename={useHashRouter ? undefined : import.meta.env.BASE_URL}>
        <App />
      </Router>
    </QueryClientProvider>
  </React.StrictMode>,
);

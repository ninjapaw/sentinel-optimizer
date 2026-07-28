import { useState, useEffect } from "react";
import {
  getAzureOpenAiConfig,
  saveAzureOpenAiConfig,
  clearAzureOpenAiConfig,
  type AzureOpenAiConfig,
} from "../lib/aiClient.js";

const DEFAULT_API_VERSION = "2024-12-01-preview";

export default function AiSettings() {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [deployment, setDeployment] = useState("");
  const [apiVersion, setApiVersion] = useState(DEFAULT_API_VERSION);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const cfg = getAzureOpenAiConfig();
    if (cfg) {
      setConfigured(true);
      setEndpoint(cfg.endpoint);
      // Never pre-fill the key field — force re-entry on edit for security
      setDeployment(cfg.deployment);
      setApiVersion(cfg.apiVersion);
    }
  }, []);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const cfg: AzureOpenAiConfig = {
      endpoint: endpoint.trim().replace(/\/$/, ""),
      apiKey: apiKey.trim(),
      deployment: deployment.trim(),
      apiVersion: apiVersion.trim() || DEFAULT_API_VERSION,
    };
    saveAzureOpenAiConfig(cfg);
    setConfigured(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleClear() {
    clearAzureOpenAiConfig();
    setConfigured(false);
    setEndpoint("");
    setApiKey("");
    setDeployment("");
    setApiVersion(DEFAULT_API_VERSION);
    setOpen(false);
  }

  return (
    <div className="ai-settings">
      <div className="ai-settings-bar">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "▲" : "▼"} Azure OpenAI
          {configured && <span className="badge badge-ok">configured</span>}
        </button>
        {configured && !open && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleClear}>
            Clear
          </button>
        )}
      </div>

      {open && (
        <form className="ai-settings-form" onSubmit={handleSave} autoComplete="off">
          <p className="ai-note">
            Your credentials are stored only in this browser (
            <code>localStorage</code>). Requests go directly from your browser to
            Azure OpenAI — nothing is sent to any first-party server.
          </p>

          <label className="field-label" htmlFor="aoi-endpoint">
            Endpoint
          </label>
          <input
            id="aoi-endpoint"
            type="url"
            className="field-input"
            placeholder="https://YOUR-RESOURCE.openai.azure.com"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            required
            autoComplete="off"
          />

          <label className="field-label" htmlFor="aoi-key">
            API key
          </label>
          <input
            id="aoi-key"
            type="password"
            className="field-input"
            placeholder={configured ? "(enter to replace)" : ""}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required={!configured}
            autoComplete="new-password"
          />

          <label className="field-label" htmlFor="aoi-deployment">
            Deployment name
          </label>
          <input
            id="aoi-deployment"
            type="text"
            className="field-input"
            placeholder="gpt-4o"
            value={deployment}
            onChange={(e) => setDeployment(e.target.value)}
            required
            autoComplete="off"
          />

          <label className="field-label" htmlFor="aoi-version">
            API version
          </label>
          <input
            id="aoi-version"
            type="text"
            className="field-input"
            value={apiVersion}
            onChange={(e) => setApiVersion(e.target.value)}
            required
            autoComplete="off"
          />

          <div className="row" style={{ gap: "0.5rem", marginTop: "0.5rem" }}>
            <button type="submit" className="btn btn-primary btn-sm">
              {saved ? "Saved ✓" : "Save"}
            </button>
            {configured && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleClear}>
                Clear
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

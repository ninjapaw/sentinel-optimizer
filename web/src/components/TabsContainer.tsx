/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { useState } from "react";
import type { ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  description?: string;
  content: ReactNode;
}

interface TabsContainerProps {
  tabs: TabItem[];
  defaultTabId?: string;
  verticalLayout?: boolean;
}

export function TabsContainer({ tabs, defaultTabId, verticalLayout = false }: TabsContainerProps) {
  const [activeTab, setActiveTab] = useState(defaultTabId || tabs[0]?.id || "");

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className="tabs-container" style={{ display: "flex", gap: "1.5rem", flexDirection: verticalLayout ? "column" : "row" }}>
      <div
        className="tabs-nav"
        style={{
          display: "flex",
          flexDirection: verticalLayout ? "row" : "column",
          gap: "0.75rem",
          minWidth: verticalLayout ? "100%" : "200px",
          padding: "1rem",
          backgroundColor: "var(--color-bg-secondary, #f5f5f5)",
          borderRadius: "8px",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
            style={{
              padding: "0.75rem 1rem",
              backgroundColor: activeTab === tab.id ? "var(--color-primary, #0078D4)" : "transparent",
              color: activeTab === tab.id ? "white" : "var(--color-text, #333)",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.95rem",
              fontWeight: activeTab === tab.id ? "600" : "500",
              textAlign: "left",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
            title={tab.description}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div
        className="tabs-content"
        style={{
          flex: 1,
          minHeight: "300px",
          animation: "fadeIn 0.2s ease",
        }}
      >
        {activeTabContent}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .tabs-container .tab-button:hover {
          background-color: var(--color-bg-hover, #e8e8e8);
          transform: translateX(2px);
        }

        .tabs-container .tab-button.active:hover {
          background-color: var(--color-primary-dark, #005a9e);
        }
      `}</style>
    </div>
  );
}

export default TabsContainer;

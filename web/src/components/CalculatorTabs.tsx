/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { lazy, Suspense } from "react";
import TabsContainer, { type TabItem } from "./TabsContainer.js";

// Lazy load the heavy components
const Optimizer = lazy(() => import("./Optimizer.js"));
const DefenderForCloudCalculator = lazy(() => import("./DefenderForCloudCalculator.js"));
const UserQuotaCalculator = lazy(() => import("./UserQuotaCalculator.js"));
const DefenderP2Tool = lazy(() => import("./DefenderP2Tool.js"));

function LoadingSpinner() {
  return (
    <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-secondary, #666)" }}>
      <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
      <p>Loading calculator...</p>
    </div>
  );
}

export function CalculatorTabs() {
  const tabs: TabItem[] = [
    {
      id: "sentinel",
      label: "Sentinel Cost",
      icon: "📊",
      description: "Calculate Microsoft Sentinel migration and cost",
      content: (
        <Suspense fallback={<LoadingSpinner />}>
          <Optimizer />
        </Suspense>
      ),
    },
    {
      id: "defender",
      label: "Defender for Cloud",
      icon: "🛡️",
      description: "Estimate Azure Defender for Cloud costs",
      content: (
        <Suspense fallback={<LoadingSpinner />}>
          <DefenderForCloudCalculator />
        </Suspense>
      ),
    },
    {
      id: "quota",
      label: "Usage & Quotas",
      icon: "📈",
      description: "Track your resource usage and quotas",
      content: (
        <Suspense fallback={<LoadingSpinner />}>
          <UserQuotaCalculator />
        </Suspense>
      ),
    },
    {
      id: "defender-p2",
      label: "Defender P2 Benefit",
      icon: "🧮",
      description: "Size the Defender for Servers Plan 2 free-ingestion benefit from a KQL query",
      content: (
        <Suspense fallback={<LoadingSpinner />}>
          <DefenderP2Tool />
        </Suspense>
      ),
    },
  ];

  return (
    <div>
      <TabsContainer tabs={tabs} defaultTabId="sentinel" verticalLayout={false} />
    </div>
  );
}

export default CalculatorTabs;

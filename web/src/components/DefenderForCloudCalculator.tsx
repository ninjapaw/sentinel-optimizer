/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in theRepository root.
 */

import { useState } from "react";
import { Card } from "./Card.js";

interface DefenderPlan {
  name: string;
  icon: string;
  description: string;
  costPerMonth: number;
  resources: string;
  selected: boolean;
}

const DEFENDER_PLANS: Record<string, DefenderPlan> = {
  servers: {
    name: "Servers",
    icon: "🖥️",
    description: "Protect your virtual machines and servers",
    costPerMonth: 15, // Per resource per month (approximate)
    resources: "VMs",
    selected: false,
  },
  databases: {
    name: "Databases",
    icon: "🗄️",
    description: "Protect SQL databases and database servers",
    costPerMonth: 15,
    resources: "SQL Databases",
    selected: false,
  },
  storage: {
    name: "Storage",
    icon: "💾",
    description: "Protect Azure Storage accounts",
    costPerMonth: 10,
    resources: "Storage Accounts",
    selected: false,
  },
  appservice: {
    name: "App Service",
    icon: "⚙️",
    description: "Protect Azure App Service instances",
    costPerMonth: 15,
    resources: "App Service Plans",
    selected: false,
  },
  containers: {
    name: "Containers",
    icon: "📦",
    description: "Protect Kubernetes clusters and registries",
    costPerMonth: 20,
    resources: "AKS Clusters",
    selected: false,
  },
  keyvault: {
    name: "Key Vault",
    icon: "🔐",
    description: "Protect key management and secrets",
    costPerMonth: 15,
    resources: "Key Vaults",
    selected: false,
  },
};

export function DefenderForCloudCalculator() {
  const [plans, setPlans] = useState<Record<string, DefenderPlan>>(DEFENDER_PLANS);
  const [resourceCounts, setResourceCounts] = useState<Record<string, number>>({
    servers: 0,
    databases: 0,
    storage: 0,
    appservice: 0,
    containers: 0,
    keyvault: 0,
  });

  const togglePlan = (planId: string) => {
    setPlans((prev) => ({
      ...prev,
      [planId]: { ...prev[planId], selected: !prev[planId].selected },
    }));
  };

  const updateResourceCount = (planId: string, count: number) => {
    setResourceCounts((prev) => ({
      ...prev,
      [planId]: Math.max(0, count),
    }));
  };

  const calculateTotal = () => {
    return Object.entries(plans).reduce((total, [planId, plan]) => {
      if (plan.selected) {
        const count = resourceCounts[planId] || 1;
        return total + plan.costPerMonth * count;
      }
      return total;
    }, 0);
  };

  const monthlyTotal = calculateTotal();
  const yearlyTotal = monthlyTotal * 12;
  const selectedCount = Object.values(plans).filter((p) => p.selected).length;

  return (
    <div style={{ padding: "1rem" }}>
      <div
        style={{
          backgroundColor: "var(--color-info-bg, #e7f3ff)",
          border: "1px solid var(--color-info-border, #91d5ff)",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1.5rem",
        }}
      >
        <p style={{ margin: 0, color: "var(--color-info, #0050b3)", fontSize: "0.95rem" }}>
          <strong>💡 What is Defender for Cloud?</strong>
          <br />
          Defender for Cloud provides threat protection across your Azure resources. You only pay for the resources
          you protect. Calculate below to see your estimated monthly cost.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {Object.entries(plans).map(([planId, plan]) => (
          <Card
            key={planId}
            icon={plan.icon}
            title={plan.name}
            description={plan.description}
            highlighted={plan.selected}
            onClick={() => togglePlan(planId)}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "var(--color-bg-secondary, #f5f5f5)",
                  borderRadius: "6px",
                }}
              >
                <div style={{ fontSize: "0.85rem", color: "var(--color-text-secondary, #666)" }}>
                  Cost per {plan.resources.toLowerCase()}
                </div>
                <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "var(--color-primary, #0078D4)" }}>
                  ${plan.costPerMonth}/mo
                </div>
              </div>

              {plan.selected && (
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem", fontWeight: "500" }}>
                    Number of {plan.resources.toLowerCase()}:
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={resourceCounts[planId] || 0}
                    onChange={(e) => updateResourceCount(planId, parseInt(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid var(--color-border, #e0e0e0)",
                      borderRadius: "4px",
                      fontSize: "0.95rem",
                    }}
                  />
                </div>
              )}

              <div style={{ textAlign: "center", padding: "0.5rem 0", borderTop: "1px solid var(--color-border, #e0e0e0)" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--color-text-secondary, #666)" }}>
                  {plan.selected ? "✓ Selected" : "Click to select"}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card title="💰 Estimated Monthly Cost" highlighted>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1.5rem",
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "0.9rem", color: "var(--color-text-secondary, #666)", marginBottom: "0.5rem" }}>
              Monthly Cost
            </div>
            <div style={{ fontSize: "2rem", fontWeight: "700", color: "var(--color-primary, #0078D4)" }}>
              ${monthlyTotal.toFixed(2)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.9rem", color: "var(--color-text-secondary, #666)", marginBottom: "0.5rem" }}>
              Yearly Cost
            </div>
            <div style={{ fontSize: "2rem", fontWeight: "700", color: "var(--color-success, #107c10)" }}>
              ${yearlyTotal.toFixed(2)}
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            backgroundColor: "var(--color-bg-secondary, #f5f5f5)",
            borderRadius: "6px",
            textAlign: "center",
            fontSize: "0.9rem",
          }}
        >
          <strong>{selectedCount}</strong> plan{selectedCount !== 1 ? "s" : ""} selected
        </div>
      </Card>
    </div>
  );
}

export default DefenderForCloudCalculator;

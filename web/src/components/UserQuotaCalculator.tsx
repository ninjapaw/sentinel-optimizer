/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { useState } from "react";
import { Card } from "./Card.js";

interface QuotaUsage {
  name: string;
  icon: string;
  unit: string;
  limit: number;
  current: number;
  category: string;
}

const QUOTA_TYPES: Record<string, QuotaUsage> = {
  api_calls: {
    name: "API Calls",
    icon: "📡",
    unit: "calls",
    limit: 10000,
    current: 0,
    category: "Usage",
  },
  storage: {
    name: "Data Storage",
    icon: "💾",
    unit: "GB",
    limit: 100,
    current: 0,
    category: "Storage",
  },
  sessions: {
    name: "Active Sessions",
    icon: "👤",
    unit: "sessions",
    limit: 50,
    current: 0,
    category: "Sessions",
  },
  compute: {
    name: "Compute Resources",
    icon: "⚡",
    unit: "vCPU",
    limit: 20,
    current: 0,
    category: "Compute",
  },
  database: {
    name: "Database Queries",
    icon: "🗄️",
    unit: "queries/day",
    limit: 50000,
    current: 0,
    category: "Database",
  },
  bandwidth: {
    name: "Data Transfer",
    icon: "🌐",
    unit: "GB/month",
    limit: 500,
    current: 0,
    category: "Network",
  },
};

export function UserQuotaCalculator() {
  const [quotas, setQuotas] = useState<Record<string, QuotaUsage>>(QUOTA_TYPES);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateUsage = (quotaId: string, value: number) => {
    setQuotas((prev) => ({
      ...prev,
      [quotaId]: { ...prev[quotaId], current: Math.max(0, value) },
    }));
  };

  const updateLimit = (quotaId: string, value: number) => {
    setQuotas((prev) => ({
      ...prev,
      [quotaId]: { ...prev[quotaId], limit: Math.max(1, value) },
    }));
  };

  const getUsagePercentage = (quota: QuotaUsage) => {
    return (quota.current / quota.limit) * 100;
  };

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return "var(--color-error, #e81123)";
    if (percentage >= 70) return "var(--color-warning, #ffb900)";
    return "var(--color-success, #107c10)";
  };

  const getStatusLabel = (percentage: number) => {
    if (percentage >= 90) return "⚠️ Critical";
    if (percentage >= 70) return "⚡ Warning";
    return "✓ Healthy";
  };

  const totalQuotas = Object.keys(quotas).length;
  const criticalQuotas = Object.values(quotas).filter((q) => getUsagePercentage(q) >= 90).length;
  const warningQuotas = Object.values(quotas).filter((q) => getUsagePercentage(q) >= 70 && getUsagePercentage(q) < 90)
    .length;

  const categories = [...new Set(Object.values(quotas).map((q) => q.category))];

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
          <strong>📊 Track Your Usage</strong>
          <br />
          Monitor how much of your quota you're using. Update the numbers below to see your usage status at a glance.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <Card highlighted>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-secondary, #666)", marginBottom: "0.5rem" }}>
              Total Quotas
            </div>
            <div style={{ fontSize: "2rem", fontWeight: "700", color: "var(--color-primary, #0078D4)" }}>
              {totalQuotas}
            </div>
          </div>
        </Card>

        <Card highlighted>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-secondary, #666)", marginBottom: "0.5rem" }}>
              Critical Usage
            </div>
            <div style={{ fontSize: "2rem", fontWeight: "700", color: "var(--color-error, #e81123)" }}>
              {criticalQuotas}
            </div>
          </div>
        </Card>

        <Card highlighted>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-secondary, #666)", marginBottom: "0.5rem" }}>
              Warnings
            </div>
            <div style={{ fontSize: "2rem", fontWeight: "700", color: "var(--color-warning, #ffb900)" }}>
              {warningQuotas}
            </div>
          </div>
        </Card>
      </div>

      {categories.map((category) => (
        <div key={category} style={{ marginBottom: "2rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "1rem", color: "var(--color-text, #333)" }}>
            {category}
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
              gap: "1rem",
            }}
          >
            {Object.entries(quotas)
              .filter(([, q]) => q.category === category)
              .map(([quotaId, quota]) => {
                const percentage = getUsagePercentage(quota);
                const statusColor = getStatusColor(percentage);
                const statusLabel = getStatusLabel(percentage);

                return (
                  <Card key={quotaId}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                      <span style={{ fontSize: "1.5rem" }}>{quota.icon}</span>
                      <div>
                        <div style={{ fontWeight: "600", fontSize: "0.95rem" }}>{quota.name}</div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: statusColor,
                            fontWeight: "600",
                          }}
                        >
                          {statusLabel}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: "1rem" }}>
                      <div
                        style={{
                          height: "8px",
                          backgroundColor: "var(--color-bg-secondary, #f5f5f5)",
                          borderRadius: "4px",
                          overflow: "hidden",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(percentage, 100)}%`,
                            backgroundColor: statusColor,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.85rem",
                          color: "var(--color-text-secondary, #666)",
                        }}
                      >
                        <span>
                          {quota.current} / {quota.limit} {quota.unit}
                        </span>
                        <span style={{ fontWeight: "600", color: statusColor }}>
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {showAdvanced && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "0.75rem",
                          padding: "0.75rem",
                          backgroundColor: "var(--color-bg-secondary, #f5f5f5)",
                          borderRadius: "6px",
                        }}
                      >
                        <div>
                          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.3rem", fontWeight: "500" }}>
                            Current
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={quota.current}
                            onChange={(e) => updateUsage(quotaId, parseInt(e.target.value) || 0)}
                            style={{
                              width: "100%",
                              padding: "0.4rem",
                              border: "1px solid var(--color-border, #e0e0e0)",
                              borderRadius: "4px",
                              fontSize: "0.85rem",
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.3rem", fontWeight: "500" }}>
                            Limit
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={quota.limit}
                            onChange={(e) => updateLimit(quotaId, parseInt(e.target.value) || 1)}
                            style={{
                              width: "100%",
                              padding: "0.4rem",
                              border: "1px solid var(--color-border, #e0e0e0)",
                              borderRadius: "4px",
                              fontSize: "0.85rem",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
          </div>
        </div>
      ))}

      <div style={{ marginTop: "2rem", textAlign: "center" }}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "var(--color-bg-secondary, #f5f5f5)",
            border: "1px solid var(--color-border, #e0e0e0)",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: "500",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-primary, #0078D4)";
            (e.currentTarget as HTMLButtonElement).style.color = "white";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-bg-secondary, #f5f5f5)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text, #333)";
          }}
        >
          {showAdvanced ? "Hide" : "Show"} Advanced Settings
        </button>
      </div>
    </div>
  );
}

export default UserQuotaCalculator;

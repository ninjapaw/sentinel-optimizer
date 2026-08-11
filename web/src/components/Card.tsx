/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  description?: string;
  icon?: string;
  children: ReactNode;
  highlighted?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function Card({ title, description, icon, children, highlighted = false, onClick, style }: CardProps) {
  return (
    <div
      className={`card ${highlighted ? "highlighted" : ""}`}
      onClick={onClick}
      style={{
        padding: "1.5rem",
        backgroundColor: highlighted ? "var(--color-accent, #f0f0f0)" : "var(--color-bg-card, white)",
        border: highlighted ? "2px solid var(--color-primary, #0078D4)" : "1px solid var(--color-border, #e0e0e0)",
        borderRadius: "12px",
        boxShadow: highlighted ? "0 4px 12px rgba(0, 120, 212, 0.15)" : "0 2px 8px rgba(0, 0, 0, 0.08)",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.3s ease",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = highlighted
            ? "0 6px 16px rgba(0, 120, 212, 0.2)"
            : "0 4px 12px rgba(0, 0, 0, 0.12)";
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = highlighted
            ? "0 4px 12px rgba(0, 120, 212, 0.15)"
            : "0 2px 8px rgba(0, 0, 0, 0.08)";
        }
      }}
    >
      {(icon || title) && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          {icon && <span style={{ fontSize: "1.5rem" }}>{icon}</span>}
          {title && <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "600" }}>{title}</h3>}
        </div>
      )}
      {description && (
        <p style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", color: "var(--color-text-secondary, #666)" }}>
          {description}
        </p>
      )}
      <div>{children}</div>
    </div>
  );
}

interface CardGridProps {
  children: ReactNode;
}

export function CardGrid({ children }: CardGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(280px, 1fr))`,
        gap: "1.5rem",
        marginTop: "1.5rem",
      }}
    >
      {children}
    </div>
  );
}

export default Card;

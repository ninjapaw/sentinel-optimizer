export const PROTECTION_SOURCE_FAMILIES = [
  "Application Gateway / WAF", "AKS / Kubernetes", "Identity and Microsoft Graph",
  "Key Vault", "Database", "Open-source databases", "Cosmos DB", "Storage",
  "Servers", "App Service", "API Management", "AI services", "Azure control plane",
  "Policy and compliance", "Native security findings", "Endpoint activity",
  "Microsoft 365 activity", "Operational diagnostics", "Unknown source",
] as const;

export type ProtectionSourceFamily = typeof PROTECTION_SOURCE_FAMILIES[number];
export interface ProtectionFamilyCount {
  family: ProtectionSourceFamily;
  count: number;
}
interface ProtectionRule {
  id: string;
  families: readonly ProtectionSourceFamily[];
  solution: string;
  benefit: string;
  nextStep: string;
  validation: string;
  sourceUrl: string;
}
export interface ProtectionOpportunity extends ProtectionRule {
  sourceCount: number;
  evidenceFamilies: ProtectionSourceFamily[];
  coverage: "Not verified";
  confidence: "Medium";
}

const cloudFamilies: readonly ProtectionSourceFamily[] = [
  "AKS / Kubernetes", "Key Vault", "Database", "Open-source databases", "Cosmos DB",
  "Storage", "Servers", "App Service", "API Management", "AI services",
  "Azure control plane", "Policy and compliance", "Application Gateway / WAF",
];
const docs = "https://learn.microsoft.com/azure/defender-for-cloud/";

export const PROTECTION_RULES: readonly ProtectionRule[] = [
  {
    id: "identity", families: ["Identity and Microsoft Graph"],
    solution: "Microsoft Entra ID Protection and Conditional Access",
    benefit: "Add risk-based access decisions to identity monitoring.",
    nextStep: "Review risky sign-ins and existing Conditional Access policies; pilot changes in report-only mode.",
    validation: "Verify user versus workload identity licensing, MFA readiness, emergency access exclusions, and policy impact before enforcement.",
    sourceUrl: "https://learn.microsoft.com/entra/id-protection/overview-identity-protection",
  },
  {
    id: "servers", families: ["Servers"],
    solution: "Microsoft Defender for Servers",
    benefit: "Complement server logs with endpoint detection and workload vulnerability assessment.",
    nextStep: "Compare in-scope machines with Defender for Cloud inventory and Defender for Endpoint onboarding health.",
    validation: "Confirm cloud and OS support, Plan 1 versus Plan 2 requirements, existing endpoint coverage, sensor health, and incremental cost.",
    sourceUrl: `${docs}plan-defender-for-servers`,
  },
  {
    id: "containers", families: ["AKS / Kubernetes"],
    solution: "Microsoft Defender for Containers",
    benefit: "Add container runtime detection and image vulnerability context to Kubernetes audit data.",
    nextStep: "Review cluster coverage, registry access, image assessment, and required runtime components.",
    validation: "Verify supported clusters, cloud connectors, sensor configuration, plan cost, and findings on a representative workload.",
    sourceUrl: `${docs}defender-for-containers-introduction`,
  },
  {
    id: "sql", families: ["Database"],
    solution: "Microsoft Defender for SQL",
    benefit: "Complement SQL audit trails with database threat detection and vulnerability assessment.",
    nextStep: "Identify Azure SQL versus SQL Server on machines and review the corresponding protection plan.",
    validation: "Verify database scope, prerequisites, existing findings, plan cost, and a supported validation scenario; audit collection is not coverage evidence.",
    sourceUrl: `${docs}defender-for-sql-introduction`,
  },
  {
    id: "databases", families: ["Open-source databases", "Cosmos DB"],
    solution: "Microsoft Defender for Databases",
    benefit: "Evaluate database-specific threat protection without assuming every database uses Defender for SQL.",
    nextStep: "Match the database engine and hosting cloud to the Cosmos DB or open-source relational database plan.",
    validation: "Check the support matrix, regional and preview availability, supported service version, resource coverage, and cost.",
    sourceUrl: `${docs}defender-for-databases-introduction`,
  },
  {
    id: "storage", families: ["Storage"],
    solution: "Microsoft Defender for Storage",
    benefit: "Evaluate threat detection and malware scanning alongside storage access logs.",
    nextStep: "Review eligible storage accounts, protection overrides, and malware scanning requirements.",
    validation: "Confirm supported storage services, scanning configuration and limits, data sensitivity, existing protection, and consumption charges.",
    sourceUrl: `${docs}defender-for-storage-introduction`,
  },
  {
    id: "vaults", families: ["Key Vault"],
    solution: "Microsoft Defender for Key Vault",
    benefit: "Add workload-specific suspicious-access findings to vault auditing.",
    nextStep: "Check plan status and vault scope; correlate findings with the accessing identity.",
    validation: "Validate resource coverage, access policies or RBAC, existing detections, alert routing, and cost.",
    sourceUrl: `${docs}defender-for-key-vault-introduction`,
  },
  {
    id: "apps", families: ["App Service"],
    solution: "Microsoft Defender for App Service",
    benefit: "Evaluate application workload threat detection beyond operational web logs.",
    nextStep: "Check eligible App Service workloads and their Defender for Cloud protection status.",
    validation: "Verify workload type and support; generic application diagnostics do not establish App Service eligibility. Confirm cost and alert routing.",
    sourceUrl: `${docs}defender-for-app-service-introduction`,
  },
  {
    id: "apis", families: ["API Management"],
    solution: "Microsoft Defender for APIs",
    benefit: "Evaluate API threat protection in addition to gateway request logging.",
    nextStep: "Inventory supported API Management APIs and verify which are onboarded to Defender for APIs.",
    validation: "Check API type, region, service tier, onboarding scope, availability, and pricing. WAF logs alone do not prove eligibility.",
    sourceUrl: `${docs}defender-for-apis-introduction`,
  },
  {
    id: "edge", families: ["Application Gateway / WAF"],
    solution: "Azure Web Application Firewall and backend workload protection",
    benefit: "Review preventive edge controls and identify workloads that need complementary protection.",
    nextStep: "Confirm WAF policy mode, managed rules, exclusions, and the actual backend resource types.",
    validation: "Test policy changes before prevention; choose Defender plans only after identifying supported backend workloads. Preserve investigation logs.",
    sourceUrl: "https://learn.microsoft.com/azure/web-application-firewall/overview",
  },
  {
    id: "control-plane", families: ["Azure control plane"],
    solution: "Microsoft Defender for Resource Manager",
    benefit: "Complement Azure administrative logs with control-plane threat detection.",
    nextStep: "Review subscription protection and correlate administrative findings with identity events.",
    validation: "Confirm plan scope, permissions, licensing or cost, and alert routing; a resource change is not proof of malicious activity.",
    sourceUrl: `${docs}defender-for-resource-manager-introduction`,
  },
  {
    id: "posture", families: cloudFamilies,
    solution: "Microsoft Defender for Cloud CSPM",
    benefit: "Find configuration weaknesses and prioritize exposure across supported cloud resources.",
    nextStep: "Review Foundational CSPM recommendations first; evaluate paid Defender CSPM for attack paths and risk prioritization.",
    validation: "Compare inventory, connectors, exemptions, and resource coverage. Verify paid feature eligibility and cost before enabling; telemetry volume is not a risk score.",
    sourceUrl: `${docs}concept-cloud-security-posture-management`,
  },
  {
    id: "endpoint", families: ["Endpoint activity"],
    solution: "Microsoft Defender for Endpoint",
    benefit: "Evaluate endpoint detection and response coverage beyond collected device events.",
    nextStep: "Compare device inventory with onboarding and sensor health; review existing endpoint security tooling.",
    validation: "Verify device licensing, supported OS, existing agents, response ownership, and a controlled detection test.",
    sourceUrl: "https://learn.microsoft.com/defender-endpoint/microsoft-defender-endpoint",
  },
  {
    id: "m365", families: ["Microsoft 365 activity"],
    solution: "Microsoft Defender for Office 365 and Defender for Cloud Apps",
    benefit: "Evaluate email, collaboration, and SaaS protection alongside Microsoft 365 audit activity.",
    nextStep: "Identify the actual email and SaaS workloads, then review applicable policies and connected apps.",
    validation: "Audit events alone do not establish either product's coverage. Verify licenses, supported workloads, policy scope, and existing protection.",
    sourceUrl: "https://learn.microsoft.com/defender-xdr/zero-trust-with-microsoft-365-defender",
  },
  {
    id: "correlation",
    families: [...cloudFamilies, "Identity and Microsoft Graph", "Native security findings", "Endpoint activity", "Microsoft 365 activity"],
    solution: "Microsoft Sentinel and Microsoft Defender XDR",
    benefit: "Connect workload, identity, and endpoint findings into investigation and response.",
    nextStep: "Review relevant connectors and analytics, then trace one representative finding through to incident ownership.",
    validation: "Check licenses, connector health, duplicate incidents, detection dependencies, and response permissions before changing ingestion or enabling automation.",
    sourceUrl: "https://learn.microsoft.com/azure/sentinel/microsoft-365-defender-sentinel-integration",
  },
];

export function findProtectionOpportunities(families: readonly ProtectionFamilyCount[]): ProtectionOpportunity[] {
  return PROTECTION_RULES.flatMap((rule) => {
    const matched = families.filter((entry) => entry.count > 0 && rule.families.includes(entry.family));
    return matched.length ? [{
      ...rule,
      sourceCount: matched.reduce((total, entry) => total + entry.count, 0),
      evidenceFamilies: matched.map((entry) => entry.family),
      coverage: "Not verified" as const,
      confidence: "Medium" as const,
    }] : [];
  });
}
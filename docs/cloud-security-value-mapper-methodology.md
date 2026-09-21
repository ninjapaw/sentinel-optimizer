# Cloud Security Value Mapper Methodology

The Cloud Security Value Mapper is an independent community planning aid. Its
output is not a Microsoft assessment, quote, licensing determination, or
guaranteed savings.

The runtime catalog is `config/cloud-security-mapper/catalog.json`. It is a
versioned planning aid based on public documentation and reviewed analyst
mappings. It does not describe private detection implementation, guarantee
alert availability, or replace current Microsoft documentation.

## Classification

The browser normalizes source names and checks them against a maintained catalog
for Application Gateway/WAF, AKS/Kubernetes, identity and Microsoft Graph, Key
Vault, databases, storage, servers, policy/compliance, and operational
diagnostics. Classification uses the complete source family patterns and a
conservative unknown fallback; it does not classify a source solely because a
single word such as `security`, `audit`, or `policy` appears in its name.

Security value and detection readiness are separate. A native alert can have
high security value, while audit records generally require analytic rules or
hunting before they become findings. Collection alone never proves that a
detection or incident exists.

## Sentinel treatments

Treatments are candidates only: Analytics candidate, Data Lake candidate,
Summary or transformed Analytics candidate, Alert-only ingestion candidate,
Retain outside Sentinel candidate, Validate before changing, and Unknown. Each
mapped source includes evidence, assumptions, confidence, and a customer
validation question.

## Defender for Cloud mappings

Candidate plans cover Defender for Servers, Containers, Storage, SQL or an
applicable database, App Service, Key Vault, Resource Manager, APIs, and AI
Services where a source family supports a useful discovery conversation. A
mapping must explain the possible workload, what the observed telemetry
provides, what a workload-aware control may add, and what must be verified. It
must explicitly state that telemetry does not prove plan enablement or
disablement. The intended narrative is complementary: edge or preventive
control, workload-aware detection and posture, then Sentinel correlation,
investigation, hunting, and response.

Representative alerts are deliberately sampled rather than treated as a full
inventory. Public references may omit recently added alerts. Alerts depend on
protected resources, services, and configuration; a listed source does not
prove that a plan is enabled, that an alert will fire, or that every customer
can receive that alert. Analyst-mapped entries display their evidence class,
source URL, snapshot date, confidence, and caveat.

## Confidence and evidence

High confidence is reserved for recognizable native alert/finding sources;
recognized non-native families are Medium; unknown families are Low and require
validation. Volume is normalized to decimal GB and divided by the selected
analysis window. Missing volume is not converted to zero. Evidence is limited
to the values supplied by the user and is not a claim about deployment state.

## Maintaining the catalog

To add a source family, add a complete `sourceCatalog` entry in
`schema/cloudSecurityMapper.ts`, select conservative roles, list candidate
plans only when the workload relationship is defensible, and add validation
questions plus a POC scenario. Add a synthetic unit test for the source and an
unknown-source regression test. Review the entry against current public product
documentation before release, record the catalog change in the pull request,
and rerun formatting, type-checking, unit tests, end-to-end tests, and the
production build. The maintainer validator is
`npm run validate:cloud-security-catalog`; it checks required columns, supported
evidence classes, URLs, duplicate rows and names, mapping basis, confidence
rules, repeated-word quality, and the catalog notice. Review source-page
validation, preview/deprecated status, severity, plan name, telemetry plane,
mapping basis, duplicate review, wording quality, and snapshot date before
publishing. Never add customer exports, identifiers, or copied notes to examples
or snapshots. The CISO, SOC leader, and technical architecture reports all
retain the same evidence and confidence record.

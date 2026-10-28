# CRA incident and vulnerability reporting runbook

**Regulation:** Regulation (EU) 2024/2847 — Cyber Resilience Act, Article 14
**Status:** **In force since 11 September 2026.** This obligation already applies to every
EconoFlow product on the market, including releases published before that date.

This runbook is for the person on duty when EconoFlow becomes aware of an **actively
exploited vulnerability** or a **severe security incident** in a product with digital
elements. Follow it in order. Do not wait for certainty: the statutory clock starts when we
have credible information, not when everything is confirmed.

> The times below are deadlines, not targets. Aim to file each report at roughly half its
> deadline so that a failed submission can be retried before the clock runs out.

---

## 1. Does this trigger the clock?

Report when **either** of the following is true.

| Trigger | Meaning | Typical EconoFlow examples |
|---------|---------|----------------------------|
| **Actively exploited vulnerability** | A weakness in a product we ship is being exploited in the wild right now. | A dependency CVE with a public exploit that EconoFlow actually uses; an authentication bypass in our API; a SQL injection being hit in our logs. |
| **Severe security incident** | An incident that impacted the security of a product we ship, even if the cause is not a vulnerability. | Unauthorised access to the production database; leaked JWT signing key or `EconoFlow_USER_KEY_SALT`; a supply-chain compromise in a package we ship. |

Do **not** trigger the clock for:

- A vulnerability that nobody is exploiting and that we found ourselves during normal
  maintenance (handle it through the normal fix process, below).
- A vulnerability in a dependency that EconoFlow does not actually use at runtime.
- A report from a researcher that we cannot yet reproduce (monitor it, but do not file).

**The 24-hour clock starts at "awareness", not at "confirmed".** Writing the early warning
itself is an acceptable way to capture the moment of awareness.

---

## 2. Deadlines

| Step | Deadline | Content |
|------|----------|---------|
| **Early warning** | **24 hours** from awareness | That the vulnerability or incident occurred, whether there is a suspicion of malicious action, and the Member States where the product is available. |
| **Notification** | **72 hours** from awareness | General information about the product, the nature of the vulnerability or incident, and the corrective or mitigating measures taken or planned. |
| **Final report — actively exploited vulnerability** | **14 days after a corrective measure becomes available** | Root cause, measures taken, and any remaining risk. |
| **Final report — severe incident** | **1 month after the 72-hour notification** | Root cause, measures taken, and any remaining risk. |

If we fix first and discover later that the vulnerability was exploited, the 14-day final
report still has to be filed.

---

## 3. Where to report

Reports are filed **once**, through the **Single Reporting Platform (SRP)** operated by
**ENISA**, addressed to the **CSIRT** of the Member State where EconoFlow's main
establishment is located. That CSIRT shares the report with the CSIRTs of the other Member
States where the product was made available.

| Item | Value / action |
|------|----------------|
| Platform | ENISA Single Reporting Platform (SRP) |
| Member State of main establishment | **Portugal** |
| Recipient CSIRT | **CERT.PT** — the Portuguese national CSIRT, operated by CNCS |
| National authority (single point of contact) | **CNCS** (Centro Nacional de Cibersegurança) |
| Access | Use the SRP account held by the security contact; access must be confirmed **before** an incident, not during one |
| Reference | Keep the SRP submission reference for every report; it is required for subsequent filings on the same incident |

Portugal has two bodies that are easy to confuse, and the difference decides where the report
lands. **CERT.PT** is the national CSIRT that Article 14 addresses; **CNCS** is the national
authority and single point of contact that operates it. File through the SRP to CERT.PT. Do
not address the report to CNCS as if it were the CSIRT.

The Member State of main establishment is where EconoFlow's business entity is established.
It is **not** where the operator happens to be living, and it is **not** where users are. That
distinction matters here: the operator works from Austria and the product has users in Brazil,
but the report still goes once, to the Portuguese CSIRT. Do not change this field without
also changing "Recipient CSIRT" and the corresponding assertion in
`scripts/cra-compliance.test.mjs`; the test holds the two together on purpose.

Some Member States expose their own national entry point that forwards to the SRP. Use the
SRP directly unless the Member State of main establishment has published an entry point.

### Member States where EconoFlow is available

The early warning must list the Member States where the product has been made available.
As of the last review this is:

- **All EU Member States.** The hosted web application is open to anyone and is used from
  several countries, so it cannot truthfully be narrowed to a list. State "all Member States"
  in the early warning rather than enumerating guesses.
- **Brazil** — outside the EU, but a country where the product has known active users. Name
  it in the report as a jurisdiction with users; it is not a recipient of the notification.
- **Any other country where the Android or iOS app is installed.** Both stores distribute
  worldwide, so treat the mobile product as available in every market the stores reach.

> **Owner:** the security contact. **Review:** quarterly, and before each release that
> expands distribution.

---

## 4. Runbook

### T+0 — Recognise and declare

1. The person who becomes aware of the issue opens an incident record and declares it.
2. **Do not** discuss the incident in public channels: no GitHub issues, no public commits,
   no public chat.
3. Notify the security contact immediately, by the fastest channel available. If the security
   contact cannot be reached within 1 hour, escalate to the repository owner.

### T+0 to T+4h — Triage enough to file the early warning

You do not need the full picture. You need:

- Which product and version is affected (web, mobile app version, container image tag).
- Whether we believe the exploitation is malicious or deliberate.
- Which Member States have the product.
- Whether a fix or mitigation exists yet.

### T+24h — Early warning

Submit the early warning through the SRP. Record the SRP reference.

### T+24h to T+72h — Contain and investigate

1. Contain: rotate any exposed secret (`EconoFlow_TOKEN_SECRET_KEY`,
   `EconoFlow_USER_KEY_SALT`, `EconoFlow_UNSUBSCRIBE_HMAC_SECRET`,
   `EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN`, S3 credentials, SMTP credentials), revoke
   sessions, and take the affected component out of service if needed.
2. Identify whether the affected component is in the SBOM of the release
   (`sbom/` artefacts attached to the release). This is what answers "are we affected?"
   for a dependency CVE.
3. Develop the fix. If the fix is risky, publish an interim mitigation first — a mitigation
   counts as a corrective measure and starts the 14-day clock for the final report.
4. Keep a timestamped log of findings for the final report.

### T+72h — Notification

Submit the notification through the SRP, referencing the early warning. Include the nature
of the issue and the corrective or mitigating measures taken or planned.

### Fix release — the 14-day clock starts

Once a corrective measure is available, the final report for an actively exploited
vulnerability is due **14 days later**.

### Final report

Submit through the SRP. Include the root cause, the measures taken, and any residual risk.

### Afterwards

1. Publish a security advisory, unless disclosure would create a risk.
2. Add a regression test that would have caught the issue.
3. If the cause was a dependency, make sure Dependabot and the audit gate
   (`scripts/audit-gate.mjs`) would have caught it; close the gap if not.
4. Hold a short blameless review within 10 business days and record what changed.

---

## 5. Roles

| Role | Responsibility |
|------|----------------|
| **Security contact** | Owns the SRP account, files every report, keeps the Member State list current |
| **Incident lead** | Runs the response, decides when a trigger is met, approves each submission |
| **Repository owner** | Final escalation point, approves public disclosure |

Fill these in before an incident occurs. Two named people per role, so that leave and time
zones do not block a 24-hour deadline.

| Role | Primary | Backup |
|------|---------|--------|
| Security contact | Felipe P. Soares | `security@econoflow.pt` (monitored mailbox) |
| Incident lead | Felipe P. Soares | `security@econoflow.pt` (monitored mailbox) |
| Repository owner | Felipe P. Soares | `security@econoflow.pt` (monitored mailbox) |

The backup is a **mailbox, not a second person**. That is a deliberate, documented weakness:
the mailbox is monitored and alerted, so a 24-hour deadline stays reachable when the primary
is asleep or travelling, but it does not remove the single point of failure. Replace it with
a named second person as soon as one is available, and update this table.

The operator works from Central European Time (Austria). Deadlines are counted in absolute
hours from the moment of awareness, not in business days, so an awareness on Friday evening
reaches its early-warning deadline on Saturday evening.

---

## 6. Before you need this

These are one-off tasks that must be done while everything is calm:

- [x] Confirm the Member State of main establishment (Portugal), the corresponding CSIRT
      (CERT.PT) and the national authority (CNCS).
- [ ] Confirm SRP access for the primary and backup security contacts. **Not yet done** — see
      the access record in section 6.1.
- [ ] Keep the Member State availability list above current. **Still open** — review quarterly.
- [ ] Pre-draft the early-warning and notification text from the templates in section 7.
      **Still open** — the templates exist, the wording is not rehearsed.
- [ ] Run an out-of-hours drill once a year: simulate "a dependency we ship is being
      exploited" and time how long 24 hours feels in practice. **Still open** — see the drill
      record in section 6.2.
- [ ] Verify that a release's `sbom/` artefacts actually let someone answer "are we
      affected?" for a given CVE in under an hour. **Still open** — the drill is the test of
      this.

### 6.1 SRP access

Until the ENISA SRP account exists, **an incident cannot be reported within 24 hours at
all**. This is the most serious open gap in this runbook: everything else here is procedure,
and procedure is worthless if there is no account to file from.

| Item | Value |
|------|-------|
| Account registered | **No** — to be created by the security contact |
| Holder (primary) | Felipe P. Soares |
| Holder (backup) | `security@econoflow.pt` |
| Access last verified | **never** |
| Blocks an Art. 14 report? | **Yes** — registering the account is the highest-priority item in this document |

`scripts/cra-readiness-report.mjs` reports the missing registration as a **warning** rather
than a failure, so the gap is visible on every CI run without freezing unrelated work. A
warning is not a substitute for the account. When it is registered, replace `No` with the
registration date above and the warning disappears.

### 6.2 Drill record

The drill is run once a year and **timed**. The scenario: "a dependency we ship is being
exploited in the wild, and a researcher reports it on a Saturday at 23:00". Time how long it
takes to get from "aware" to a submittable early warning.

`scripts/cra-compliance.test.mjs` checks this table: the most recent entry must be less than
12 months old, and the measured duration must be filled in.

| Date | Scenario | Elapsed time | Run by | What it exposed |
|------|----------|--------------|--------|-----------------|

Nothing recorded yet. The structure above is in place; the first row has to come from an
actual run. Until then this runbook is unproven, and the test suite says so.

---

## 7. Templates

Both templates use placeholders in `<>`.

### Early warning (24 hours)

```
Product:            EconoFlow <web | mobile <platform> | container image> <version/commit>
Nature of the event: Actively exploited vulnerability | Severe security incident
Suspicion of malicious action: yes | no | unknown
Member States where available: <list>
Summary:            <one or two sentences: what we know happened>
Known impact:       <accounts affected, data exposed, or "under assessment">
Immediate measures: <containment already applied>
Further information: <when the notification will follow>
```

### Notification (72 hours)

```
Reference:          <SRP reference from the early warning>
Product:            EconoFlow <product> <version/commit>, SBOM reference <sbom file>
General description: <what the product is, where it is deployed>
Nature of the issue: <technical description of the vulnerability or incident>
Root cause (current understanding): <...>
Severity:           <CVSS vector and score, if known>
Corrective measures:  <applied: ...>
Mitigating measures:  <available to users: ...>
Planned measures:     <fix timeline>
Was this reported by a third party: <yes (researcher, credited | anonymous) | no>
```

---

## 8. Related documents

- [`SECURITY.md`](../SECURITY.md) — the public coordinated vulnerability disclosure policy.
- [`docs/cra-compliance-assessment.md`](cra-compliance-assessment.md) — readiness against the
  Regulation.
- [`docs/security-exceptions.md`](security-exceptions.md) — accepted dependency advisories.

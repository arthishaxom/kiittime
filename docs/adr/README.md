# Architecture Decision Records (ADRs)

Architecture Decision Records (ADRs) document key architectural decisions made in the KIIT Time codebase, including context, decisions, and consequences.

All developers should read existing ADRs to align on established patterns and decisions.

---

## 📋 Directory Index

Click on the ADR titles below to view the detailed records:

1. **[0001: Timetable Upload Scope](file:///C:/Users/ashis/kiittime/docs/adr/0001-timetable-upload-scope.md)** (Accepted)  
   Introduces the concept of *Academic Year* and *Section-wise* scopes for timetable Excel imports to prevent data loss.
2. **[0002: Announcements](file:///C:/Users/ashis/kiittime/docs/adr/0002-announcements.md)** (Accepted)  
   Establishes the single-active, immutable-row model for admin-authored global student notifications.
3. **[0003: Mobile Offline Hardening](file:///C:/Users/ashis/kiittime/docs/adr/0003-mobile-offline-hardening.md)** (Accepted)  
   Leverages `netinfo` to wire reconnect refetches, add offline UI cues, and extend TanStack cache lifespan to 7 days.
4. **[0004: CI Pipeline](file:///C:/Users/ashis/kiittime/docs/adr/0004-ci-pipeline.md)** (Accepted)  
   Sets up path-filtered merge-gating CI workflows using GitHub Actions for backend, webapp, admin-webapp, and mobile.

---

## 🛠 ADR Standard & Process

### Conventions
* **Location**: All records must live under the `docs/adr/` directory.
* **Naming**: Prefix files with a zero-padded four-digit sequence number, followed by a slugified title (e.g., `0005-my-new-decision.md`).
* **Format**: All ADRs must adhere to the structure defined in the **[ADR Template](file:///C:/Users/ashis/kiittime/docs/adr/template.md)**:
  * Title and metadata (Date, Status)
  * Context (Problem & constraints)
  * Decision (Chosen path and rules)
  * Consequences (Trade-offs & next steps)

### How to Create a New ADR
1. Copy the **[template.md](file:///C:/Users/ashis/kiittime/docs/adr/template.md)** to a new file named with the next available index.
2. Fill out the proposed decision details.
3. Open a Pull Request for discussion. Set the status to `Proposed`.
4. Once reviewed and agreed upon by the team, merge the PR, set status to `Accepted`, and update this index.

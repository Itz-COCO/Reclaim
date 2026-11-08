# Reclaim

Reclaim is a permissioned decision memory for places where facts are incomplete, interests differ and people need to coordinate before making an important change.

It connects place records, evidence, uncertainty, participation, decisions and accountable next actions.

## Product promise

Reclaim helps people investigate a place together, keep evidence and uncertainty visible, control who can contribute, and move from open questions to accountable next actions.

## What is in this package

- A calm, responsive product interface for place-based investigation.
- Project and building records with explicit unknowns.
- Evidence records with provenance and review status.
- An interactive blockage and question map.
- Survey summaries that preserve sample limits.
- Future-use and retrofit comparisons without unexplained scoring.
- Decision gates, roadmap actions and a dated Decision Brief.
- Private-by-default project architecture with owner, member, viewer and contributor roles.
- Trusted platform owner/operator roles for cross-project stewardship.
- Curated public records, a public Dakota Crescent case route and privacy-aware location fields.
- Profile identity with avatar, biography and optional direct social links.
- Moderated project-media records prepared for building photography and public evidence.
- Additive Supabase migrations for access requests, activity history, public publication and notification queuing.
- Dakota Crescent as the first public case study with controlled editing.

## Product boundaries

Reclaim is a decision-support and coordination system. It does not certify engineering, safety, legal, conservation, cost, energy, carbon or building-condition claims. Evidence, interpretation, proposal and unknown remain distinct. A project status is not professional or authority sign-off.

Projects are private by default. An account does not grant access to every project. Public material must be deliberately published, and contributions from residents or external specialists must be moderated before they become part of the official project record.

## Technology

- React and TypeScript.
- Vite.
- Supabase Auth and Postgres with row-level security when a shared workspace is configured.
- Browser-private workspace behavior when a shared workspace is not configured.

The browser uses only a public Supabase key. Service-role keys and email-provider secrets must never be placed in frontend code, `.env` files committed to GitHub or a deployment bundle.

## Trust and publication

Public visibility is curated at record level. A public case does not make its private workspace, internal notes or unpublished evidence public. Exact coordinates, raw uploads and moderation decisions remain protected. Profile links describe a person and never grant project or platform permissions.

## Reproducibility

The package is intentionally small and product-focused. Generated dependencies, build output, local environment files, diagnostics and internal planning notes are not committed. The project can be built with the standard Node and npm toolchain using the scripts in `package.json`.

## First case

Dakota Crescent is the first detailed case used to demonstrate the method. It is a controlled project, not a shared editing sandbox.

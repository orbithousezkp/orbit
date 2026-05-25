"use strict";

// Federation discovery: build a /.well-known/orbit.json shape that any other
// orbit (or external integration) can fetch to learn this repo's identity,
// capabilities, contact surfaces, and the URLs of its dashboards/proofs.
//
// The schema is intentionally narrower than the full dashboard. It surfaces
// only the federation-relevant fields. See PLAN/SPECS/FEDERATION.md.

const WELL_KNOWN_SCHEMA = "orbit-well-known/1";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function projectForWellKnown(bundle, options = {}) {
  const b = bundle || {};
  const infra = b.infrastructure || {};
  const treasury = b.treasury || {};
  const governance = b.governance || {};
  const externalSpend = governance.externalSpend || {};
  const product = infra.product || {};
  const activePhase = infra.activePhase || null;
  const token = treasury.token || {};

  const capabilities = asArray(infra.capabilities)
    .filter((c) => c && c.status === "active")
    .map((c) => ({
      id: c.id,
      name: c.name,
      surface: c.surface || null,
      mode: c.mode || null
    }));

  const surfaces = asArray(infra.surfaces).map((s) => ({
    id: s.id,
    name: s.name,
    url: s.url || s.path || null,
    mode: s.mode || null
  }));

  const lineage = options.lineage && typeof options.lineage === "object"
    ? {
        parent: options.lineage.parent || null,
        adoptedAt: options.lineage.adoptedAt || null,
        scaffolderVersion: options.lineage.scaffolderVersion || null
      }
    : null;

  return {
    schema: WELL_KNOWN_SCHEMA,
    generatedAt: new Date().toISOString(),
    product: {
      name: product.name || "Orbit",
      category: product.category || null
    },
    identity: {
      brand: options.brand || product.name || "Orbit",
      repo: options.repo || null,
      publicUrl: options.publicUrl || null,
      farcaster: options.farcaster || null,
      signer: options.signer || null
    },
    lineage,
    activePhase: activePhase
      ? {
          id: activePhase.id || null,
          name: activePhase.name || null,
          status: activePhase.status || null
        }
      : null,
    capabilities,
    surfaces,
    walletPolicy: {
      approvalMode: externalSpend.mode || "owner_approval_required",
      publicViewOnly: true,
      noPrivateKeys: true,
      token: {
        name: token.name || null,
        symbol: token.symbol || null,
        launchStatus: token.launchStatus || "planned",
        address: token.address || null
      }
    },
    federation: {
      version: 1,
      transport: "https_get",
      schemaUrl: "https://orbit.horse/.well-known/orbit.json",
      acceptsEnvelopes: false,
      contact: {
        github: options.githubRepo || null,
        farcaster: options.farcaster || null
      }
    },
    pointers: {
      dashboard: options.dashboardUrl || "/dashboard.json",
      passport: "/agent-passport.md",
      walletPolicy: "/wallet-policy.md",
      docs: "/quickstart.md"
    }
  };
}

function validateWellKnown(data) {
  const errors = [];
  if (!data || typeof data !== "object") {
    return { ok: false, errors: ["payload is not an object"] };
  }
  if (data.schema !== WELL_KNOWN_SCHEMA) {
    errors.push(`schema must be "${WELL_KNOWN_SCHEMA}"`);
  }
  if (!data.product || typeof data.product.name !== "string") {
    errors.push("product.name is required");
  }
  if (!data.identity || typeof data.identity !== "object") {
    errors.push("identity is required");
  }
  if (!Array.isArray(data.capabilities)) {
    errors.push("capabilities must be an array");
  }
  if (!data.walletPolicy || typeof data.walletPolicy.approvalMode !== "string") {
    errors.push("walletPolicy.approvalMode is required");
  }
  if (!data.federation || data.federation.version !== 1) {
    errors.push("federation.version must be 1");
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  WELL_KNOWN_SCHEMA,
  projectForWellKnown,
  validateWellKnown
};

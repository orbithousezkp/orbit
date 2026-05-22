"use strict";

function privateAiRoute(provider = {}, index = 0) {
  const priority = Number.isFinite(Number(provider.priority))
    ? Number(provider.priority)
    : index + 1;

  return {
    route: `private-ai-route-${priority}`,
    priority,
    configured: true,
    toolResultMode: provider.toolResultMode || "native"
  };
}

function privateAiRoutes(providers = []) {
  return (Array.isArray(providers) ? providers : []).map(privateAiRoute);
}

function privateAiRouteId(provider = {}, index = 0) {
  return privateAiRoute(provider, index).route;
}

function privateProviderErrors(errors = []) {
  return (Array.isArray(errors) ? errors : []).map((error, index) => ({
    route: error && error.route ? error.route : privateAiRouteId(error || {}, index),
    priority: error && error.priority ? error.priority : index + 1,
    error: error && error.error ? error.error : "AI route failed"
  }));
}

module.exports = {
  privateAiRoute,
  privateAiRouteId,
  privateAiRoutes,
  privateProviderErrors
};

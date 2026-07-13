import { Router, type RequestHandler } from "express";
import { chatHandler } from "./chat";
import { healthHandler } from "./health";

export const V1_PREFIX = "/api/v1";

interface RouteDefinition {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  description: string;
  handler: RequestHandler;
}

// Single source of truth for v1: routes are registered from this table and the
// root endpoint lists it, so the listing cannot drift from what is served.
const routes: RouteDefinition[] = [
  {
    method: "get",
    path: "/health",
    description: "Health check: status, uptime and current time",
    handler: healthHandler,
  },
  {
    method: "post",
    path: "/chat",
    description: "Chat with the support agent (placeholder, not implemented)",
    handler: chatHandler,
  },
];

export const v1Router: Router = Router();

for (const route of routes) {
  v1Router[route.method](route.path, route.handler);
}

export const v1Endpoints = routes.map(({ method, path, description }) => ({
  method: method.toUpperCase(),
  path: `${V1_PREFIX}${path}`,
  description,
}));

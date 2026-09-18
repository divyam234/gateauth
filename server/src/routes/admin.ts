import { applicationAdminRoutes } from "./admin/applications.js";
import { auditAdminRoutes } from "./admin/audit.js";
import { configAdminRoutes } from "./admin/config.js";
import { identityAdminRoutes } from "./admin/identity.js";

export const adminRoutes = {
  ...applicationAdminRoutes,
  ...configAdminRoutes,
  ...auditAdminRoutes,
  ...identityAdminRoutes,
};

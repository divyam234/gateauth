import type { BunRouter } from "../router.js";
import { registerApplicationAdminRoutes } from "./admin/applications.js";
import { registerAuditAdminRoutes } from "./admin/audit.js";
import { registerConfigAdminRoutes } from "./admin/config.js";
import { registerIdentityAdminRoutes } from "./admin/identity.js";

export function registerAdminRoutes(app: BunRouter): void {
  registerApplicationAdminRoutes(app);
  registerConfigAdminRoutes(app);
  registerAuditAdminRoutes(app);
  registerIdentityAdminRoutes(app);
}

import { USER_CONFIG } from "@shared/config/user.config.js";

export const CONFIG = Object.freeze({
  ...USER_CONFIG.site,
  repo: USER_CONFIG.site.repository,
  colors: USER_CONFIG.brand.colors,
});

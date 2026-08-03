import { app } from "@azure/functions";
import {
  RECOMMEND_MAX_BODY_BYTES,
} from "../../../core/recommend.js";
import { INTERNAL_CONFIG } from "../../../../../shared/index.js";
import { createAzureHandler } from "../http.js";

app.http("recommend", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "recommend",
  handler: createAzureHandler(
    INTERNAL_CONFIG.api.routes.recommend,
    RECOMMEND_MAX_BODY_BYTES,
  ),
});

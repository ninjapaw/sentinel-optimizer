/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { describe, expect, it } from "vitest";
import { getSessionStorage, NullSessionStorage } from "../../../shared/utils/session-storage.js";

const containerSettings = {
  COSMOS_DATABASE: "sentinel-optimizer",
  COSMOS_SESSIONS_CONTAINER: "sessions",
};

describe("getSessionStorage", () => {
  it("uses the null implementation when Cosmos is not configured", () => {
    expect(getSessionStorage(containerSettings)).toBeInstanceOf(NullSessionStorage);
  });

  it(
    "creates Cosmos storage with a managed identity endpoint",
    () => {
      const storage = getSessionStorage({
        ...containerSettings,
        COSMOS_ENDPOINT: "https://sentinel-optimizer.documents.azure.com:443/",
      });

      expect(storage).not.toBeInstanceOf(NullSessionStorage);
    },
    15_000,
  );
});

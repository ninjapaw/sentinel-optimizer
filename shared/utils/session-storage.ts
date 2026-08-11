/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

export interface SessionStorage {
  saveSession(
    userId: string,
    userEmail: string,
    displayName: string | undefined,
    request: unknown,
  ): Promise<{ sessionId: string; createdAt: string; updatedAt: string }>;

  loadSession(userId: string, sessionId: string): Promise<unknown>;

  listUserSessions(userId: string, limit: number, offset: number): Promise<{ sessions: unknown[]; total: number }>;

  deleteSession(userId: string, sessionId: string): Promise<boolean>;

  deleteUserSessions(userId: string): Promise<number>;

  listAllUsers(limit: number, offset: number): Promise<{ users: unknown[]; total: number }>;

  getUserStats(userId: string): Promise<unknown>;
}

export class NullSessionStorage implements SessionStorage {
  async saveSession(): Promise<{ sessionId: string; createdAt: string; updatedAt: string }> {
    throw new Error("Session storage is not configured.");
  }

  async loadSession(): Promise<unknown> {
    throw new Error("Session storage is not configured.");
  }

  async listUserSessions(): Promise<{ sessions: unknown[]; total: number }> {
    throw new Error("Session storage is not configured.");
  }

  async deleteSession(): Promise<boolean> {
    throw new Error("Session storage is not configured.");
  }

  async deleteUserSessions(): Promise<number> {
    throw new Error("Session storage is not configured.");
  }

  async listAllUsers(): Promise<{ users: unknown[]; total: number }> {
    throw new Error("Session storage is not configured.");
  }

  async getUserStats(): Promise<unknown> {
    throw new Error("Session storage is not configured.");
  }
}

export function getSessionStorage(environment: Record<string, string | undefined>): SessionStorage {
  const connectionString = environment.COSMOS_CONNECTION_STRING?.trim();
  const database = environment.COSMOS_DATABASE?.trim();
  const container = environment.COSMOS_SESSIONS_CONTAINER?.trim();

  if (!connectionString || !database || !container) {
    return new NullSessionStorage();
  }

  try {
    // Dynamic import to avoid compile-time dependency
    return new CosmosSessionStorage(connectionString, database, container);
  } catch {
    return new NullSessionStorage();
  }
}

class CosmosSessionStorage implements SessionStorage {
  private client: unknown;
  private database: unknown;
  private container: unknown;

  constructor(connectionString: string, database: string, container: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require, @typescript-eslint/no-var-requires
      const cosmosModule = require("@azure/cosmos") as { CosmosClient: unknown };
      const CosmosClient = cosmosModule.CosmosClient as new (config: { connectionString: string }) => unknown;
      this.client = new CosmosClient({ connectionString });

      // Type assertion to access database/container methods
      const clientWithDb = this.client as { database: (name: string) => unknown };
      this.database = clientWithDb.database(database);

      const dbWithContainer = this.database as { container: (name: string) => unknown };
      this.container = dbWithContainer.container(container);
    } catch (error) {
      throw new Error(`Cosmos DB storage initialization failed: ${error}`);
    }
  }

  async saveSession(
    userId: string,
    userEmail: string,
    displayName: string | undefined,
    request: unknown,
  ): Promise<{ sessionId: string; createdAt: string; updatedAt: string }> {
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const now = new Date().toISOString();

    const session = {
      id: `${userId}#${sessionId}`,
      sessionId,
      userId,
      userEmail,
      displayName: displayName || userEmail,
      createdAt: now,
      updatedAt: now,
      ...(typeof request === "object" && request !== null ? request : {}),
    };

    const containerWithCreate = this.container as {
      items: { create: (item: unknown) => Promise<unknown> };
    };
    await containerWithCreate.items.create(session);
    return { sessionId, createdAt: now, updatedAt: now };
  }

  async loadSession(userId: string, sessionId: string): Promise<unknown> {
    const containerWithItem = this.container as {
      item: (id: string, partitionKey: string) => { read: () => Promise<{ resource: unknown }> };
    };
    const { resource } = await containerWithItem.item(`${userId}#${sessionId}`, userId).read();
    return resource;
  }

  async listUserSessions(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ sessions: unknown[]; total: number }> {
    const query = "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.updatedAt DESC OFFSET @offset LIMIT @limit";
    const containerWithQuery = this.container as {
      items: {
        query: (
          q: string,
          options: { parameters: Array<{ name: string; value: unknown }> },
        ) => { fetchNext: () => Promise<{ resources: unknown[] }> };
      };
    };

    const { resources } = await containerWithQuery.items
      .query(query, {
        parameters: [
          { name: "@userId", value: userId },
          { name: "@offset", value: offset },
          { name: "@limit", value: limit },
        ],
      })
      .fetchNext();

    const countQuery = "SELECT VALUE COUNT(1) FROM c WHERE c.userId = @userId";
    const countResult = await containerWithQuery.items
      .query(countQuery, { parameters: [{ name: "@userId", value: userId }] })
      .fetchNext();

    const countResources = (countResult as { resources: unknown[] }).resources;
    return { sessions: resources, total: (countResources?.[0] as number) || 0 };
  }

  async deleteSession(userId: string, sessionId: string): Promise<boolean> {
    try {
      const containerWithItem = this.container as {
        item: (id: string, partitionKey: string) => { delete: () => Promise<unknown> };
      };
      await containerWithItem.item(`${userId}#${sessionId}`, userId).delete();
      return true;
    } catch {
      return false;
    }
  }

  async deleteUserSessions(userId: string): Promise<number> {
    const query = "SELECT c.id FROM c WHERE c.userId = @userId";
    const containerWithQuery = this.container as {
      items: {
        query: (
          q: string,
          options: { parameters: Array<{ name: string; value: unknown }> },
        ) => { fetchAll: () => Promise<{ resources: Array<{ id: string }> }> };
      };
    };

    const { resources } = await containerWithQuery.items
      .query(query, { parameters: [{ name: "@userId", value: userId }] })
      .fetchAll();

    let deleted = 0;
    for (const item of resources) {
      try {
        const containerWithItem = this.container as {
          item: (id: string, partitionKey: string) => { delete: () => Promise<unknown> };
        };
        await containerWithItem.item(item.id, userId).delete();
        deleted++;
      } catch {
        // Continue on delete errors
      }
    }
    return deleted;
  }

  async listAllUsers(limit: number, offset: number): Promise<{ users: unknown[]; total: number }> {
    const query =
      "SELECT DISTINCT c.userId, c.userEmail, c.displayName, MAX(c.updatedAt) as lastActiveAt FROM c GROUP BY c.userId, c.userEmail, c.displayName ORDER BY MAX(c.updatedAt) DESC OFFSET @offset LIMIT @limit";

    const containerWithQuery = this.container as {
      items: {
        query: (
          q: string,
          options: { parameters: Array<{ name: string; value: unknown }> },
        ) => { fetchNext: () => Promise<{ resources: unknown[] }> };
      };
    };

    const { resources } = await containerWithQuery.items
      .query(query, {
        parameters: [
          { name: "@offset", value: offset },
          { name: "@limit", value: limit },
        ],
      })
      .fetchNext();

    const countQuery = "SELECT VALUE COUNT(DISTINCT c.userId) FROM c";
    const countResult = await containerWithQuery.items
      .query(countQuery, { parameters: [] })
      .fetchNext();
    const countResources = (countResult as { resources: unknown[] }).resources;

    return { users: resources, total: (countResources?.[0] as number) || 0 };
  }

  async getUserStats(userId: string): Promise<unknown> {
    const query =
      "SELECT c.userId, c.userEmail, c.displayName, COUNT(1) as sessionCount, SUM(LENGTH(STRING(c))) as totalStorageBytes, MAX(c.updatedAt) as lastActiveAt, MIN(c.createdAt) as createdAt FROM c WHERE c.userId = @userId GROUP BY c.userId, c.userEmail, c.displayName";

    const containerWithQuery = this.container as {
      items: {
        query: (
          q: string,
          options: { parameters: Array<{ name: string; value: unknown }> },
        ) => { fetchNext: () => Promise<{ resources: unknown[] }> };
      };
    };

    const { resources } = await containerWithQuery.items
      .query(query, { parameters: [{ name: "@userId", value: userId }] })
      .fetchNext();

    return (resources?.[0] as unknown) || null;
  }
}

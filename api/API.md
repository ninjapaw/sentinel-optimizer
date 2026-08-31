/\*\*

- MIT License
- Copyright (c) 2026 Microsoft Corporation
- See LICENSE in the repository root.
  \*/

# Sentinel Optimizer Admin APIs

Complete REST API reference for admin operations and session management in Sentinel Optimizer.

## Architecture Overview

The Sentinel Optimizer uses a **static website with admin backend APIs** architecture:

- **Frontend**: Static website (built with Astro + React)
  - Hosted on Azure Static Web Apps or CDN
  - No server-side rendering required
  - Client-side authentication with MSAL

- **Backend APIs**: Azure Functions
  - RESTful HTTP endpoints for session management
  - Role-based access control via JWT claims
  - Cosmos DB for persistent storage

## Authentication

All API endpoints require Bearer token authentication (except public health checks):

```http
Authorization: Bearer <JWT_TOKEN>
```

The JWT token is obtained from Microsoft Entra ID External ID after user login.

### User vs Admin Tokens

**User Token Claims:**

- `sub` or `oid`: User ID (GUID)
- `preferred_username` or `email`: User email
- `name`: Display name
- No `roles` claim (or empty roles array)

**Admin Token Claims:**

- `sub` or `oid`: Admin user ID
- `preferred_username` or `email`: Admin email
- `name`: Display name
- `roles`: Array containing `"SentinelOptimizer.Admin"`

## Session Management APIs

### Save Session

**Endpoint:** `POST /api/session/save`

**Authentication:** Required (user token)

**Request:**

```json
{
  "name": "Q3 2024 Projection",
  "description": "Quarterly cost analysis",
  "optimizerState": {
    /* optimizer state object */
  },
  "costBreakdown": {
    /* optional cost details */
  },
  "recommendations": [
    /* optional recommendations */
  ],
  "exportFormats": ["pdf", "pptx"] // optional
}
```

**Response (200):**

```json
{
  "sessionId": "session-uuid",
  "createdAt": "2026-08-11T20:00:00.000Z",
  "updatedAt": "2026-08-11T20:00:00.000Z"
}
```

**Errors:**

- `401`: Unauthorized - Missing or invalid token
- `400`: Invalid request format
- `413`: Payload too large (>5MB)
- `500`: Server error

---

### List User Sessions

**Endpoint:** `GET /api/session/list`

**Authentication:** Required (user token)

**Query Parameters:**

- `limit` (optional, default: 50, max: 100): Number of sessions per page
- `offset` (optional, default: 0): Pagination offset

**Example:** `GET /api/session/list?limit=20&offset=0`

**Response (200):**

```json
{
  "sessions": [
    {
      "sessionId": "session-uuid-1",
      "name": "Q3 2024 Projection",
      "description": "Quarterly cost analysis",
      "createdAt": "2026-08-10T10:00:00.000Z",
      "updatedAt": "2026-08-11T15:30:00.000Z"
    },
    {
      "sessionId": "session-uuid-2",
      "name": "Budget Review",
      "createdAt": "2026-08-05T09:00:00.000Z",
      "updatedAt": "2026-08-11T20:00:00.000Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

**Errors:**

- `401`: Unauthorized
- `400`: Invalid parameters
- `500`: Server error

---

### Load Session

**Endpoint:** `GET /api/session/{sessionId}`

**Authentication:** Required (user token)

**Path Parameters:**

- `sessionId`: The session UUID

**Response (200):**

```json
{
  "session": {
    "sessionId": "session-uuid",
    "userId": "user-id",
    "userEmail": "user@example.com",
    "displayName": "John Doe",
    "name": "Q3 2024 Projection",
    "description": "Quarterly cost analysis",
    "createdAt": "2026-08-10T10:00:00.000Z",
    "updatedAt": "2026-08-11T15:30:00.000Z",
    "optimizerState": {
      /* optimizer state object */
    },
    "costBreakdown": {
      /* cost details */
    },
    "recommendations": [
      /* recommendations */
    ]
  }
}
```

**Errors:**

- `401`: Unauthorized
- `400`: Invalid session ID
- `404`: Session not found
- `500`: Server error

---

### Delete Session

**Endpoint:** `DELETE /api/session/{sessionId}`

**Authentication:** Required (user token)

**Path Parameters:**

- `sessionId`: The session UUID

**Response (200):**

```json
{
  "deleted": true
}
```

**Errors:**

- `401`: Unauthorized
- `404`: Session not found
- `405`: Invalid method
- `500`: Server error

---

## Admin APIs

### Health Check (Admin)

**Endpoint:** `GET /api/admin/health`

**Authentication:** Required (admin token only)

**Response (200):**

```json
{
  "status": "ok",
  "subject": "admin-user-id",
  "timestamp": "2026-08-11T20:00:00.000Z"
}
```

**Errors:**

- `401`: Unauthorized - Missing or invalid token
- `403`: Forbidden - Admin role required
- `503`: Admin authentication not configured
- `500`: Server error

---

### List All Users

**Endpoint:** `GET /api/admin/users`

**Authentication:** Required (admin token only)

**Query Parameters:**

- `limit` (optional, default: 50, max: 100): Number of users per page
- `offset` (optional, default: 0): Pagination offset

**Example:** `GET /api/admin/users?limit=20&offset=0`

**Response (200):**

```json
{
  "users": [
    {
      "userId": "user-id-1",
      "userEmail": "user1@example.com",
      "displayName": "User One",
      "sessionCount": 5,
      "totalStorageBytes": 2097152,
      "lastActiveAt": "2026-08-11T19:30:00.000Z",
      "createdAt": "2026-07-01T10:00:00.000Z"
    },
    {
      "userId": "user-id-2",
      "userEmail": "user2@example.com",
      "displayName": "User Two",
      "sessionCount": 12,
      "totalStorageBytes": 5242880,
      "lastActiveAt": "2026-08-11T18:00:00.000Z",
      "createdAt": "2026-06-15T14:00:00.000Z"
    }
  ],
  "total": 127,
  "limit": 20,
  "offset": 0
}
```

**Errors:**

- `401`: Unauthorized
- `403`: Admin role required
- `400`: Invalid parameters
- `500`: Server error

---

### Admin Statistics

**Endpoint:** `GET /api/admin/stats`

**Authentication:** Required (admin token only)

**Response (200):**

```json
{
  "summary": {
    "totalUsers": 127,
    "totalSessions": 582,
    "totalStorageBytes": 314572800,
    "storageGB": 0.29,
    "timestamp": "2026-08-11T20:00:00.000Z"
  },
  "users": [
    {
      "userId": "user-id-1",
      "userEmail": "user1@example.com",
      "displayName": "User One",
      "sessionCount": 5,
      "totalStorageBytes": 2097152,
      "lastActiveAt": "2026-08-11T19:30:00.000Z",
      "createdAt": "2026-07-01T10:00:00.000Z"
    }
    /* ... more users ... */
  ]
}
```

**Fields:**

- `summary.totalUsers`: Total number of registered users
- `summary.totalSessions`: Total number of saved sessions
- `summary.totalStorageBytes`: Total storage used across all users
- `summary.storageGB`: Storage in gigabytes (rounded to 2 decimals)
- `users`: Array of user statistics

**Errors:**

- `401`: Unauthorized
- `403`: Admin role required
- `500`: Server error

---

### Delete User Session (Admin)

**Endpoint:** `DELETE /api/admin/session/{userId}/{sessionId}`

**Authentication:** Required (admin token only)

**Path Parameters:**

- `userId`: The target user's ID (GUID)
- `sessionId`: The session UUID to delete

**Response (200):**

```json
{
  "deleted": true
}
```

**Errors:**

- `400`: Invalid parameters
- `401`: Unauthorized
- `403`: Admin role required
- `404`: Session not found
- `405`: Invalid method
- `500`: Server error

---

## Recommendation & Analysis APIs

### Generate Recommendations

**Endpoint:** `POST /api/recommend`

**Authentication:** Optional (public endpoint)

**Request:**

```json
{
  "provider": "openai", // or other configured provider
  "context": "Your analysis context",
  "data": {
    /* analysis data */
  }
}
```

**Response (200):**

```json
{
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}
```

---

### Example Request

**Endpoint:** `POST /api/example`

**Authentication:** Optional (public endpoint)

**Response (200):**

```json
{
  "example": {
    /* example data */
  }
}
```

---

## Public APIs

### Health Check (Public)

**Endpoint:** `GET /api/health`

**Authentication:** Not required

**Response (200):**

```json
{
  "status": "ok",
  "timestamp": "2026-08-11T20:00:00.000Z"
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**

- `200`: Success
- `400`: Bad Request - Invalid parameters or request format
- `401`: Unauthorized - Missing or invalid authentication token
- `403`: Forbidden - Authenticated but lacking required permissions
- `404`: Not Found - Resource doesn't exist
- `405`: Method Not Allowed - Wrong HTTP method
- `413`: Payload Too Large - Request body exceeds size limit
- `500`: Internal Server Error - Server-side error
- `503`: Service Unavailable - Feature not configured

---

## Response Headers

All API responses include:

```http
Content-Type: application/json
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## Rate Limiting

Currently no rate limiting is enforced. Future versions may implement:

- Per-user rate limits
- Per-IP rate limits
- Admin dashboard access throttling

---

## Data Retention

- **Sessions**: Retained indefinitely until deleted by user or admin
- **User metadata**: Retained for 2 years after last activity
- **Audit logs**: Retained for 90 days

---

## Security Considerations

1. **Always use HTTPS** in production
2. **Token expiration**: Tokens from Entra ID have default expiration (typically 1 hour)
3. **Refresh tokens**: Implement automatic token refresh on the client
4. **CORS**: Configure appropriate allowed origins
5. **Admin role**: Verify admin roles are assigned through Entra ID tenant
6. **Audit logging**: All admin operations are logged (details available upon request)

---

## Environment Configuration

**Required Environment Variables:**

```bash
# Cosmos DB Configuration
COSMOS_CONNECTION_STRING=DefaultEndpointProtocol=https://...
COSMOS_DATABASE=sentinel-db
COSMOS_SESSIONS_CONTAINER=sessions

# Entra ID Configuration (for admin endpoints)
ENTRA_EXTERNAL_ID_ISSUER=https://sentineloptimizer.ciamlogin.com
ENTRA_EXTERNAL_ID_JWKS_URI=https://sentineloptimizer.ciamlogin.com/discover
ENTRA_EXTERNAL_ID_AUDIENCE=<client-id>
ENTRA_EXTERNAL_ID_ADMIN_ROLE=SentinelOptimizer.Admin

# Optional: AI Configuration
AI_API_ENABLED=true
AI_MODEL=@cf/meta/llama-3.1-8b-instruct
```

---

## Deployment

### Azure Functions Configuration

Each endpoint is configured in `function.json`:

```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["GET"],
      "route": "admin/stats"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "$return"
    }
  ]
}
```

### Local Testing

```bash
# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# Start local Azure Functions runtime
func start

# API available at http://localhost:7071/api/*
```

### Azure Deployment

```bash
# Build
npm run build

# Deploy to Azure
func azure functionapp publish <function-app-name>
```

---

## Frequently Asked Questions

### Q: How do I get an admin token?

A: Admin tokens are issued by Entra ID after user login. The user account must have the `SentinelOptimizer.Admin` role assigned in the Entra ID tenant.

### Q: Can users access each other's sessions?

A: No. Each endpoint validates that the `userId` in the token matches the requested session's owner. Cross-user access is not allowed.

### Q: What's the maximum session size?

A: Sessions are limited to 5MB by default. Contact support for larger allocations.

### Q: How often should I call the stats endpoint?

A: The stats endpoint is designed for periodic monitoring (e.g., every 5-15 minutes). Frequent polling is not recommended.

### Q: Are sessions encrypted?

A: Sessions are stored in Cosmos DB with encryption at rest. Transport security is provided by HTTPS.

---

## Support

For issues or questions, please contact support or create an issue in the repository.

---

**Last Updated**: 2026-08-11  
**Version**: 1.0.0  
**License**: MIT

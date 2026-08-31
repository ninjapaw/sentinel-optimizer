// MIT License
// Copyright (c) 2026 Microsoft Corporation
// See LICENSE in the repository root.

targetScope = 'resourceGroup'

@description('Globally unique Azure Function App name.')
@minLength(2)
@maxLength(60)
param functionAppName string

@description('Azure region for the Function App and its supporting resources.')
param location string = resourceGroup().location

@description('Deployment environment used for resource tags.')
param environmentName string = 'development'

@description('Flex Consumption memory per instance. 512 MB is the lowest-cost default; use 2048 or 4096 MB for memory- or CPU-intensive workloads.')
@allowed([
  512
  2048
  4096
])
param instanceMemoryMB int = 512

@description('Maximum number of on-demand Flex Consumption instances. This limits burst scale, not idle cost.')
@minValue(40)
@maxValue(1000)
param maximumInstanceCount int = 40

@description('Always-ready HTTP instances. Zero scales to zero and is the lowest-cost default; increase only to reduce cold starts.')
@minValue(0)
@maxValue(1000)
param alwaysReadyInstanceCount int = 0

@description('Storage redundancy for Functions host and deployment data. Standard_LRS is cheapest; select ZRS or geo-redundant options for stronger resilience.')
@allowed([
  'Standard_LRS'
  'Standard_ZRS'
  'Standard_GRS'
  'Standard_GZRS'
])
param storageSkuName string = 'Standard_LRS'

@description('Allowed browser origins. Add the exact Static Web App URL after provisioning it.')
param allowedOrigins array = []

@description('Expose anonymous paid AI routes. Keep false unless an external gateway enforces authentication, rate limits, quotas, and spending controls.')
param enableAnonymousAiRoutes bool = false

@description('Microsoft Entra External ID issuer used to validate admin API tokens.')
param entraExternalIdIssuer string = ''

@description('Microsoft Entra External ID JWKS URI used to validate admin API tokens.')
param entraExternalIdJwksUri string = ''

@description('Expected audience for admin API access tokens.')
param entraExternalIdAudience string = ''

@description('Required app role claim for admin API access.')
param entraExternalIdAdminRole string = 'SentinelOptimizer.Admin'

@description('Object ID of the GitHub OIDC service principal used for API code deployment. Leave blank only when deployment access is configured separately.')
param apiDeploymentPrincipalId string = ''

@description('Cosmos DB endpoint used with the Function App managed identity. Prefer this over a connection string.')
param cosmosEndpoint string = ''

@description('Log Analytics workspace resource ID for Function diagnostics.')
param logAnalyticsWorkspaceId string = ''

@description('Workspace-based Application Insights connection string.')
@secure()
param applicationInsightsConnectionString string = ''

@description('Key Vault name that stores API runtime secrets. Leave blank to keep plaintext app settings.')
param keyVaultName string = ''

@description('Key Vault secret name holding the third-party AI API key. Requires keyVaultName and a secret that already exists.')
param aiApiKeySecretName string = ''

@description('Cosmos DB database name for sessions.')
param cosmosDatabaseName string = 'sentinel-optimizer'

@description('Cosmos DB container name for sessions.')
param cosmosSessionsContainerName string = 'sessions'

@description('Resource tags applied to the API resources.')
param tags object = {}

var resourceTags = union({
  application: 'sentinel-optimizer'
  environment: environmentName
  component: 'api'
  managedBy: 'bicep'
}, tags)

var storageAccountName = take('st${uniqueString(resourceGroup().id, functionAppName)}', 24)
var deploymentContainerName = 'function-releases'

// Key Vault references omit the secret version so rotation is picked up without redeploying.
var aiApiKeySettings = (!empty(keyVaultName) && !empty(aiApiKeySecretName)) ? [
  {
    name: 'AI_API_KEY'
    value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=${aiApiKeySecretName})'
  }
] : []

resource storageAccount 'Microsoft.Storage/storageAccounts@2025-01-01' = {
  name: storageAccountName
  location: location
  tags: resourceTags
  kind: 'StorageV2'
  sku: {
    name: storageSkuName
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2025-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-01-01' = {
  parent: blobService
  name: deploymentContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource flexPlan 'Microsoft.Web/serverfarms@2025-03-01' = {
  name: '${functionAppName}-plan'
  location: location
  tags: resourceTags
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2025-03-01' = {
  name: functionAppName
  location: location
  tags: resourceTags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    clientAffinityEnabled: false
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    serverFarmId: flexPlan.id
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storageAccount.properties.primaryEndpoints.blob}${deploymentContainer.name}'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      runtime: {
        name: 'node'
        version: '22'
      }
      scaleAndConcurrency: {
        instanceMemoryMB: instanceMemoryMB
        maximumInstanceCount: maximumInstanceCount
        alwaysReady: alwaysReadyInstanceCount == 0 ? [] : [
          {
            name: 'http'
            instanceCount: alwaysReadyInstanceCount
          }
        ]
      }
    }
    siteConfig: {
      appSettings: concat([
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storageAccount.name
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_NODE_BLOCK_ON_ENTRY_POINT_ERROR'
          value: 'true'
        }
        {
          name: 'AI_API_ENABLED'
          value: string(enableAnonymousAiRoutes)
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsightsConnectionString
        }
        {
          name: 'ENTRA_EXTERNAL_ID_ISSUER'
          value: entraExternalIdIssuer
        }
        {
          name: 'ENTRA_EXTERNAL_ID_JWKS_URI'
          value: entraExternalIdJwksUri
        }
        {
          name: 'ENTRA_EXTERNAL_ID_AUDIENCE'
          value: entraExternalIdAudience
        }
        {
          name: 'ENTRA_EXTERNAL_ID_ADMIN_ROLE'
          value: entraExternalIdAdminRole
        }
        {
          name: 'COSMOS_ENDPOINT'
          value: cosmosEndpoint
        }
        {
          name: 'COSMOS_DATABASE'
          value: cosmosDatabaseName
        }
        {
          name: 'COSMOS_SESSIONS_CONTAINER'
          value: cosmosSessionsContainerName
        }
      ], aiApiKeySettings)
      cors: {
        allowedOrigins: allowedOrigins
        supportCredentials: false
      }
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
    }
  }
}

resource storageBlobDataOwner 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
}

resource storageQueueDataContributor 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
}

resource storageTableDataContributor 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
}

resource blobRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionApp.id, storageBlobDataOwner.id)
  scope: storageAccount
  properties: {
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: storageBlobDataOwner.id
  }
}

resource queueRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionApp.id, storageQueueDataContributor.id)
  scope: storageAccount
  properties: {
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: storageQueueDataContributor.id
  }
}

resource tableRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionApp.id, storageTableDataContributor.id)
  scope: storageAccount
  properties: {
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: storageTableDataContributor.id
  }
}

resource websiteContributor 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: 'de139f84-1756-47ae-9be6-808fbbe84772'
}

resource apiDeploymentRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(apiDeploymentPrincipalId)) {
  name: guid(functionApp.id, apiDeploymentPrincipalId, websiteContributor.id)
  scope: functionApp
  properties: {
    principalId: apiDeploymentPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: websiteContributor.id
  }
}

// Azure ships no stable diagnosticSettings API newer than 2016-09-01.
#disable-next-line use-recent-api-versions
resource functionDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(logAnalyticsWorkspaceId)) {
  name: 'sentinel-optimizer-function-diagnostics'
  scope: functionApp
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

output resourceId string = functionApp.id
output functionAppName string = functionApp.name
output apiUrl string = 'https://${functionApp.properties.defaultHostName}'
output managedIdentityPrincipalId string = functionApp.identity.principalId
output storageAccountName string = storageAccount.name

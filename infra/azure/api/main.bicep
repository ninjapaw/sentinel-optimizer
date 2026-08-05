targetScope = 'resourceGroup'

@description('Globally unique Azure Function App name.')
@minLength(2)
@maxLength(60)
param functionAppName string

@description('Azure region for the Function App and its supporting resources.')
param location string = resourceGroup().location

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

@description('Object ID of the GitHub OIDC service principal used for API code deployment. Leave blank only when deployment access is configured separately.')
param apiDeploymentPrincipalId string = ''

@description('Resource tags applied to the API resources.')
param tags object = {}

var storageAccountName = take('st${uniqueString(resourceGroup().id, functionAppName)}', 24)
var deploymentContainerName = 'function-releases'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
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

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: deploymentContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource flexPlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${functionAppName}-plan'
  location: location
  tags: tags
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: functionAppName
  location: location
  tags: tags
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
      appSettings: [
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
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'AI_API_ENABLED'
          value: string(enableAnonymousAiRoutes)
        }
      ]
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

output resourceId string = functionApp.id
output functionAppName string = functionApp.name
output apiUrl string = 'https://${functionApp.properties.defaultHostName}'
output managedIdentityPrincipalId string = functionApp.identity.principalId
output storageAccountName string = storageAccount.name

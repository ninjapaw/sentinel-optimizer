// MIT License
// Copyright (c) 2026 Microsoft Corporation
// See LICENSE in the repository root.

targetScope = 'subscription'

@description('Environment-specific resource group name.')
param resourceGroupName string

@description('Azure region for all regional resources.')
param location string = 'centralus'

@description('Deployment environment used for tags and conditional resources.')
param environmentName string = 'development'

@description('Static Web App resource name.')
param siteName string

@description('Static Web App plan name.')
@allowed([
  'Free'
  'Standard'
])
param siteSkuName string = 'Free'

@description('DNS-validated custom domain. Leave blank until the external DNS provider is ready.')
param customDomainName string = ''

@description('Function App resource name.')
param functionAppName string

@description('Flex Consumption memory per instance.')
@allowed([
  512
  2048
  4096
])
param instanceMemoryMB int = 512

@description('Maximum Flex Consumption instances.')
@minValue(40)
@maxValue(1000)
param maximumInstanceCount int = 40

@description('Always-ready HTTP instances.')
@minValue(0)
@maxValue(1000)
param alwaysReadyInstanceCount int = 0

@description('Functions storage redundancy SKU.')
@allowed([
  'Standard_LRS'
  'Standard_ZRS'
  'Standard_GRS'
  'Standard_GZRS'
])
param storageSkuName string = 'Standard_LRS'

@description('Function deployment principal object ID.')
param apiDeploymentPrincipalId string = ''

@description('Entra External ID issuer.')
param entraExternalIdIssuer string = ''

@description('Entra External ID JWKS URI.')
param entraExternalIdJwksUri string = ''

@description('Expected Entra External ID audience.')
param entraExternalIdAudience string = ''

@description('Required administrator app role.')
param entraExternalIdAdminRole string = 'SentinelOptimizer.Admin'

@description('Whether anonymous AI routes are enabled.')
param enableAnonymousAiRoutes bool = false

@description('Key Vault resource name.')
param keyVaultName string

@description('Infrastructure deployment principal object ID for Key Vault administration.')
param infrastructurePrincipalId string = ''

@description('Enable optional Azure OpenAI resources.')
param deployOpenAi bool = false

@description('Azure OpenAI account name.')
param openAiAccountName string = ''

@description('Azure OpenAI model name.')
param openAiModelName string = 'gpt-4.1-mini'

@description('Azure OpenAI deployment name.')
param openAiModelDeployment string = 'sentinel-optimizer-model'

@description('Azure OpenAI deployment SKU.')
@allowed([
  'GlobalStandard'
  'DataZoneStandard'
  'Standard'
])
param openAiDeploymentSku string = 'GlobalStandard'

@description('Azure OpenAI model capacity.')
@minValue(1)
param openAiModelCapacity int = 1

@description('Cosmos DB account name prefix.')
param cosmosNamePrefix string = 'sentinel-optimizer'

@description('Cosmos DB database name.')
param cosmosDatabaseName string = 'sentinel-optimizer'

@description('Cosmos DB sessions container name.')
param cosmosSessionsContainerName string = 'sessions'

@description('Enable public network access for Cosmos DB. Required by this baseline until private networking is introduced.')
param cosmosPublicNetworkAccess bool = true

@description('Log Analytics workspace name.')
param logAnalyticsName string

@description('Application Insights component name.')
param applicationInsightsName string

@description('Allowed browser origins for the API.')
param allowedOrigins array = []

@description('Resource tags applied to all resources.')
param tags object = {
  application: 'sentinel-optimizer'
  managedBy: 'bicep'
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2025-04-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module monitoring './modules/monitoring.bicep' = {
  name: 'sentinel-optimizer-monitoring-${environmentName}'
  scope: resourceGroup
  params: {
    location: location
    environmentName: environmentName
    workspaceName: logAnalyticsName
    applicationInsightsName: applicationInsightsName
    tags: tags
  }
}

module site './site/main.bicep' = {
  name: 'sentinel-optimizer-site-${environmentName}'
  scope: resourceGroup
  params: {
    siteName: siteName
    location: location
    environmentName: environmentName
    siteSkuName: siteSkuName
    tags: tags
  }
}

module customDomain './modules/custom-domain.bicep' = if (!empty(customDomainName)) {
  name: 'sentinel-optimizer-domain-${environmentName}'
  scope: resourceGroup
  params: {
    siteName: siteName
    customDomainName: customDomainName
  }
  dependsOn: [site]
}

module storage './storage/main.bicep' = {
  name: 'sentinel-optimizer-cosmos-${environmentName}'
  scope: resourceGroup
  params: {
    location: location
    namePrefix: cosmosNamePrefix
    databaseName: cosmosDatabaseName
    sessionsContainerName: cosmosSessionsContainerName
    publicNetworkAccess: cosmosPublicNetworkAccess
    tags: tags
  }
}

module api './api/main.bicep' = {
  name: 'sentinel-optimizer-api-${environmentName}'
  scope: resourceGroup
  params: {
    functionAppName: functionAppName
    location: location
    environmentName: environmentName
    instanceMemoryMB: instanceMemoryMB
    maximumInstanceCount: maximumInstanceCount
    alwaysReadyInstanceCount: alwaysReadyInstanceCount
    storageSkuName: storageSkuName
    allowedOrigins: allowedOrigins
    enableAnonymousAiRoutes: enableAnonymousAiRoutes
    entraExternalIdIssuer: entraExternalIdIssuer
    entraExternalIdJwksUri: entraExternalIdJwksUri
    entraExternalIdAudience: entraExternalIdAudience
    entraExternalIdAdminRole: entraExternalIdAdminRole
    apiDeploymentPrincipalId: apiDeploymentPrincipalId
    cosmosEndpoint: storage.outputs.endpoint
    cosmosDatabaseName: storage.outputs.databaseName
    cosmosSessionsContainerName: storage.outputs.sessionsContainerName
    applicationInsightsConnectionString: monitoring.outputs.applicationInsightsConnectionString
    logAnalyticsWorkspaceId: monitoring.outputs.workspaceId
    tags: tags
  }
}

module cosmosRbac './modules/cosmos-rbac.bicep' = {
  name: 'sentinel-optimizer-cosmos-rbac-${environmentName}'
  scope: resourceGroup
  params: {
    accountName: storage.outputs.accountName
    principalId: api.outputs.managedIdentityPrincipalId
  }
}

module keyVault './keyvault/main.bicep' = {
  name: 'sentinel-optimizer-keyvault-${environmentName}'
  scope: resourceGroup
  params: {
    keyVaultName: keyVaultName
    location: location
    environmentName: environmentName
    functionAppName: functionAppName
    deploymentPrincipalId: infrastructurePrincipalId
    logAnalyticsWorkspaceId: monitoring.outputs.workspaceId
    tags: tags
  }
  dependsOn: [api]
}

module ai './ai/main.bicep' = if (deployOpenAi) {
  name: 'sentinel-optimizer-ai-${environmentName}'
  scope: resourceGroup
  params: {
    openAiAccountName: openAiAccountName
    functionAppName: functionAppName
    location: location
    environmentName: environmentName
    modelDeploymentName: openAiModelDeployment
    modelName: openAiModelName
    modelDeploymentSkuName: openAiDeploymentSku
    modelCapacity: openAiModelCapacity
    tags: tags
  }
  dependsOn: [api]
}

output resourceGroupId string = resourceGroup.id
output resourceGroupName string = resourceGroup.name
output staticWebAppUrl string = site.outputs.siteUrl
output functionAppUrl string = api.outputs.apiUrl
output cosmosEndpoint string = storage.outputs.endpoint
output logAnalyticsWorkspaceId string = monitoring.outputs.workspaceId
output applicationInsightsId string = monitoring.outputs.applicationInsightsId

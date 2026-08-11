// MIT License
// Copyright (c) 2026 Microsoft Corporation
// See LICENSE in the repository root.

targetScope = 'resourceGroup'

@description('Globally unique Azure OpenAI account name.')
@minLength(2)
@maxLength(64)
param openAiAccountName string

@description('Name of the existing Azure Function App that will call Azure OpenAI.')
param functionAppName string

@description('Azure region where the selected Azure OpenAI model is available.')
param location string = resourceGroup().location

@description('Deployment environment used for resource tags.')
param environmentName string = 'development'

@description('Azure OpenAI deployment name written to the Function App settings.')
param modelDeploymentName string = 'sentinel-optimizer-model'

@description('Azure OpenAI model name. Availability varies by region and subscription.')
param modelName string = 'gpt-4.1-mini'

@description('Optional model version. Leave blank to use the service default version.')
param modelVersion string = ''

@description('Azure OpenAI deployment type. GlobalStandard is the recommended pay-as-you-go default; choose a narrower geography only for data-processing requirements.')
@allowed([
  'GlobalStandard'
  'DataZoneStandard'
  'Standard'
])
param modelDeploymentSkuName string = 'GlobalStandard'

@description('Model deployment capacity in thousands of tokens per minute. Start at 1 and increase only when observed throughput requires it.')
@minValue(1)
param modelCapacity int = 1

@description('Resource tags applied to Azure OpenAI resources.')
param tags object = {}

var resourceTags = union({
  application: 'sentinel-optimizer'
  environment: environmentName
  component: 'ai'
  managedBy: 'bicep'
}, tags)

resource functionApp 'Microsoft.Web/sites@2024-04-01' existing = {
  name: functionAppName
}

resource openAiAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: openAiAccountName
  location: location
  tags: resourceTags
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: openAiAccountName
    disableLocalAuth: true
    networkAcls: {
      defaultAction: 'Allow'
    }
    publicNetworkAccess: 'Enabled'
  }
}

resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: openAiAccount
  name: modelDeploymentName
  sku: {
    name: modelDeploymentSkuName
    capacity: modelCapacity
  }
  properties: {
    model: union({
      format: 'OpenAI'
      name: modelName
    }, empty(modelVersion) ? {} : {
      version: modelVersion
    })
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
}

resource cognitiveServicesOpenAiUser 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
}

resource openAiUserRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openAiAccount.id, functionApp.id, cognitiveServicesOpenAiUser.id)
  scope: openAiAccount
  properties: {
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: cognitiveServicesOpenAiUser.id
  }
}

resource functionAppSettings 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: functionApp
  name: 'appsettings'
  properties: union(functionApp.listApplicationSettings().properties, {
    AZURE_OPENAI_DEPLOYMENT: modelDeployment.name
    AZURE_OPENAI_ENDPOINT: openAiAccount.properties.endpoint
  })
}

output resourceId string = openAiAccount.id
output endpoint string = openAiAccount.properties.endpoint
output modelDeploymentName string = modelDeployment.name
output functionAppName string = functionApp.name

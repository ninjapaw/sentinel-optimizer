// MIT License
// Copyright (c) 2026 Microsoft Corporation
// See LICENSE in the repository root.

using './main.bicep'

param functionAppName = 'sentinel-optimizer-example-api'
param location = 'eastus2'
param environmentName = 'development'
param instanceMemoryMB = 512
param maximumInstanceCount = 40
param alwaysReadyInstanceCount = 0
param storageSkuName = 'Standard_LRS'
param apiDeploymentPrincipalId = ''
param cosmosConnectionString = ''
param cosmosDatabaseName = 'sentinel-optimizer'
param cosmosSessionsContainerName = 'sessions'
param enableAnonymousAiRoutes = false
param entraExternalIdIssuer = ''
param entraExternalIdJwksUri = ''
param entraExternalIdAudience = ''
param entraExternalIdAdminRole = 'SentinelOptimizer.Admin'
param allowedOrigins = [
  'https://sentinel-optimizer-example-site.azurestaticapps.net'
]
param tags = {
  application: 'sentinel-optimizer'
  component: 'api'
}

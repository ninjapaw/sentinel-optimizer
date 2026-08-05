using './main.bicep'

param functionAppName = 'replace-with-unique-api-name'
param location = 'eastus2'
param instanceMemoryMB = 512
param maximumInstanceCount = 40
param alwaysReadyInstanceCount = 0
param storageSkuName = 'Standard_LRS'
param apiDeploymentPrincipalId = ''
param enableAnonymousAiRoutes = false
param allowedOrigins = [
  'https://replace-with-static-site-hostname.azurestaticapps.net'
]
param tags = {
  application: 'sentinel-optimizer'
  component: 'api'
}

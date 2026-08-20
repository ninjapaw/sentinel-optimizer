using './main.bicep'

param resourceGroupName = 'NP-SentinelOptimizer-Dev-CentralUS'
param location = 'centralus'
param environmentName = 'development'
param siteName = 'np-sentineloptimizer-dev-centralus'
param siteSkuName = 'Free'
param customDomainName = ''
param functionAppName = 'np-sentineloptimizer-api-dev-centralus'
param instanceMemoryMB = 512
param maximumInstanceCount = 40
param alwaysReadyInstanceCount = 0
param storageSkuName = 'Standard_LRS'
param keyVaultName = 'sentinel-opt-dev-kv'
param deployOpenAi = false
param openAiAccountName = 'sentinel-opt-dev-openai'
param openAiModelName = 'gpt-4.1-mini'
param openAiModelDeployment = 'sentinel-optimizer-model'
param openAiDeploymentSku = 'GlobalStandard'
param openAiModelCapacity = 1
param cosmosNamePrefix = 'sentinel-optimizer-dev'
param cosmosDatabaseName = 'sentinel-optimizer'
param cosmosSessionsContainerName = 'sessions'
param cosmosPublicNetworkAccess = true
param logAnalyticsName = 'log-sentinel-optimizer-dev'
param applicationInsightsName = 'appi-sentinel-optimizer-dev'
param allowedOrigins = [
  'https://dev.sentineloptimizer.com'
]

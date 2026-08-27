using './main.bicep'

param location = 'centralus'
param environmentName = 'production'
param siteName = 'np-sentineloptimizer-centralus'
param siteSkuName = 'Free'
param customDomainName = ''
param functionAppName = 'np-sentineloptimizer-api-centralus'
param instanceMemoryMB = 512
param maximumInstanceCount = 40
param alwaysReadyInstanceCount = 0
param storageSkuName = 'Standard_LRS'
param keyVaultName = 'sentinel-opt-prod-kv'
param deployOpenAi = false
param openAiAccountName = 'sentinel-opt-openai'
param openAiModelName = 'gpt-4.1-mini'
param openAiModelDeployment = 'sentinel-optimizer-model'
param openAiDeploymentSku = 'GlobalStandard'
param openAiModelCapacity = 1
param cosmosNamePrefix = 'sentinel-optimizer-prod'
param cosmosDatabaseName = 'sentinel-optimizer'
param cosmosSessionsContainerName = 'sessions'
param cosmosPublicNetworkAccess = true
param logAnalyticsName = 'log-sentinel-optimizer-prod'
param applicationInsightsName = 'appi-sentinel-optimizer-prod'
param allowedOrigins = [
  'https://sentineloptimizer.com'
]

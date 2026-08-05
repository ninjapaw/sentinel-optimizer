using './main.bicep'

param openAiAccountName = 'replace-with-unique-openai-name'
param functionAppName = 'replace-with-existing-api-name'
param location = 'eastus2'
param modelDeploymentName = 'sentinel-optimizer-model'
param modelName = 'gpt-4.1-mini'
param modelDeploymentSkuName = 'GlobalStandard'
param modelCapacity = 1
param tags = {
  application: 'sentinel-optimizer'
  component: 'ai'
}

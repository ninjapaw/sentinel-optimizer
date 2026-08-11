// MIT License
// Copyright (c) 2026 Microsoft Corporation
// See LICENSE in the repository root.

using './main.bicep'

param openAiAccountName = 'sentinel-optimizer-example-openai'
param functionAppName = 'sentinel-optimizer-example-api'
param location = 'eastus2'
param environmentName = 'development'
param modelDeploymentName = 'sentinel-optimizer-model'
param modelName = 'gpt-4.1-mini'
param modelDeploymentSkuName = 'GlobalStandard'
param modelCapacity = 1
param tags = {
  application: 'sentinel-optimizer'
  component: 'ai'
}

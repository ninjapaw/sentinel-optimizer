// MIT License
// Copyright (c) 2026 Microsoft Corporation
// See LICENSE in the repository root.

using './main.bicep'

param keyVaultName = 'sentinel-opt-dev-kv'
param location = 'eastus2'
param environmentName = 'development'
param functionAppName = 'sentinel-optimizer-example-api'
param deploymentPrincipalId = ''
param skuName = 'standard'
param softDeleteRetentionInDays = 90
param allowPublicNetworkAccess = true
param logAnalyticsWorkspaceId = ''
param tags = {
  application: 'sentinel-optimizer'
  component: 'keyvault'
}

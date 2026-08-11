// MIT License
// Copyright (c) 2026 Microsoft Corporation
// See LICENSE in the repository root.

targetScope = 'subscription'

@description('Resource group used by Sentinel Optimizer Azure deployments.')
@minLength(1)
@maxLength(90)
param resourceGroupName string = 'rg-sentinel-optimizer-prod'

@description('Azure region for the resource group metadata and deployment location.')
param location string = 'eastus2'

@description('Tags applied to the resource group.')
param tags object = {
  application: 'sentinel-optimizer'
  managedBy: 'bicep'
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2025-04-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

output resourceGroupId string = resourceGroup.id
output resourceGroupName string = resourceGroup.name

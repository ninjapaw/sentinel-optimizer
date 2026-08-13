// MIT License
// Copyright (c) 2026 Microsoft Corporation
// See LICENSE in the repository root.

targetScope = 'resourceGroup'

@description('Globally unique Key Vault name.')
@minLength(3)
@maxLength(24)
param keyVaultName string

@description('Azure region for the Key Vault.')
param location string = resourceGroup().location

@description('Deployment environment used for resource tags.')
param environmentName string = 'development'

@description('Name of the existing Function App whose managed identity reads secrets. Leave blank to skip the read role assignment.')
param functionAppName string = ''

@description('Object ID of the deployment principal that rotates secrets. Leave blank when secrets are managed outside the pipeline.')
param deploymentPrincipalId string = ''

@description('Key Vault SKU. Use premium only when HSM-backed keys are required.')
@allowed([
  'standard'
  'premium'
])
param skuName string = 'standard'

@description('Days that soft-deleted secrets remain recoverable before permanent deletion.')
@minValue(7)
@maxValue(90)
param softDeleteRetentionInDays int = 90

@description('Allow public network access. Disable only after private endpoints and VNet-integrated callers are in place.')
param allowPublicNetworkAccess bool = true

@description('Optional Log Analytics workspace resource ID that receives Key Vault audit logs.')
param logAnalyticsWorkspaceId string = ''

@description('Resource tags applied to the Key Vault.')
param tags object = {}

var resourceTags = union({
  application: 'sentinel-optimizer'
  environment: environmentName
  component: 'keyvault'
  managedBy: 'bicep'
}, tags)

resource functionApp 'Microsoft.Web/sites@2024-04-01' existing = if (!empty(functionAppName)) {
  name: functionAppName
}

// Purge protection is intentionally not parameterized: Azure does not allow it to
// be turned off once enabled, and disabling it would permit irreversible secret loss.
resource keyVault 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: keyVaultName
  location: location
  tags: resourceTags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: skuName
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: softDeleteRetentionInDays
    enablePurgeProtection: true
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: false
    publicNetworkAccess: allowPublicNetworkAccess ? 'Enabled' : 'Disabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: allowPublicNetworkAccess ? 'Allow' : 'Deny'
      ipRules: []
      virtualNetworkRules: []
    }
  }
}

resource keyVaultSecretsUser 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: '4633458b-17de-408a-b874-0445c86b69e6'
}

resource keyVaultSecretsOfficer 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'
}

resource functionAppSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(functionAppName)) {
  name: guid(keyVault.id, functionAppName, keyVaultSecretsUser.id)
  scope: keyVault
  properties: {
    principalId: functionApp!.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: keyVaultSecretsUser.id
  }
}

resource deploymentSecretsOfficer 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(deploymentPrincipalId)) {
  name: guid(keyVault.id, deploymentPrincipalId, keyVaultSecretsOfficer.id)
  scope: keyVault
  properties: {
    principalId: deploymentPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: keyVaultSecretsOfficer.id
  }
}

resource auditLogs 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(logAnalyticsWorkspaceId)) {
  name: 'sentinel-optimizer-keyvault-audit'
  scope: keyVault
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'AuditEvent'
        enabled: true
      }
    ]
    metrics: []
  }
}

output resourceId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri

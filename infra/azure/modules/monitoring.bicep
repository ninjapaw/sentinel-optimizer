// MIT License
// Copyright (c) 2026 Microsoft Corporation
// See LICENSE in the repository root.

targetScope = 'resourceGroup'

@description('Azure region for monitoring resources.')
param location string = resourceGroup().location

@description('Environment name used in resource tags and names.')
param environmentName string

@description('Log Analytics workspace name. Must be globally unique within the resource group.')
param workspaceName string

@description('Application Insights component name.')
param applicationInsightsName string

@description('Workspace retention in days.')
@minValue(30)
@maxValue(730)
param retentionInDays int = 30

@description('Daily Log Analytics ingestion cap in GB. Zero disables the cap.')
@minValue(0)
param dailyQuotaGb int = 1

@description('Resource tags applied to monitoring resources.')
param tags object = {}

var resourceTags = union({
  application: 'sentinel-optimizer'
  environment: environmentName
  component: 'monitoring'
  managedBy: 'bicep'
}, tags)

resource workspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: workspaceName
  location: location
  tags: resourceTags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionInDays
    workspaceCapping: {
      dailyQuotaGb: dailyQuotaGb
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  tags: resourceTags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
    DisableIpMasking: false
    SamplingPercentage: 20
  }
}

output workspaceId string = workspace.id
output workspaceName string = workspace.name
output applicationInsightsConnectionString string = applicationInsights.properties.ConnectionString
output applicationInsightsId string = applicationInsights.id

// MIT License
// Copyright (c) 2026 Microsoft Corporation
// See LICENSE in the repository root.

using './main.bicep'

param siteName = 'sentinel-optimizer-example-site'
param location = 'eastus2'
param environmentName = 'development'
param siteSkuName = 'Free'
param tags = {
  application: 'sentinel-optimizer'
  component: 'web'
}

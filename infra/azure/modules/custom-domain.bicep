// MIT License
// Copyright (c) 2026 Microsoft Corporation
// See LICENSE in the repository root.

targetScope = 'resourceGroup'

@description('Existing Static Web App name.')
param siteName string

@description('DNS-validated custom domain. Leave blank until the external DNS provider is ready.')
param customDomainName string = ''

resource staticSite 'Microsoft.Web/staticSites@2025-03-01' existing = {
  name: siteName
}

resource customDomain 'Microsoft.Web/staticSites/customDomains@2022-09-01' = if (!empty(customDomainName)) {
  parent: staticSite
  name: customDomainName
  properties: {
    validationMethod: 'dns-txt-token'
  }
}

output customDomainResourceId string = !empty(customDomainName) ? customDomain.id : ''

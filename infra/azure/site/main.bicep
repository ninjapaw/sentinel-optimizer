targetScope = 'resourceGroup'

@description('Globally unique Azure Static Web App name.')
@minLength(2)
@maxLength(40)
param siteName string

@description('Azure region for the Static Web App resource metadata.')
param location string = 'eastus2'

@description('Static Web Apps plan. Free is recommended until Standard-only limits or features are required.')
@allowed([
  'Free'
  'Standard'
])
param siteSkuName string = 'Free'

@description('Resource tags applied to the Static Web App.')
param tags object = {}

resource staticSite 'Microsoft.Web/staticSites@2025-03-01' = {
  name: siteName
  location: location
  tags: tags
  sku: {
    name: siteSkuName
    tier: siteSkuName
  }
  properties: {
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Enabled'
  }
}

output resourceId string = staticSite.id
output defaultHostname string = staticSite.properties.defaultHostname
output siteUrl string = 'https://${staticSite.properties.defaultHostname}'

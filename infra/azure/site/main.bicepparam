using './main.bicep'

param siteName = 'replace-with-unique-site-name'
param location = 'eastus2'
param siteSkuName = 'Free'
param tags = {
  application: 'sentinel-optimizer'
  component: 'web'
}

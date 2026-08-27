/*
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

@description('Location for the Cosmos DB account.')
param location string = resourceGroup().location

@description('Name prefix for Cosmos DB resources.')
param namePrefix string

@description('Database name for user sessions.')
param databaseName string = 'sentinel-optimizer'

@description('Container name for sessions.')
param sessionsContainerName string = 'sessions'

@description('Enable public network access. Flex Consumption requires public data-plane access until private networking is introduced.')
param publicNetworkAccess bool = true

@description('Resource tags applied to the Cosmos resources.')
param tags object = {}

var resourceTags = union({
  application: 'sentinel-optimizer'
  component: 'storage'
  managedBy: 'bicep'
}, tags)

var accountName = '${toLower(replace(namePrefix, '-', ''))}db${uniqueString(resourceGroup().id)}'

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: accountName
  location: location
  tags: resourceTags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    disableLocalAuth: true
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    publicNetworkAccess: publicNetworkAccess ? 'Enabled' : 'Disabled'
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

resource sessionsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: sessionsContainerName
  properties: {
    resource: {
      id: sessionsContainerName
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
      }
      uniqueKeyPolicy: {
        uniqueKeys: []
      }
    }
  }
}

@description('Cosmos DB account name.')
output accountName string = cosmosAccount.name

@description('Cosmos DB endpoint for managed-identity clients.')
output endpoint string = cosmosAccount.properties.documentEndpoint

@description('Cosmos DB database name.')
output databaseName string = databaseName

@description('Cosmos DB sessions container name.')
output sessionsContainerName string = sessionsContainerName

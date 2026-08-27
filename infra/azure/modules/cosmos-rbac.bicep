// MIT License
// Copyright (c) 2026 Microsoft Corporation
// See LICENSE in the repository root.

targetScope = 'resourceGroup'

@description('Existing Cosmos DB account name.')
param accountName string

@description('Function App managed identity principal ID.')
param principalId string

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: accountName
}

resource cosmosDataContributor 'Microsoft.DocumentDB/databaseAccounts/sqlRoleDefinitions@2024-05-15' existing = {
  parent: cosmosAccount
  name: '00000000-0000-0000-0000-000000000002'
}

resource cosmosDataRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  parent: cosmosAccount
  name: guid(accountName, principalId, 'cosmos-data-contributor')
  properties: {
    principalId: principalId
    roleDefinitionId: cosmosDataContributor.id
    scope: cosmosAccount.id
  }
}

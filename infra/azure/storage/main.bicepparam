using './main.bicep'

param location = readEnvironmentVariable('AZURE_REGION')
param namePrefix = readEnvironmentVariable('AZURE_RESOURCE_NAME_PREFIX')
param databaseName = 'sentinel-optimizer'
param sessionsContainerName = 'sessions'
param publicNetworkAccess = false

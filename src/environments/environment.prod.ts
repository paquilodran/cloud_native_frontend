export const environment = {
  production: true,
  apiUrl: 'https://TU-BACKEND.azurewebsites.net/api',
  azure: {
    tenantId: 'TU-TENANT-ID',
    clientId: 'CLIENT-ID-DE-PEDIDOS360-WEB',
    apiClientId: 'CLIENT-ID-DE-PEDIDOS360-API',
    redirectUri: 'https://TU-FRONTEND.azurewebsites.net',
    postLogoutRedirectUri: 'https://TU-FRONTEND.azurewebsites.net',
    apiScopes: ['api://CLIENT-ID-DE-PEDIDOS360-API/access_as_user']
  }
};

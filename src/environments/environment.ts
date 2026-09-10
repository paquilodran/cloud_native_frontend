export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  azure: {
    tenantId: '4531cbe0-83c7-406d-a972-e6302b1fb7d1',
    clientId: '6453ffd4-e484-4eff-acc6-8c4918f7f157',
    apiClientId: '3609dffc-ca49-4133-a6e5-2dbf3ba2a120',
    redirectUri: 'http://localhost:4200',
    postLogoutRedirectUri: 'http://localhost:4200',
    apiScopes: ['api://3609dffc-ca49-4133-a6e5-2dbf3ba2a120/access_as_user']
  }
};

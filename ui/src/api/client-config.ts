export interface ClientConfig {
  env: 'dev' | 'int' | 'prod';
  ion_default_access_token: string;
  auth: {
    cognito_client_id: string;
    cognito_pool_id: string;
    cognito_identity_pool_id: string;
    cognito_aws_region: string;
  };
}

import Auth from './auth.js';
import AWS from 'aws-sdk';

export default class S3 {

    static list() {
        var idToken = Auth.getIdToken();

        AWS.config.region = 'eu-central-1';

        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: 'eu-central-1:21355ebf-703b-44dd-8900-f8bc391b4bde',
            Logins: {
                'cognito-idp.eu-central-1.amazonaws.com/eu-central-1_5wXXpcDt8': idToken
            }
        });

        AWS.config.credentials.get(function(err) {
            if (err) return console.error(err);
            else console.log(AWS.config.credentials);

            var s3 = new AWS.S3({
                apiVersion: '2006-03-01',
                params: {Bucket: 'ngm-dev-authenticated-resources'}
            });

            s3.listObjects({Delimiter: '/'}, function(err, data) {
                console.log(err, data)
            });
        });
    }

}

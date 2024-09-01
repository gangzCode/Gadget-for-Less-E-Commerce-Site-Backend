const { expressjwt: jwt } = require('express-jwt'); // Correct import for express-jwt@7.x.x and later
const jwksRsa = require('jwks-rsa');
const dotenv = require('dotenv');

dotenv.config();

const auth0Verify = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
    }),
   
    // Validate the audience and the issuer.
    audience: process.env.AUTH0_AUDIENCE,
    issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    algorithms: ['RS256']
});

module.exports = {
    auth0Verify
};

const jwksClient = require("jwks-rsa");
const jwt = require("jsonwebtoken");

const client = jwksClient({
  jwksUri: "https://appleid.apple.com/auth/keys",
});

function getApplePublicKey(kid) {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

async function verifyAppleToken(token) {
  const decodedHeader = jwt.decode(token, { complete: true });
  const kid = decodedHeader.header.kid;

  const publicKey = await getApplePublicKey(kid);

  return jwt.verify(token, publicKey, {
    algorithms: ["RS256"],
    issuer: "https://appleid.apple.com",
  });
}

module.exports = verifyAppleToken;


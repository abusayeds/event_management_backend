require('dotenv').config();
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

const client = new STSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

client.send(new GetCallerIdentityCommand({}))
  .then((res) => console.log('✅ SUCCESS:', res))
  .catch((err) => console.log('❌ FAILED:', err.name, err.message));
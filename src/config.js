import dotenv from 'dotenv'
dotenv.config()
const uri = '';

const SERVER_HOSTNAME = 'localhost';
const MONGO_OPTIONS = {
  useUnifiedTopology: true,
  useNewUrlParser: true,
  socketTimeoutMS: 30000,
  keepAlive: true,
  poolSize: 50,
  autoIndex: false,
  retryWrites: false
};

const MONGO_USERNAME = process.env.MONGO_USERNAME || 'xxx';
const MONGO_PASSWORD = process.env.MONGO_PASSWORD || 'xxxx';
const MONGO_HOST = process.env.MONGO_URL || `xxxx`;

const MONGO = {
  host: MONGO_HOST,
  password: MONGO_PASSWORD,
  username: MONGO_USERNAME,
  options: MONGO_OPTIONS,
  url: `mongodb+srv://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOST}`
};

const SERVER_PORT = process.env.SERVER_PORT || 3000;

const SERVER = {
  hostname: SERVER_HOSTNAME,
  port: SERVER_PORT
};

const config = {
  mongo: MONGO,
  server: SERVER
};

export default config;
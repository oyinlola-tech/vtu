import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import swaggerAutogen from 'swagger-autogen';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputFile = path.join(__dirname, 'swagger-output.json');
const serverFile = path.join(__dirname, '..', '..', 'server.js');
const routesDir = path.join(__dirname, '..', 'routes');

const routeFiles = fs
  .readdirSync(routesDir)
  .filter((file) => file.endsWith('.js'))
  .map((file) => path.join(routesDir, file));

const endpointsFiles = [serverFile, ...routeFiles];

const port = process.env.PORT || 3000;
const doc = {
  info: {
    title: 'GLY VTU API',
    description: 'Auto-generated Swagger specification for GLY VTU backend.',
  },
  host: process.env.SWAGGER_HOST || `localhost:${port}`,
  schemes: [process.env.SWAGGER_SCHEME || 'http'],
  basePath: '/',
  consumes: ['application/json'],
  produces: ['application/json'],
};

export async function generateSwagger() {
  const swagger = swaggerAutogen();
  await swagger(outputFile, endpointsFiles, doc);
  return outputFile;
}

if (process.argv[1] && process.argv[1].endsWith('swagger.js')) {
  generateSwagger()
    .then(() => {
      console.log(`Swagger docs generated at ${outputFile}`);
    })
    .catch((err) => {
      console.error('Swagger generation failed:', err);
      process.exit(1);
    });
}

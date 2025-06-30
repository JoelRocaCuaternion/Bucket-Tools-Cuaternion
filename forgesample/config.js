require('dotenv').config();

// Solo necesitamos el PORT del .env, las credenciales vienen de la sesión
let { APS_BUCKET, PORT } = process.env;

PORT = PORT || 8080;

// Función para generar bucket dinámico basado en Client ID
function generateBucket(clientId) {
    return APS_BUCKET || `${clientId.toLowerCase()}-basic-app`;
}

module.exports = {
    PORT,
    generateBucket
};
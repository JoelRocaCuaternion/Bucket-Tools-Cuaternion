const express = require('express');
const formidable = require('express-formidable');
const {
    listObjects,
    uploadObject,
    translateObject,
    getManifest,
    urnify,
    deleteObject
} = require('../services/aps.js');
const { generateBucket } = require('../config.js');
const crypto = require('crypto');

let router = express.Router();

// Middleware para verificar que el usuario está logueado
function requireAuth(req, res, next) {
    if (!req.session.apsCredentials) {
        return res.status(401).json({ error: 'Not authenticated. Please login first.' });
    }
    next();
}

// GET: Lista todos los modelos con nombre completo (incluyendo la carpeta)
router.get('/api/models', requireAuth, async function (req, res, next) {
    try {
        const { clientId, clientSecret } = req.session.apsCredentials;
        const objects = await listObjects(clientId, clientSecret);
        res.json(objects.map(o => ({
            name: o.objectKey,       // mantiene ruta completa: carpeta/archivo
            urn: urnify(o.objectId),
            bucketName: o.bucketKey  // añade bucket para agrupar en frontend
        })));
    } catch (err) {
        next(err);
    }
});

// GET: Consulta el estado de traducción de un modelo
router.get('/api/models/:urn/status', requireAuth, async function (req, res, next) {
    try {
        const { clientId, clientSecret } = req.session.apsCredentials;
        const manifest = await getManifest(req.params.urn, clientId, clientSecret);
        if (manifest) {
            let messages = [];
            if (manifest.derivatives) {
                for (const derivative of manifest.derivatives) {
                    messages = messages.concat(derivative.messages || []);
                    if (derivative.children) {
                        for (const child of derivative.children) {
                            messages = messages.concat(child.messages || []);
                        }
                    }
                }
            }
            res.json({
                status: manifest.status,
                progress: manifest.progress,
                messages
            });
        } else {
            res.json({ status: 'n/a' });
        }
    } catch (err) {
        next(err);
    }
});

// POST: Sube un modelo y lo traduce
router.post('/api/models', requireAuth, formidable({ maxFileSize: Infinity }), async function (req, res, next) {
    const file = req.files['model-file'];
    if (!file) {
        res.status(400).json({ error: 'The required field ("model-file") is missing.' });
        return;
    }
    try {
        const { clientId, clientSecret } = req.session.apsCredentials;
        
        // Crea carpeta padre: cuaternion-YYYYMMDD-HHMMSS-XXXX
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
        const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
        const folderName = `cuaternion-${date}-${time}-${rand}`;
        
        const objectKey = `${folderName}/${file.name}`;
        const obj = await uploadObject(objectKey, file.path, clientId, clientSecret);
        await translateObject(urnify(obj.objectId), req.fields['model-zip-entrypoint'], clientId, clientSecret);
        res.json({
            name: obj.objectKey, // devuelve carpeta/archivo
            urn: urnify(obj.objectId)
        });
    } catch (err) {
        next(err);
    }
});

router.delete('/api/models/:urn', requireAuth, async function (req, res, next) {
    try {
        const { clientId, clientSecret } = req.session.apsCredentials;
        const urn = req.params.urn;
       
        console.log('🗑️ [DELETE] ==================== START ====================');
        console.log('🗑️ [DELETE] Received URN:', urn);
        console.log('🗑️ [DELETE] URN length:', urn.length);
        console.log('🗑️ [DELETE] URN first 50 chars:', urn.substring(0, 50));
       
        // Decodifica el URN para obtener el objectId completo
        let decoded;
        try {
            decoded = Buffer.from(urn, 'base64').toString('utf8');
            console.log('🗑️ [DELETE] Base64 decoded:', decoded);
        } catch (decodeError) {
            console.error('🗑️ [DELETE] Error decoding URN:', decodeError);
            return res.status(400).json({ error: 'Invalid URN format - decode error' });
        }
       
        // El formato esperado es: urn:adsk.objects:os.object:BUCKET_KEY/OBJECT_KEY
        const match = decoded.match(/^urn:adsk\.objects:os\.object:([^\/]+)\/(.+)$/);
        if (!match) {
            console.error('🗑️ [DELETE] URN format not recognized:', decoded);
            return res.status(400).json({ error: 'Invalid URN format - pattern mismatch' });
        }
       
        const [, bucketKey, objectKey] = match;
        const decodedObjectKey = decodeURIComponent(objectKey);
        console.log('🗑️ [DELETE] Extracted bucketKey:', bucketKey);
        console.log('🗑️ [DELETE] Extracted objectKey:', objectKey);
        console.log('🗑️ [DELETE] Decoded objectKey:', decodedObjectKey);
       
        // DEBUGGING: Verificar buckets disponibles
        console.log('🗑️ [DELETE] Client ID:', clientId);
        const expectedBucketKey = generateBucket(clientId);
        console.log('🗑️ [DELETE] Expected bucket:', expectedBucketKey);
        console.log('🗑️ [DELETE] Actual bucket:', bucketKey);
        console.log('🗑️ [DELETE] Bucket match:', bucketKey === expectedBucketKey);
       
        // Verificar que el bucket corresponde al usuario actual
        if (bucketKey !== expectedBucketKey) {
            console.error('🗑️ [DELETE] Bucket mismatch!');
            return res.status(403).json({ error: 'No tienes permisos para eliminar este archivo' });
        }

        // DEBUGGING: Listar objetos en el bucket ANTES de eliminar
        try {
            console.log('🗑️ [DELETE] Listing objects in bucket before deletion...');
            const objects = await listObjects(clientId, clientSecret); // Usar listObjects de aps.js
            console.log('🗑️ [DELETE] Objects in bucket:', objects.length);
            objects.forEach((obj, index) => {
                console.log(`🗑️ [DELETE] Object ${index}:`, obj.objectKey);
                console.log(`🗑️ [DELETE] Match with target (encoded):`, obj.objectKey === objectKey);
                console.log(`🗑️ [DELETE] Match with target (decoded):`, obj.objectKey === decodedObjectKey);
            });
        } catch (listError) {
            console.error('🗑️ [DELETE] Error listing objects:', listError.message);
        }
       
        // Llamar a la función de eliminación UNA SOLA VEZ
        console.log('🗑️ [DELETE] Calling deleteObject...');
        // Usar decodedObjectKey ya que es la versión correcta
        await deleteObject(bucketKey, decodedObjectKey, clientId, clientSecret);
       
        console.log('🗑️ [DELETE] Successfully deleted object');
        console.log('🗑️ [DELETE] ==================== END ====================');
        
        res.json({
            success: true,
            message: 'Archivo eliminado correctamente',
            bucket: bucketKey,
            object: decodedObjectKey
        });
       
    } catch (err) {
        console.error('🗑️ [DELETE] ==================== ERROR ====================');
        console.error('🗑️ [DELETE] Error:', err);
        console.error('🗑️ [DELETE] Error message:', err.message);
        console.error('🗑️ [DELETE] Error stack:', err.stack);
        
        if (err.axiosError) {
            console.error('🗑️ [DELETE] Axios error status:', err.axiosError.response?.status);
            console.error('🗑️ [DELETE] Axios error data:', err.axiosError.response?.data);
        }
        console.error('🗑️ [DELETE] ==================== ERROR END ====================');
       
        // Manejar errores específicos de la API de Autodesk
        if (err.axiosError?.response?.status === 404) {
            const errorData = err.axiosError.response.data;
            if (errorData.reason === 'Bucket not found') {
                return res.status(404).json({ error: 'Bucket no encontrado' });
            } else if (errorData.reason === 'Object not found') {
                return res.status(404).json({ error: 'Archivo no encontrado' });
            }
        }
       
        res.status(500).json({
            success: false,
            error: err.message || 'Error interno del servidor',
            details: err.axiosError?.response?.data || null
        });
    }
});

module.exports = router;
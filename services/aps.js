const { AuthenticationClient, Scopes } = require('@aps_sdk/authentication');
const { OssClient, Region, PolicyKey } = require('@aps_sdk/oss');
const { ModelDerivativeClient, View, OutputType } = require('@aps_sdk/model-derivative');
const { generateBucket } = require('../config.js');

const authenticationClient = new AuthenticationClient();
const ossClient = new OssClient();
const modelDerivativeClient = new ModelDerivativeClient();

const service = module.exports = {};

// Función para validar credenciales
service.validateCredentials = async (clientId, clientSecret) => {
    try {
        const credentials = await authenticationClient.getTwoLeggedToken(clientId, clientSecret, [
            Scopes.DataRead
        ]);
        return !!credentials.access_token;
    } catch (err) {
        console.error('Invalid credentials:', err.message);
        return false;
    }
};

// Función interna para obtener token con permisos completos
async function getInternalToken(clientId, clientSecret) {
    const credentials = await authenticationClient.getTwoLeggedToken(clientId, clientSecret, [
        Scopes.DataRead,
        Scopes.DataCreate,
        Scopes.DataWrite,
        Scopes.BucketCreate,
        Scopes.BucketRead,
        Scopes.BucketDelete // Añadir permiso de eliminación
    ]);
    return credentials.access_token;
}

// Token para el viewer (público)
service.getViewerToken = async (clientId, clientSecret) => {
    return await authenticationClient.getTwoLeggedToken(clientId, clientSecret, [Scopes.ViewablesRead]);
};

// Asegurar que existe el bucket
service.ensureBucketExists = async (bucketKey, clientId, clientSecret) => {
    const accessToken = await getInternalToken(clientId, clientSecret);
    try {
        await ossClient.getBucketDetails(bucketKey, { accessToken });
    } catch (err) {
        if (err.axiosError.response.status === 404) {
            await ossClient.createBucket(Region.Us, { bucketKey: bucketKey, policyKey: PolicyKey.Persistent }, { accessToken});
        } else {
            throw err;
        }
    }
};

// Listar objetos
service.listObjects = async (clientId, clientSecret) => {
    const bucketKey = generateBucket(clientId);
    await service.ensureBucketExists(bucketKey, clientId, clientSecret);
    const accessToken = await getInternalToken(clientId, clientSecret);
    let resp = await ossClient.getObjects(bucketKey, { limit: 64, accessToken });
    let objects = resp.items;
    while (resp.next) {
        const startAt = new URL(resp.next).searchParams.get('startAt');
        resp = await ossClient.getObjects(bucketKey, { limit: 64, startAt, accessToken });
        objects = objects.concat(resp.items);
    }
    return objects;
};

// Subir objeto
service.uploadObject = async (objectName, filePath, clientId, clientSecret) => {
    const bucketKey = generateBucket(clientId);
    await service.ensureBucketExists(bucketKey, clientId, clientSecret);
    const accessToken = await getInternalToken(clientId, clientSecret);
    const obj = await ossClient.uploadObject(bucketKey, objectName, filePath, { accessToken });
    return obj;
};

// Traducir objeto
service.translateObject = async (urn, rootFilename, clientId, clientSecret) => {
    const accessToken = await getInternalToken(clientId, clientSecret);
    const job = await modelDerivativeClient.startJob({
        input: {
            urn,
            compressedUrn: !!rootFilename,
            rootFilename
        },
       output: {
            formats: [{
                views: [View._2d, View._3d],
                type: OutputType.Svf2
            }]
        }
    }, { accessToken });
    return job.result;
};

// Obtener manifiesto
service.getManifest = async (urn, clientId, clientSecret) => {
    const accessToken = await getInternalToken(clientId, clientSecret);
    try {
        const manifest = await modelDerivativeClient.getManifest(urn, { accessToken });
        return manifest;
    } catch (err) {
        if (err.axiosError.response.status === 404) {
            return null;
        } else {
            throw err;
        }
    }
};

// Convertir ID a URN
service.urnify = (id) => Buffer.from(id).toString('base64').replace(/=/g, '');

service.deleteObject = async (bucketKey, objectName, clientId, clientSecret) => {
    const accessToken = await getInternalToken(clientId, clientSecret);
    await ossClient.deleteObject(bucketKey, objectName, { accessToken });
};

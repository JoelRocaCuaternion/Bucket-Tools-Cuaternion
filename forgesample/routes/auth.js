const express = require('express');
const { getViewerToken, validateCredentials } = require('../services/aps.js');
let router = express.Router();

// Middleware para verificar que el usuario está logueado
function requireAuth(req, res, next) {
    if (!req.session.apsCredentials) {
        return res.status(401).json({ error: 'No authenticated. Please login first.' });
    }
    next();
}

// Endpoint para login
router.post('/api/auth/login', async function (req, res, next) {
    try {
        const { client_id, client_secret } = req.body;
        
        if (!client_id || !client_secret) {
            return res.status(400).json({ error: 'Client ID and Client Secret are required' });
        }

        // Validar credenciales intentando obtener un token
        const isValid = await validateCredentials(client_id, client_secret);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Guardar credenciales en la sesión
        req.session.apsCredentials = {
            clientId: client_id,
            clientSecret: client_secret
        };

        res.json({ success: true, message: 'Login successful' });
    } catch (err) {
        next(err);
    }
});

// Endpoint para obtener token del viewer (requiere estar logueado)
router.get('/api/auth/token', requireAuth, async function (req, res, next) {
    try {
        const credentials = req.session.apsCredentials;
        res.json(await getViewerToken(credentials.clientId, credentials.clientSecret));
    } catch (err) {
        next(err);
    }
});

// Endpoint para logout
router.post('/api/auth/logout', function (req, res) {
    req.session.destroy();
    res.json({ success: true, message: 'Logout successful' });
});

// Endpoint para verificar estado de login
router.get('/api/auth/status', function (req, res) {
    res.json({ 
        isLoggedIn: !!req.session.apsCredentials,
        clientId: req.session.apsCredentials?.clientId || null
    });
});

module.exports = router;
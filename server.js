const express = require('express');
const session = require('express-session');
const { PORT } = require('./config.js');

let app = express();

// Configurar sesiones
app.use(session({
    secret: 'VivaEspana!_3', // Cambia esto por una clave más segura
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

app.use(express.json());
app.use(express.static('wwwroot'));
app.use(require('./routes/auth.js'));
app.use(require('./routes/models.js'));

app.listen(PORT, function () { 
    console.log(`Server listening on port ${PORT}...`); 
});
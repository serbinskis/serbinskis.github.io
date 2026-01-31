import fs from 'fs';
import http from 'http';
import https from 'https';
import express from 'express';

(async () => {
    process.title = 'GitHub Website';
    console.log(`[NodeJS] ${process.version}`);
    const app = express();
    app.use(express.static('./../../', { index: 'index.html' }));

    var httpsOptions = {
        cert: await new Promise((resolve) => fs.readFile('./../-(CERTIFICATE)-/certificate.crt', (err, data) => resolve(data))) as Buffer,
        ca: await new Promise((resolve) => fs.readFile('./../-(CERTIFICATE)-/ca_bundle.crt', (err, data) => resolve(data))) as Buffer,
        key: await new Promise((resolve) => fs.readFile('./../-(CERTIFICATE)-/private.key', (err, data) => resolve(data))) as Buffer,
    }

    http.createServer(app).listen(8080, null, () => {
        console.log(`Listening on 127.0.0.1:8080 (HTTP)`);
    });

    https.createServer(httpsOptions, app).listen(8443, null, () => {
        console.log(`Listening on 127.0.0.1:8443 (HTTPS)`);
    });
})();
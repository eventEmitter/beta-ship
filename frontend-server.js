import log from 'ee-log';
import FrontendServer from './src/FrontendServer.js';


(async() => {

    const server = new FrontendServer();
    await server.load();
})().then(() => {
    log.success('server is ready');
}).catch(log);
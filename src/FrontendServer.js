import express from 'express';
import path from 'path';




export default class FrontendServer {


    async load() {
        this.filesPath = path.join(path.dirname(new URL(import.meta.url).pathname), '../node_modules/@infect/frontend/www/dist/');
        console.log(this.filesPath);
        this.app = express();
        this.app.use(express.static(this.filesPath));
        this.app.listen(3000);
    }
}
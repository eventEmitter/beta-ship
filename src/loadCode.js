import HTTP2Client from '@distributed-systems/http2-client';
import log from 'ee-log';
import RegistryClient from '@infect/rda-service-registry-client';




class CodeLoader {

    constructor(registryHost = 'http://l.dns.porn:9000') {
        this.client = new RegistryClient(registryHost);
        this.httpClient = new HTTP2Client();
    }


    /**
     * shut the class down
     */
    async end() {
        await this.httpClient.end();
    }



    async load() {
        const storageHost = await this.client.resolve('infect-rda-sample-storage');

        log.info('loading source code ....');
        await this.httpClient.post(`${storageHost}/infect-rda-sample-storage.source-code-loader`)
            .expect(201)
            .send();


        log.info('linking source code ....');
        await this.httpClient.patch(`${storageHost}/infect-rda-sample-storage.source-code-loader/infect-human`)
            .expect(200)
            .send();

        await this.httpClient.patch(`${storageHost}/infect-rda-sample-storage.source-code-loader/infect-vet`)
            .expect(200)
            .send();
    }
}




const loader = new CodeLoader();



loader.load().then(() => {
    log.success('the source code was loaded and linked');
    loader.end();
}).catch((err) => {
    log.error(err);
    loader.end();
});

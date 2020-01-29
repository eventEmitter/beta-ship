import HTTP2Client from '@distributed-systems/http2-client';
import log from 'ee-log';
import RegistryClient from '@infect/rda-service-registry-client';





class ClusterCreater {

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



    async create(dataSetName) {
        log.info(`Creating cluster ....`);
        this.coordinatorHost = await this.client.resolve('rda-coordinator');
        this.clusterHost = await this.client.resolve('rda-cluster');

        const clusterResponse = await this.httpClient.post(`${this.coordinatorHost}/rda-coordinator.cluster`)
            .send({
                dataSource: 'infect-rda-sample-storage',
                dataSet: dataSetName,
                modelPrefix: 'Infect',
            });

        if (!clusterResponse.status(201)) {
            log(await clusterResponse.getData());
            process.exit();
        }

        const cluterData = await clusterResponse.getData();
        const startTime = Date.now();


        while (true) {
            await this.wait(2000);
            const res = await this.httpClient.get(`${this.clusterHost}/rda-cluster.cluster/${cluterData.clusterId}`).send();
            const data = await res.getData();
            const duration = Math.round((Date.now()-startTime)/1000);

            if (res.status(201)) {
                log.info(`cluster ${data.clusterId} has loaded ${data.totalLoadedRecords} records in ${duration} seconds (${Math.round(data.totalLoadedRecords/duration)} records/second) across ${data.shards.length} shards ...`);
                data.shards.forEach((shard) => {
                    log.debug(`shard ${shard.identifier} has loaded ${shard.loadedRecordCount} records ...`);
                });
                log.success('cluster is online!');
                return;
            } else if (res.status(200)) {
                log.info(`cluster ${data.clusterId} has loaded ${data.totalLoadedRecords} records in ${duration} seconds (${Math.round(data.totalLoadedRecords/duration)} records/second) across ${data.shards.length} shards ...`);
                data.shards.forEach((shard) => {
                    log.debug(`shard ${shard.identifier} has loaded ${shard.loadedRecordCount} records ...`);
                });
            }
            else log(res);
        }


        log(cluterData);
    }




    wait(msec) {
        return new Promise((resolve) => {
            setTimeout(resolve, msec);
        });
    }
}





const cluster = new ClusterCreater();
const dataSetName = process.argv.includes('--vet') ? 'infect-vet' : 'infect-human';

cluster.create(dataSetName).then(() => {
    log.success('the cluster was created');
    cluster.end();
}).catch((err) => {
    log.error(err);
    cluster.end();
});

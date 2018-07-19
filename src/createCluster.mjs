'use strict';


import log from 'ee-log';
import superagent from 'superagent';
import RegistryClient from 'rda-service-registry/src/RegistryClient';





class ClusterCreater {

    constructor(registryHost = 'http://l.dns.porn:9000') {
        this.client = new RegistryClient({
            registryHost,
        });
    }




    async create() {
        this.coordinatorHost = await this.client.resolve('rda-coordinator'); 
        this.clusterHost = await this.client.resolve('rda-cluster'); 

        const clusterResponse = await superagent.post(`${this.coordinatorHost}/rda-coordinator.cluster`).ok(r => true).send({
            dataSource: 'infect-rda-sample-storage',
            dataSet: 'infect',
        });

        if (clusterResponse.status !== 201) {
            log(clusterResponse);
            process.exit();
        }



        while (true) {
            await this.wait(10000);
            const res = await superagent.get(`${this.clusterHost}/rda-cluster.cluster/${clusterResponse.body.clusterId}`).ok(r => true).send();
            
            if (res.status === 201) log.success('cluster is online!');
            else if (res.status === 200) log.debug('building cluster ....');
            else log(res);
        }


        log(clusterResponse.body);
    }




    wait(msec) {
        return new Promise((resolve) => {
            setTimeout(resolve, msec);
        });
    }
}





const cluster = new ClusterCreater();



cluster.create().then(() => {
    log.success('the cluster was created');
}).catch(log);
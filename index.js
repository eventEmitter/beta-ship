import log from 'ee-log';
import ServiceManager from '@infect/rda-service-manager';


(async() => {

    const serviceManager = new ServiceManager({
        args: '--related-errors --data-for-dev --dev --log-level=info+ --log-module=*'.split(' ')
    });

    await serviceManager.startServices('@infect/rda-service-registry');
    await serviceManager.startServices('@infect/rda-compute-service', '@infect/rda-compute-service', '@infect/rda-compute-service', '@infect/rda-compute-service', '@infect/rda-compute-service', '@infect/rda-compute-service', '@infect/rda-compute-service', '@infect/rda-compute-service');
    await serviceManager.startServices('@infect/rda-compute-service', '@infect/rda-compute-service', '@infect/rda-compute-service', '@infect/rda-compute-service', '@infect/rda-compute-service', '@infect/rda-compute-service', '@infect/rda-compute-service', '@infect/rda-compute-service');
    await serviceManager.startServices('@infect/rda-cluster-service');
    await serviceManager.startServices('@infect/rda-coordinator-service');
    await serviceManager.startServices('@infect/infect-rda-sample-storage');
    await serviceManager.startServices('@infect/api');
    await serviceManager.startServices('@infect/infect-rda-sample-importer');
    await serviceManager.startServices('@infect/rda');
})().then(() => {
    log.success('application is ready');
}).catch(log);
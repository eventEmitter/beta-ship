'use strict';


import log from 'ee-log';
import fs from 'fs-promise';
import path from 'path';
import superagent from 'superagent';
import util from 'util';
import csv from 'csv';
import RegistryClient from 'rda-service-registry/src/RegistryClient';
import crypto from 'crypto';




const parse = util.promisify(csv.parse);



class Importer {

    constructor(registryHost = 'http://l.dns.porn:9000') {
        this.client = new RegistryClient({
            registryHost,
        });

        this.pageSize = 10000;
        this.offset = 0;


        this.stats = {
            importedRecordCount: 0,
            duplicateRecordCount: 0, 
            failedRecordCount: 0,
        };
    }




    async createVersion({
        dataSet = 'infect-beta',
    } = {}) {

        log.info(`creating data version for data set ${dataSet} ...`);
        const response = await superagent.post(`${this.importHost}/infect-rda-sample-import.prepared-anresis-import`)
            .ok(res => res.status === 201)
            .send({
                dataSet: dataSet,
                dataSetFields: ['bacteriumId', 'antibioticId', 'ageGroupId', 'regionId', 'sampleDate', 'resistance'],
            });


        this.dataVersionId = response.body.id;
    }



    async import() {
        this.storageHost = await this.client.resolve('infect-rda-sample-storage'); 
        this.importHost = await this.client.resolve('infect-rda-sample-import'); 

        log.info('creating data version ...');
        await this.createVersion();


        log.info('reading data ...');
        const CSVBlob = await fs.readFile(path.resolve('./data/data.csv'));


        log.info('parsing data ...');
        this.rawData = (await parse(CSVBlob)).slice(1).slice(1150000);

        //log(this.getRecord(this.rawData[0]));

        log.info(`starting import of ${this.rawData.length} rows ...`);
        await this.importPage();

        log.info('changing data version status to active ...');
        await superagent.patch(`${this.storageHost}/infect-rda-sample-storage.data-version/${this.dataVersionId}`).ok(res => res.status === 200).send({
            status: 'active'
        });


        log(this.stats);
    }



    getRecord(row) {
        const sampleDate = `${row[32].substr(6, 4)}-${row[32].substr(3, 2)}-${row[32].substr(0, 2)}T00:00:00Z`;

        return {
            bacterium: row[22],
            antibiotic: row[24],
            ageGroup: row[28],
            region: row[0],
            sampleDate: sampleDate,
            resistance: row[31],
            sampleId: this.getHash(row[25], row[22], row[24], sampleDate),
        };
    }





    getHash(...input) {
        return crypto.createHash('md5').update(input.join('|')).digest('hex');
    }




    async importPage() {
        const slice = this.rawData.slice(this.offset, this.offset+this.pageSize);
        this.offset += this.pageSize;

        const data = slice.map(row => this.getRecord(row));

        if (data.length > 0) { 
            log.debug(`importing slice ${this.offset-this.pageSize}-${(this.offset-this.pageSize+data.length)} ...`);
            const start = Date.now();
            const response = await superagent.patch(`${this.importHost}/infect-rda-sample-import.prepared-anresis-import/${this.dataVersionId}`)
                .ok(res => res.status === 200)
                .send(data);

            log.info(`Imported ${response.body.importedRecordCount} records in ${Math.round((Date.now()-start)/1000)} seconds, omitted ${response.body.duplicateRecordCount} duplicate records ...`);
            
            if (response.body.failedRecordCount > 0) {
                log.warn(`Failed to import ${response.body.failedRecordCount} records:`);
                log(response.body.failedRecords)
            }

            this.stats.failedRecordCount += response.body.failedRecordCount;
            this.stats.duplicateRecordCount += response.body.duplicateRecordCount;
            this.stats.importedRecordCount += response.body.importedRecordCount;

            await this.importPage();
        }
    }
}





const importer = new Importer();


importer.import().then(() => {
    log.success('the import was completed');
}).catch(log);
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


        this.failedEntites = new Map();
    }




    async createVersion({
        dataSet = 'infect-beta-june',
    } = {}) {

        log.info(`creating data version for data set ${dataSet} ...`);
        const response = await superagent.post(`${this.importHost}/infect-rda-sample-import.anresis-import`)
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
        const CSVBlob = await fs.readFile(path.resolve('./data/20180601_anresis_export.csv'));


        log.info('parsing data ...');
        this.rawData = (await parse(CSVBlob)).slice(1);

        //log(this.getRecord(this.rawData[0]));

        log.info(`starting import of ${this.rawData.length} rows ...`);
        await this.importPage();

        log.info('changing data version status to active ...');
        await superagent.patch(`${this.storageHost}/infect-rda-sample-storage.data-version/${this.dataVersionId}`).ok(res => res.status === 200).send({
            status: 'active'
        });


        log(this.failedEntites, this.stats);
    }



    getRecord(row) {
        // 0                                    1                           2               3                   4           5                   6               7           8                           9
        // sampleID                        ,    REGION_DESCRIPTION,         sample type,    type of origin,     age-group,  microorganism,      ABCLS_ACRONYM,  AB_NAME,    DELIVERED_QUALITATIVE_RES,  DAY_DAY
        // 95409B77F8E10B6437A3D819E6B0AAFB,    "Switzerland Nord-East",    urine,          outpatient,         45-64,      "Escherichia coli", "ceph4",        "Cefepime", s,                          08.12.2017
        //                                                                                                                                                                                              0123456789
        const sampleDate = `${row[9].substr(6, 4)}-${row[9].substr(3, 2)}-${row[9].substr(0, 2)}T00:00:00Z`;

        return {
            bacterium: row[5],
            antibiotic: row[7],
            ageGroup: row[4],
            region: row[1],
            sampleDate: sampleDate,
            resistance: row[8],
            sampleId: this.getHash(row[0], row[5], row[7], sampleDate),
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
            const response = await superagent.patch(`${this.importHost}/infect-rda-sample-import.anresis-import/${this.dataVersionId}`)
                .ok(res => res.status === 200)
                .send(data);

            log.info(`Imported ${response.body.importedRecordCount} records in ${Math.round((Date.now()-start)/1000)} seconds, omitted ${response.body.duplicateRecordCount} duplicate records ...`);
            
            if (response.body.failedRecordCount > 0) {
                log.debug(`Failed to import ${response.body.failedRecordCount} records`);
                //log(response.body.failedRecords)
                for (const record of response.body.failedRecords) {
                    const prop = `${record.failedResource}.${record.failedProperty}`;
                    if (!this.failedEntites.has(prop)) this.failedEntites.set(prop, new Map());
                    
                    const map = this.failedEntites.get(prop);
                    if (!map.has(record.unresolvedValue)) map.set(record.unresolvedValue, 0);
                    map.set(record.unresolvedValue, map.get(record.unresolvedValue)+1);
                }
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
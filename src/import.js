import crypto from 'crypto';
import csv from 'csv';
import fs from 'fs-promise';
import HTTP2Client from '@distributed-systems/http2-client';
import log from 'ee-log';
import path from 'path';
import RegistryClient from '@infect/rda-service-registry-client';
import util from 'util';




const parse = util.promisify(csv.parse);


/**
 * imports samples delivered via CSV from anresis
 *
 * @class      Importer (name)
 */
class Importer {

    /**
     * st up the importer
     *
     * @param      {string}  registryHost  The registry host
     */
    constructor(registryHost = 'http://l.dns.porn:9000') {
        this.client = new RegistryClient(registryHost);

        this.pageSize = 10000;
        this.offset = 0;


        this.httpClient = new HTTP2Client();

        this.stats = {
            importedRecordCount: 0,
            duplicateRecordCount: 0,
            failedRecordCount: 0,
        };


        this.failedEntites = new Map();
    }




    /**
     * shut the class down
     */
    async end() {
        await this.httpClient.end();
    }



    /**
     * create a data version
     *
     * @param      {Object}   arg1          options
     * @param      {string}   arg1.dataSet  The data set name
     * @return     {Promise}  undefined
     */
    async createVersion({
        dataSet = 'infect-beta',
    } = {}) {

        log.info(`creating data version for data set ${dataSet} ...`);
        const response = await this.httpClient.post(`${this.importHost}/infect-rda-sample-import.anresis-import`)
            .expect(201)
            .send({
                dataSet,
                dataSetFields: ['bacteriumId', 'antibioticId', 'ageGroupId', 'regionId', 'sampleDate', 'resistance', 'hospitalStatusId'],
            });

        const data = await response.getData();
        this.dataVersionId = data.id;
    }






    /**
     * executes the import
     */
    async import() {
        this.storageHost = await this.client.resolve('infect-rda-sample-storage');
        this.importHost = await this.client.resolve('infect-rda-sample-import');

        log.info('creating data version ...');
        await this.createVersion();


        log.info('reading data ...');
        const CSVBlob = await fs.readFile(path.resolve('./data/20190601-INFECT_export_month.csv'));


        log.info('parsing data ...');
        this.rawData = (await parse(CSVBlob)).slice(1);


        log.info(`starting import of ${this.rawData.length} rows ...`);
        await Promise.all([
            this.importPage(),
            this.importPage(),
            this.importPage(),
            this.importPage(),
            this.importPage(),
            this.importPage(),
            this.importPage(),
            this.importPage(),
        ]);

        log.info('changing data version status to active ...');
        await this.httpClient.patch(`${this.storageHost}/infect-rda-sample-storage.data-version/${this.dataVersionId}`)
            .expect(200)
            .send({
                status: 'active',
            });


        log(this.failedEntites, this.stats);
    }





    /**
     * update all running clusters with the new data version
     *
     * @return     {Promise}  undefined
     */
    async updateClusters() {
        log.info('updating clusters ...');
        await this.httpClient.patch(`${this.storageHost}/infect-rda-coordinator-storage.data-version/${this.dataVersionId}`)
            .expect(200)
            .send({
                status: 'active',
            });
    }





    /**
     * normalizes one row of the csv file so that it can be sent to the importer service
     *
     * @param      {Array}   row     CSV row
     * @return     {Object}  the normalized record
     */
    getRecord(row) {
        /* eslint-disable max-len */
        // 0                                    1                           2               3                   4           5                   6               7           8                           9
        // sampleID                        ,    REGION_DESCRIPTION,         sample type,    type of origin,     age-group,  microorganism,      ABCLS_ACRONYM,  AB_NAME,    DELIVERED_QUALITATIVE_RES,  DAY_DAY
        // 95409B77F8E10B6437A3D819E6B0AAFB,    "Switzerland Nord-East",    urine,          outpatient,         45-64,      "Escherichia coli", "ceph4",        "Cefepime", s,                          08.12.2017
        //                                                                                                                                                                                              0123456789
        //                                                                                                                                                                                              
        // 0                        1               2                   3           4                       5                6                  7                           8               9
        // "Switzerland East"       ,other          ,inpatient          ,15-44      ,"Escherichia coli"     ,"quinolones"   ,"Levofloxacin"     ,s                          ,01.03.2019     ,514A1039F37B65B1A84FFDB1C7D67061
        // REGION_DESCRIPTION       ,sample type    ,type of origin     ,age-group  ,microorganism          ,ABCLS_ACRONYM  ,AB_NAME            ,DELIVERED_QUALITATIVE_RES  ,DAY_DAY        ,record-identif


        /* eslint-enable max-len */
        const sampleDate = `${row[8].substr(6, 4)}-${row[8].substr(3, 2)}-${row[8].substr(0, 2)}T00:00:00Z`;

        return {
            bacterium: row[4],
            antibiotic: row[6],
            ageGroup: row[3],
            region: row[0],
            sampleDate,
            resistance: row[7],
            hospitalStatus: row[2],
            sampleId: this.getHash(row[9], row[4], row[6], sampleDate),
        };
    }





    /**
     * creates a md5 hash from input strings
     *
     * @param      {(Array|string[])}  input   inputs
     * @return     {string}            The hash.
     */
    getHash(...input) {
        return crypto.createHash('md5').update(input.join('|') + Math.random()).digest('hex');
    }






    /**
     * imports a slice of records in one request to the imported
     *
     * @return     {Promise}  undefined
     */
    async importPage() {
        const slice = this.rawData.slice(this.offset, this.offset + this.pageSize);
        this.offset += this.pageSize;

        const data = slice.map(row => this.getRecord(row));

        if (data.length > 0) {
            log.debug(`importing slice ${this.offset - this.pageSize}-${((this.offset - this.pageSize) + data.length)} ...`);
            const start = Date.now();
            const response = await this.httpClient.patch(`${this.importHost}/infect-rda-sample-import.anresis-import/${this.dataVersionId}`)
                .expect(200)
                .send(data);

            const responseData = await response.getData();

            log.info(`Imported ${responseData.importedRecordCount} records in ${Math.round((Date.now() - start) / 1000)} seconds, omitted ${responseData.duplicateRecordCount} duplicate records ...`);

            if (responseData.failedRecordCount > 0) {
                log.debug(`Failed to import ${responseData.failedRecordCount} records`);

                for (const record of responseData.failedRecords) {
                    const prop = `${record.failedResource}.${record.failedProperty}`;
                    if (!this.failedEntites.has(prop)) this.failedEntites.set(prop, new Map());

                    const map = this.failedEntites.get(prop);
                    if (!map.has(record.unresolvedValue)) map.set(record.unresolvedValue, 0);
                    map.set(record.unresolvedValue, map.get(record.unresolvedValue) + 1);
                }
            }

            this.stats.failedRecordCount += responseData.failedRecordCount;
            this.stats.duplicateRecordCount += responseData.duplicateRecordCount;
            this.stats.importedRecordCount += responseData.importedRecordCount;

            await this.importPage();
        }
    }
}





const importer = new Importer();


importer.import().then(() => {
    log.success('the import was completed');
    importer.end();
}).catch((err) => {
    log.error(err);
    importer.end();
});

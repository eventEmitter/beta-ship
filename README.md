# Beta Ship

Master App for controlling RDA

## Usage

### Cluster init

1. Connect to the rda server
2. Navigate to the beta-ship dir (apps/rda/beta-ship)
3. Restart the cluster wit the command `sudo systemctl restart rda`. This will re-initialize the cluster without any data loaded into it. The cluster will be offline in this state. Wait 20-30 seconds until the cluster was initialized before executing any other commands.
4. Initialize the cluster using the command `npm run cluster-int`. The cluster will load its data and become available after about one minute.


### Enabling Data Versions

Data is imported as data versions. Each import generates a new data version. If the data of a data version is loaded into rda depends on the dataVersionStatus of the dataversion. Only versions with the status `active` are used for rda when the cluster is initialized. Changes to this configuration require a restart of the cluster.

You may configre the data versioins in the infect database, schema infect_sample_storage, table dataVersion. Be aware that the automatic import will add its records here automatically and modify the activation status of data versions.

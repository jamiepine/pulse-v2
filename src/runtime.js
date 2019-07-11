export default class Runtime {
  constructor(collections, global) {
    this.collections = collections;
    this.config = global.config;
    this.running = false;
    this.ingestQueue = [];

    // workload memory
    this.completed = [];
  }

  ingest(mutation) {
    if (this.running) {
      this.ingestQueue.push(mutation);
      return;
    }
    this.running = true;
  }

  completedJob(type, collection, property, value) {
    const types = [
      "publicDataMutation",
      "internalDataMutation",
      "groupUpdate",
      "filterRegen"
    ];
    this.completed.push({
      type,
      collection,
      property,
      value
    });
  }

  collectionHasRootProperty(collection, key) {
    if (this.config.bindPropertiesToCollectionRoot === false) return false;
    return this.collections[collection].public.object.hasOwnProperty(key);
  }

  commitUpdate(collection, type, key, value) {
    this.collections[collection][type].privateWrite(key, value);
    if (this.collectionHasRootProperty(collection, key)) {
      this.collections[collection].public.privateWrite(key, value);
    }
  }
  commitPublicDataUpdate(collection, key, value) {
    this.commitUpdate(collection, "data", key, value);
    this.completedJob("publicDataMutation", collection, key, value)
  }
  commitInternalDataUpdate(collection, key, value) {
    this.completedJob("internalDataMutation", collection, key, value)
  }
  commitIndexUpdate(collection, key, value) {
    // Update Index
    this.collections[collection].indexes.privateWrite(key, value);
    // Build Group
    let group = this.buildGroupFromIndex(collection, key, value)
    // Commit Update
    this.collections[collection].groups[key] = group
    if (this.collectionHasRootProperty(collection, key)) {
      this.collections[collection].public.privateWrite(key, value);
    }
    this.completedJob("groupUpdate", collection, key, value)
  }
  commitGroupOutput(collection, key, value) {}
  commitFilterOutput(collection, key, value) {}

  findNextJob() {
    let lastJob = this.completed[this.completed.length - 1];
    lastJob;
    // is there a watcher to execute?
    // are there affected dependencies
  }

  finished() {
    setTimeout(() => {
      if (this.ingestQueue.length === 0) this.updateSubscribers();
    });
  }

  updateSubscribers() {
    this.persistData();
  }

  persistData() {

  }


  buildGroupFromIndex(collection, key, value) {
    
  }
}

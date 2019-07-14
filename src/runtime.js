import { jobTypes, log } from "./helpers";

export default class Runtime {
  constructor(collections, global) {
    this.collections = collections;
    this.global = global;
    this.config = global.config;
    this.running = false;
    this.updatingSubscribers = false;

    // workload memory
    this.ingestQueue = [];
    this.completedJobs = [];
    this.archivedJobs = [];
  }

  ingest(mutation) {
    if (this.global.initComplete) console.log("New job recieved, queuing...");
    this.ingestQueue.push(mutation);
    if (!this.running) {
      this.findNextJob();
    }
  }

  findNextJob() {
    this.running = true;
    let next = this.ingestQueue.shift();

    // execute the next task in the queue
    this.performJob(next);
  }

  performJob({ type, collection, property, value, dep }) {
    switch (type) {
      case jobTypes.PUBLIC_DATA_MUTATION:
        this.performPublicDataUpdate(collection, property, value);
        break;
      case jobTypes.INTERNAL_DATA_MUTATION:
        this.performInternalDataUpdate(collection, property, value);
        break;
      case jobTypes.INDEX_UPDATE:
        this.performIndexUpdate(collection, property, value);
        break;
      case jobTypes.FILTER_REGEN:
        this.performFilterOutput(collection, property);
        break;
      case jobTypes.GROUP_UPDATE:
        this.performGroupRebuild(collection, property);
        break;
      default:
        break;
    }

    // run watcher if it exists
    if (this.collections[collection].watchers[property]) {
      log("Running WATCHER for", property);
      this.collections[collection].watchers[property]();
    }

    // unpack dependent filters
    if (dep && dep.dependents.size > 0) {
      log(`Queueing ${dep.dependents.size} dependents`);
      dep.dependents.forEach(filter => {
        // get dep from public filter output
        const dep = this.collections[filter.collection].filterDeps[filter.name];

        this.ingest({
          type: jobTypes.FILTER_REGEN,
          collection: filter.collection,
          property: filter,
          dep
        });
      });
    }

    this.finished();
  }

  finished() {
    this.running = false;
    console.log(this.completedJobs.length);
    if (this.completedJobs.length > 100) return;

    // If there's already more stuff in the queue, loop.
    if (this.ingestQueue.length > 0) {
      this.findNextJob();
      return;
    }

    // Wait until callstack is empty to check if we should finalise this body of work
    setTimeout(() => {
      if (this.ingestQueue.length === 0) {
        if (!this.updatingSubscribers) this.updateSubscribers();
        this.cleanup();
      } else {
        // loop more!
        this.findNextJob();
      }
    });
  }

  // Jobs runtime can perform
  performPublicDataUpdate(collection, key, value) {
    this.writeToPublicObject(collection, "data", key, value);
    this.completedJob(jobTypes.PUBLIC_DATA_MUTATION, collection, key, value);
  }
  performInternalDataUpdate(collection, key, value) {
    this.findIndexesToUpdate();
    this.completedJob(jobTypes.INTERNAL_DATA_MUTATION, collection, key, value);
  }
  performIndexUpdate(collection, key, value) {
    // Update Index
    this.collections[collection].indexes.privateWrite(key, value);
    this.completedJob(jobTypes.INDEX_UPDATE, collection, key, value);

    // Group must also be updated
    this.ingest({
      type: jobTypes.GROUP_UPDATE,
      collection: collection,
      property: key
      // FIND DEP
    });
  }
  performGroupRebuild(collection, key) {
    let group = this.buildGroupFromIndex(collection, key);
    this.writeToPublicObject(collection, "group", key, group);
    this.completedJob(jobTypes.GROUP_UPDATE, collection, key, group);
  }
  performFilterOutput(collection, keyOrClass) {
    const filter =
      typeof keyOrClass === "string"
        ? this.collections[collection].filters[keyOrClass]
        : keyOrClass;

    const filterOutput = filter.run();
    // Commit Update
    this.writeToPublicObject(collection, "filters", filter.name, filterOutput);
    this.completedJob(
      jobTypes.FILTER_REGEN,
      collection,
      filter.name,
      filterOutput
    );
  }

  // Handlers for committing updates
  writeToPublicObject(collection, type, key, value) {
    if (type === "indexes")
      this.collections[collection][type].privateWrite(key, value);
    else this.collections[collection].public.privateWrite(key, value);
  }

  completedJob(type, collection, property, value) {
    log(`Job Completed`, { type, collection, property, value });
    if (this.global.initComplete)
      this.completedJobs.push({
        type,
        collection,
        property,
        value
      });
  }

  updateSubscribers() {
    if (!this.global.initComplete) return;
    this.updatingSubscribers = true;
    console.log("ALL JOBS COMPLETE");
    console.log("Updating components...");

    this.persistData();
    //
  }

  persistData() {}

  cleanup() {
    setTimeout(() => {
      this.updatingSubscribers = false;
    });
  }

  buildGroupFromIndex(collection, key) {
    const constructedArray = [];
    let c = this.collections[collection];
    let index = this.collections[collection].indexes.object[key];
    for (let i = 0; i < index.length; i++) {
      let id = index[i];
      let data = c.internalData[id];
      if (!data) continue;
      constructedArray.push(data);
      // data = this.injectDataByRelation(data)
      // data = this.injectGroupByRelation(data)
    }
    return constructedArray;
  }

  findIndexesToUpdate(collection, keys) {
    const foundIndexes = new Set();
    const c = this.collections[collection];

    if (!Array.isArray(keys)) keys = [keys];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const searchIndexes = this.searchIndexes(c, key);
      searchIndexes.forEach(index => foundIndexes.add(index));
    }

    foundIndexes.forEach(index => {
      this.ingest({
        type: jobTypes.INDEX_UPDATE,
        collection: c.name,
        property: index
        // FIND DEP
      });
    });
  }

  searchIndexes(c, key) {
    let foundIndexes = [];
    for (let i = 0; i < c.keys.indexes.length; i++) {
      const indexName = c.keys.indexes[i];
      if (c.indexes[indexName].includes(key)) foundIndexes.push(indexName);
    }
    return foundIndexes;
  }
}

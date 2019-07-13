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
      case jobTypes.GROUP_UPDATE:
        this.performIndexUpdate(collection, property, value);
        break;
      case jobTypes.FILTER_REGEN:
        this.performFilterOutput(collection, property);
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
        console.log("FWEFWEF", filter);
        this.ingest({
          type: jobTypes.FILTER_REGEN,
          collection: filter.collection,
          property: filter
          // dep: filter.dep
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
    this.commitUpdate(collection, "data", key, value);
    this.completedJob(jobTypes.PUBLIC_DATA_MUTATION, collection, key, value);
  }
  performInternalDataUpdate(collection, key, value) {
    this.completedJob(jobTypes.INTERNAL_DATA_MUTATION, collection, key, value);
  }
  performIndexUpdate(collection, key, value) {
    // Update Index
    this.collections[collection].indexes.privateWrite(key, value);
    // Build Group
    let group = this.buildGroupFromIndex(collection, key, value);
    // Commit Update
    this.commitUpdate(collection, "indexes", key, group);
    this.completedJob(jobTypes.GROUP_UPDATE, collection, key, value);
  }
  performFilterOutput(collection, keyOrClass) {
    const filter =
      typeof keyOrClass === "string"
        ? this.collections[collection].filters[keyOrClass]
        : keyOrClass;

    const filterOutput = filter.run();
    // Commit Update
    this.commitUpdate(collection, "filters", filter.name, filterOutput);
    this.completedJob(
      jobTypes.FILTER_REGEN,
      collection,
      filter.name,
      filterOutput
    );
  }

  // Handlers for committing updates
  collectionHasRootProperty(collection, key) {
    if (this.config.bindPropertiesToCollectionRoot === false) return false;
    return this.collections[collection].public.object.hasOwnProperty(key);
  }
  commitUpdate(collection, type, key, value) {
    if (["filters", "groups"].includes(type))
      this.collections[collection][type][key] = value;
    else this.collections[collection][type].privateWrite(key, value);
    this.updateRootProperty(collection, key, value);
  }
  updateRootProperty(collection, key, value) {
    if (this.collectionHasRootProperty(collection, key)) {
      this.collections[collection].public.privateWrite(key, value);
    }
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

  buildGroupFromIndex(collection, key, value) {}
}

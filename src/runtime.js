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

  ingest(type, collection, property, value) {
    const mutation = { type, collection, property, value };

    // log(`Ingesting`, mutation)
    this.ingestQueue.push(mutation);
    if (!this.running) {
      this.findNextJob();
    }
  }

  findNextJob() {
    log("Starting Job");
    this.running = true;
    let next = this.ingestQueue.shift();
    const { type, collection, property, value } = next;

    // execute the next task in the queue
    this.performJob(type, collection, property, value);
  }

  performJob(type, collection, property, value) {
    if (type === jobTypes.PUBLIC_DATA_MUTATION)
      this.commitPublicDataUpdate(collection, property, value);

    if (type === jobTypes.INTERNAL_DATA_MUTATION)
      this.commitInternalDataUpdate(collection, property, value);

    if (type === jobTypes.GROUP_UPDATE)
      this.commitIndexUpdate(collection, property, value);

    if (type === jobTypes.FILTER_REGEN)
      this.commitFilterOutput(collection, property, value);

    // is there a watcher to execute for the task we just executed?
    if (this.collections[collection].watchers[property]) {
      log("Running WATCHER for", property);
      this.collections[collection].watchers[property]();
    }

    let deps = this.global.findDeps(type, collection, property, value);
    this.ingestQueue = [...this.ingestQueue, ...deps];

    // find dependencies

    this.finished();
  }

  finished() {
    this.running = false;
    log("Finished Job");
    console.log(this.completedJobs.length);

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

  collectionHasRootProperty(collection, key) {
    if (this.config.bindPropertiesToCollectionRoot === false) return false;
    return this.collections[collection].public.object.hasOwnProperty(key);
  }

  commitUpdate(collection, type, key, value) {
    log("COMMITTED_UPDATE for", key);
    this.collections[collection][type].privateWrite(key, value);
    if (this.collectionHasRootProperty(collection, key)) {
      this.collections[collection].public.privateWrite(key, value);
    }
  }
  commitPublicDataUpdate(collection, key, value) {
    this.commitUpdate(collection, "data", key, value);
    this.completedJob(jobTypes.PUBLIC_DATA_MUTATION, collection, key, value);
  }
  commitInternalDataUpdate(collection, key, value) {
    this.completedJob(jobTypes.INTERNAL_DATA_MUTATION, collection, key, value);
  }
  commitIndexUpdate(collection, key, value) {
    // Update Index
    this.collections[collection].indexes.privateWrite(key, value);
    // Build Group
    let group = this.buildGroupFromIndex(collection, key, value);
    // Commit Update
    this.collections[collection].groups[key] = group;
    if (this.collectionHasRootProperty(collection, key)) {
      this.collections[collection].public.privateWrite(key, value);
    }
    this.completedJob(jobTypes.GROUP_UPDATE, collection, key, value);
  }
  commitFilterOutput(collection, key, value) {
    this.completedJob(jobTypes.FILTER_REGEN, collection, key, value);
  }

  completedJob(type, collection, property, value) {
    this.completedJobs.push({
      type,
      collection,
      property,
      value
    });
  }

  updateSubscribers() {
    this.updatingSubscribers = true;
    console.log("ALL JOBS COMPLETE");

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

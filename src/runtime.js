import { jobTypes } from "./helpers";

export default class Runtime {
  constructor(collections, global) {
    this.collections = collections;
    this.global = global;
    this.config = global.config;
    this.running = false;

    // workload memory
    this.ingestQueue = [];
    this.completedJobs = [];
  }

  ingest(type, collection, property, value) {
    const mutation = { type, collection, property, value };

    this.ingestQueue.push(mutation);
    if (!this.running) {
      this.running = true;
      this.findNextJob();
    }
  }

  findNextJob() {
    let next = this.ingestQueue.shift();

    console.log(next);

    // const { type, collection, property, value } = next;

    // execute the next task in the queue
    this.performJob(next);
    // is there a watcher to execute for the task we just executed?
    // if (this.collections[collection].watchers[property]) {
    //   this.collections[collection].watchers[property]();
    // }
    // find dependencies and add them to the queue
  }

  performJob(next) {
    const { type, collection, property, value } = next;

    if (type === jobTypes.PUBLIC_DATA_MUTATION)
      this.commitPublicDataUpdate(collection, property, value);

    if (this.ingestQueue.length === 0) {
      this.finished();
    } else {
      this.findNextJob();
    }
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

  finished() {
    setTimeout(() => {
      if (this.ingestQueue.length === 0) {
        this.updateSubscribers();
        this.cleanup();
      } else {
        // loop more!
        this.findNextJob();
      }
    });
  }

  updateSubscribers() {
    console.log("ALL JOBS COMPLETE");

    this.persistData();
  }

  persistData() {}

  cleanup() {}

  buildGroupFromIndex(collection, key, value) {}
}

import { log } from "./helpers";
import { JobType, Job, Global } from "./interfaces";

export default class Runtime {
  public running: Boolean = false;
  public performingJob: Boolean | Job = false;
  public updatingSubscribers: Boolean = false;

  private ingestQueue: Array<Job> = [];
  private completedJobs: Array<Job> = [];
  private archivedJobs: Array<Job> = [];

  // private collections: Object;
  private config: Object;

  constructor(private collections: Object, private global: Global) {
    global.ingest = this.ingest.bind(this);
    this.config = global.config;
  }

  ingest(job: Job) {
    console.log(job);
    if (this.ingestQueue.length > 0) {
      // check if this job is already queued, if so defer to bottom of stack
      const alreadyInQueueAt = this.ingestQueue.findIndex(
        item =>
          item.type === job.type &&
          item.collection === job.collection &&
          item.property === job.property
      );
      if (alreadyInQueueAt) {
        // remove from queue at index
        this.ingestQueue.splice(alreadyInQueueAt, 1);
      }
    }
    this.ingestQueue.push(job);
    if (!this.running) {
      this.findNextJob();
    }
  }

  findNextJob() {
    this.running = true;
    let next = this.ingestQueue.shift();

    // non public data properties such as groups, filters and indexes will not have their dep, so get it.
    if (!next.dep)
      next.dep = this.collections[next.collection].public.getDep(next.property);

    // execute the next task in the queue
    this.performJob(next);
  }

  performJob({ type, collection, property, value, dep }) {
    this.performingJob = { type, collection, property, value, dep };
    switch (type) {
      case JobType.PUBLIC_DATA_MUTATION:
        this.performPublicDataUpdate(collection, property, value);
        break;
      case JobType.INTERNAL_DATA_MUTATION:
        this.performInternalDataUpdate(collection, property, value);
        break;
      case JobType.BULK_INTERNAL_DATA_MUTATION:
        // this.performInternalDataUpdate(collection, property, value);
        break;
      case JobType.INDEX_UPDATE:
        this.performIndexUpdate(collection, property, value);
        break;
      case JobType.FILTER_REGEN:
        this.performFilterOutput(collection, property);
        break;
      case JobType.GROUP_UPDATE:
        this.performGroupRebuild(collection, property);
        break;
      default:
        break;
    }

    // run watcher if it exists
    if (this.collections[collection].watchers[property]) {
      // log("Running WATCHER for", property);
      this.collections[collection].watchers[property]();
    }

    // unpack dependent filters
    if (dep && dep.dependents.size > 0) {
      // log(`Queueing ${dep.dependents.size} dependents`);
      dep.dependents.forEach(filter => {
        // get dep from public filter output
        const dep = this.collections[filter.collection].public.getDep(
          filter.name
        );

        this.ingest({
          type: JobType.FILTER_REGEN,
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
    this.performingJob = false;
    // console.log(this.completedJobs.length);
    if (this.completedJobs.length > 100) return;

    // If there's already more stuff in the queue, loop.
    if (this.ingestQueue.length > 0) {
      this.findNextJob();
      return;
    }

    // Wait until callstack is empty to check if we should finalise this body of work
    setTimeout(() => {
      if (this.ingestQueue.length === 0) {
        if (!this.updatingSubscribers) this.compileComponentUpdates();
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
    this.completedJob(JobType.PUBLIC_DATA_MUTATION, collection, key, value);
  }
  performInternalDataUpdate(collection, key, value) {
    const previousValue = this.overwriteInternalData(collection, key, value);
    // only look for indexes if we're not collecting data
    if (!this.global.collecting) this.findIndexesToUpdate(collection, key);
    this.completedJob(
      JobType.INTERNAL_DATA_MUTATION,
      collection,
      key,
      value,
      previousValue
    );
  }
  performIndexUpdate(collection, key, value) {
    // Update Index
    this.collections[collection].indexes.privateWrite(key, value);
    this.completedJob(JobType.INDEX_UPDATE, collection, key, value);

    // Group must also be updated
    this.ingest({
      type: JobType.GROUP_UPDATE,
      collection: collection,
      property: key,
      dep: this.collections[collection].public.getDep(value)
    });
  }
  performGroupRebuild(collection, key) {
    let group = this.collections[collection].buildGroupFromIndex(key);
    this.writeToPublicObject(collection, "group", key, group);
    this.completedJob(JobType.GROUP_UPDATE, collection, key, group);
  }
  performFilterOutput(collection, keyOrClass) {
    const filter =
      typeof keyOrClass === "string"
        ? this.collections[collection].filters[keyOrClass]
        : keyOrClass;

    this.collections[collection].removeRelationToInternalData(filter.name);

    const filterOutput = filter.run();
    // Commit Update
    this.writeToPublicObject(collection, "filters", filter.name, filterOutput);
    this.completedJob(
      JobType.FILTER_REGEN,
      collection,
      filter.name,
      filterOutput
    );
  }

  // Handlers for committing updates
  writeToPublicObject(collection, type, key, value) {
    if (type === "indexes") {
      if (!this.collections[collection][type].object.hasOwnProperty(key))
        return;
      this.collections[collection][type].privateWrite(key, value);
    } else {
      if (!this.collections[collection].public.object.hasOwnProperty(key))
        return;
      this.collections[collection].public.privateWrite(key, value);
    }
  }

  completedJob(type, collection, property, value, previousValue) {
    const job = {
      type,
      collection,
      property,
      value,
      previousValue,
      fromAction: this.global.runningAction,
      dep: this.performingJob.dep
    };
    // log(`Job Completed`, job);
    if (this.global.initComplete) this.completedJobs.push(job);
  }

  compileComponentUpdates() {
    if (!this.global.initComplete) return;
    this.updatingSubscribers = true;
    console.log("ALL JOBS COMPLETE", this.completedJobs);
    console.log("Updating components...");

    const componentsToUpdate = {};

    const subscribe = (value, subscribers) => {
      for (let i = 0; i < subscribers.length; i++) {
        const uuid = subscribers[i].componentUUID;
        const key = subscribers[i].key;
        if (!componentsToUpdate[uuid]) {
          componentsToUpdate[uuid] = {};
          componentsToUpdate[uuid][key] = value;
        } else {
          componentsToUpdate[uuid][key] = value;
        }
      }
    };

    for (let i = 0; i < this.completedJobs.length; i++) {
      const job = this.completedJobs[i];
      if (job.dep) subscribe(job.value, job.dep.subscribers);
    }

    console.log(componentsToUpdate);
  }

  persistData() {}

  cleanup() {
    setTimeout(() => {
      this.updatingSubscribers = false;
    });
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
        type: JobType.INDEX_UPDATE,
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

  overwriteInternalData(collection, primaryKey, newData) {
    const currentData = Object.assign(
      {},
      this.collections[collection].internalData[primaryKey]
    );
    if (currentData[primaryKey]) {
      // data already exists, merge objects and return previous object
      const keys = Object.keys(newData);
      for (let i = 0; i < keys.length; i++) {
        const property = keys[i];
        this.collections[collection].internalData[primaryKey][property] =
          newData[property];
      }
      return currentData;
    } else {
      // data does not exist, write and return false
      this.collections[collection].internalData[primaryKey] = newData;
      return false;
    }
  }
}

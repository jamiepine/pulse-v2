import { jobTypes, assert, defineConfig } from "./helpers";
import Reactive from "./reactive";
import Action from "./action";
import Filter from "./filter";
import {
  Methods,
  Keys,
  CollectionObject,
  CollectionConfig,
  Global,
  JobType
} from "./interfaces";

export default class Collection {
  public: Reactive;
  indexes: Reactive;
  namespace: CollectionObject;
  config: CollectionConfig = {};
  keys: Keys = {};
  methods: Methods;

  actions: { [key: string]: Action } = {};
  filters: { [key: string]: Filter } = {};
  watchers: object = {};

  internalData: object = {};
  relatedToInternalData: object = {};
  collectionSize: number = 0;

  primaryKey: string | number | boolean = false;

  dispatch: void;
  constructor(
    public name: string,
    private global: Global,
    root: CollectionObject
  ) {
    this.config = root.config;
    this.dispatch = this.global.dispatch;

    this.methods = {
      collect: this.collect.bind(this),
      replaceIndex: this.replaceIndex.bind(this)
    };

    this.prepareNamespace(root);

    this.initReactive(this.namespace.data, this.namespace.groups);
    this.initActions(this.namespace.actions);
    this.initWatchers(this.namespace.watch);
    this.initFilters(this.namespace.filters);
  }

  prepareNamespace(root: CollectionObject) {
    console.log(root);
    const types = {
      data: root.data || {},
      groups: root.groups ? this.normalizeGroups(root.groups) : {},
      filters: root.filters || {},
      actions: root.actions || {}
      // watch: root.watch || {}
    };
    // name
    Object.keys(types).forEach(type => {
      this.keys[type] = Object.keys(types[type]);
    });

    this.namespace = Object.assign(
      {},
      this.methods,
      { routes: {}, indexes: {} },
      types
    );
  }

  normalizeGroups(groupsAsArray: any) {
    const groups: object = {};
    for (let i = 0; i < groupsAsArray.length; i++) {
      const groupName = groupsAsArray[i];
      groups[groupName] = [];
    }
    return groups;
  }

  initReactive(data: object = {}, groups: object = {}) {
    let dataKeys = Object.keys(data);
    let groupKeys = Object.keys(groups);

    for (let i = 0; i < dataKeys.length; i++) {
      const key = dataKeys[i];
      this.namespace[key] = data[key];
    }

    // Make indexes reactive
    this.indexes = new Reactive(
      groups, // object
      this.global, // global
      this.name, // collection
      groupKeys, // mutable
      "indexes" // type
    );
    this.namespace.indexes = this.indexes.object;

    // Make entire public object Reactive
    this.public = new Reactive(
      Object.assign({}, this.namespace),
      this.global,
      this.name,
      [...dataKeys, ...groupKeys],
      "root"
    );
  }

  initActions(actions: object = {}) {
    let actionKeys = Object.keys(actions);
    for (let i = 0; i < actionKeys.length; i++) {
      const action = actions[actionKeys[i]];
      this.actions[actionKeys[i]] = new Action(
        this.name,
        this.global,
        action,
        actionKeys[i]
      );

      this.public.privateWrite(actionKeys[i], this.actions[actionKeys[i]].exec);
    }
  }

  initWatchers(watchers: object = {}) {
    const _this = this;
    this.watchers = {};
    let watcherKeys = Object.keys(watchers);
    for (let i = 0; i < watcherKeys.length; i++) {
      const watcher = watchers[watcherKeys[i]];
      this.watchers[watcherKeys[i]] = function() {
        _this.global.runningWatcher = {
          collection: _this.name,
          property: watcherKeys[i]
        };
        const watcherOutput = watcher.apply(
          null,
          [_this.global.getContext(_this.name)].concat(
            Array.prototype.slice.call(arguments)
          )
        );
        _this.global.runningWatcher = false;
        return watcherOutput;
      };
    }
    this.watchers._keys = watcherKeys;
  }

  initFilters(filters) {
    this.filters = {};
    for (let i = 0; i < this.keys.filters.length; i++) {
      const filterName = this.keys.filters[i];
      const filterFunction = filters[this.keys.filters[i]];
      // set the property to an empty array, until we've parsed the filter
      this.filters[filterName] = new Filter(
        this.global,
        this.name,
        filterName,
        filterFunction
      );
      this.public.object[filterName] = [];
    }
  }

  buildGroupFromIndex(key) {
    // console.log(collection, key)
    const constructedArray = [];
    let index = this.indexes.object[key];
    for (let i = 0; i < index.length; i++) {
      let id = index[i];
      let data = this.internalData[id];
      if (!data) continue;
      constructedArray.push(data);
      // data = this.injectDataByRelation(data)
      // data = this.injectGroupByRelation(data)
    }
    return constructedArray;
  }

  createRelationToInternalData(primaryKey) {
    const filter = this.global.runningFilter;
    const name = (filter as Filter).name;
    if (this.relatedToInternalData[name]) {
      this.relatedToInternalData[name].push(filter);
    } else {
      this.relatedToInternalData[name] = [filter];
    }
  }
  removeRelationToInternalData(filter) {
    delete this.relatedToInternalData[filter];
  }

  ingestFiltersRelatedToData(primaryKey) {
    const filters = this.relatedToInternalData[primaryKey];
    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      this.global.runtime.ingest({
        type: JobType.FILTER_REGEN,
        collection: filter.collection,
        property: filter,
        dep: this.public.getDep(filter.name)
      });
    }
  }

  findById(id) {
    this.createRelationToInternalData(id);
    return this.internalData[id];
  }

  processInternalDataItem(primaryKey) {
    this.ingestFiltersRelatedToData(primaryKey);
  }

  createGroups(group) {
    if (!Array.isArray(group)) group = [group];
    for (let i = 0; i < group.length; i++) {
      const groupName = group[i];
      if (!this.indexes.object[groupName]) {
        this.indexes.object[groupName] = [];
      }
    }
    return group;
  }

  // METHODS
  collect(data, group, config) {
    config = defineConfig(config, {
      append: true
    });
    this.global.collecting = true;
    // normalise data
    if (!Array.isArray(data)) data = [data];
    const groups = this.createGroups(group);
    const previousIndexValues = this.getPreviousIndexValues(groups);

    // process data items
    for (let i = 0; i < data.length; i++) {
      const dataItem = data[i];
      const dataProcessed = this.processDataItem(dataItem, groups, config);
      if (dataProcessed) this.collectionSize++;
    }

    // dispatch regen indexes and groups
    for (let i = 0; i < groups.length; i++) {
      const groupName = groups[i];

      // processDataItem takes care of adding the data, submit
      this.global.ingest({
        type: JobType.INDEX_UPDATE,
        collection: this.name,
        property: groupName,
        value: this.indexes.object[groupName],
        previousValue: previousIndexValues[groupName]
      });
    }

    this.global.collecting = false;
  }

  processDataItem(dataItem, groups, config) {
    const primaryKey = this.findPrimaryKey(dataItem);
    // if (!primaryKey) return;
    const key = dataItem[this.primaryKey];

    // validate against model

    // ingest the data
    this.global.ingest({
      type: jobTypes.INTERNAL_DATA_MUTATION,
      collection: this.name,
      property: key,
      value: dataItem
    });

    // add the data to group indexes
    for (let i = 0; i < groups.length; i++) {
      const groupName = groups[i];
      const index = [...this.indexes.object[groupName]];
      if (config.append) index.push(dataItem[this.primaryKey]);
      else index.unshift(dataItem[this.primaryKey]);
      this.indexes.privateWrite(groupName, index);
    }
    return true;
  }

  getPreviousIndexValues(groups) {
    const returnData = {};
    for (let i = 0; i < groups; i++) {
      const groupName = groups[i];
      returnData[groupName] = this.indexes.object[groupName];
    }
    return returnData;
  }

  findPrimaryKey(dataItem) {
    if (this.primaryKey) return true;
    if (dataItem.hasOwnProperty("id")) this.primaryKey = "id";
    else if (dataItem.hasOwnProperty("_id")) this.primaryKey = "_id";
    else if (dataItem.hasOwnProperty("key")) this.primaryKey = "key";
    if (this.primaryKey) return true;
    else return assert(warn => warn.NO_PRIMARY_KEY);
  }

  replaceIndex(indexName, newIndex) {
    if (!Array.isArray(newIndex) || typeof indexName !== "string")
      return assert(warn => warn.INVALID_PARAMETER, "replaceIndex");
    this.global.ingest({
      type: jobTypes.INDEX_UPDATE,
      collection: this.name,
      property: indexName,
      value: newIndex
    });
  }
}

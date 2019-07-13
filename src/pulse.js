import Runtime from "./runtime";
import Collection from "./collection";
import { protectedNames, jobTypes, uuid, log } from "./helpers";

export default class Pulse {
  constructor({ collections, config = {} }) {
    if (window) window._pulse = this;
    this._private = {
      runtime: null,
      history: {},
      errors: {},
      global: {
        config,
        initComplete: false,
        runningAction: false,
        runningWatcher: false,
        runningFilter: false,
        touching: false,
        dispatch: this.dispatch.bind(this),
        getContext: this.getContext.bind(this),
        contextRef: {}
      }
    };
    this.initCollections(collections);
    this.initRuntime();
    this.bindCollectionPublicData();
    this.runAllFilters();
    this._private.global.initComplete = true;
    console.log("INIT COMPLETE");
  }

  runAllFilters() {
    console.log("Running all filters...");
    const collectionKeys = Object.keys(this._private.collections);
    for (let i = 0; i < collectionKeys.length; i++) {
      const collection = this._private.collections[collectionKeys[i]];

      const filterKeys = collection.filters._keys;
      for (let i = 0; i < filterKeys.length; i++) {
        const filterName = filterKeys[i];
        if (filterName !== "_keys")
          this._private.runtime.performFilterOutput(
            collection.name,
            filterName
          );
      }
    }

    // performFilterOutput
  }

  initCollections(collections) {
    this._private.collections = {};
    let collectionKeys = Object.keys(collections);
    for (let i = 0; i < collectionKeys.length; i++) {
      const collection = collections[collectionKeys[i]];
      this._private.collections[collectionKeys[i]] = new Collection(
        { _global: this._private.global, name: collectionKeys[i] },
        collection
      );
    }
  }

  initRuntime() {
    this._private.runtime = new Runtime(
      this._private.collections,
      this._private.global
    );
  }

  bindCollectionPublicData() {
    let collectionKeys = Object.keys(this._private.collections);
    for (let i = 0; i < collectionKeys.length; i++) {
      const collection = this._private.collections[collectionKeys[i]];
      this._private.global.contextRef[collectionKeys[i]] =
        collection.public.object;
      this[collectionKeys[i]] = collection.public.object;
    }
  }

  dispatch(type, payload) {
    switch (type) {
      case "mutation":
        this._private.runtime.ingest({
          type: jobTypes.PUBLIC_DATA_MUTATION,
          collection: payload.collection,
          property: payload.key,
          value: payload.value,
          dep: payload.dep
        });
        break;

      default:
        break;
    }
  }

  getContext(collection) {
    return {
      ...this._private.global.contextRef,
      ...this._private.collections[collection].methods,
      data: this._private.collections[collection].data.object,
      indexes: this._private.collections[collection].indexes.object,
      groups: this._private.collections[collection].groups,
      filters: this._private.collections[collection].filters,
      routes: this._private.collections[collection].routes
    };
  }

  install(Vue) {
    const pulse = this;
    const config = pulse._private.global.config.waitForMount;
    Vue.mixin({
      beforeCreate() {
        Object.keys(pulse.global.dataRef).forEach(collection => {
          this["$" + collection] = pulse.global.dataRef[collection];
        });

        this.$utils = pulse.utils;
        this.$services = pulse.services;
        this.$staticData = pulse.staticData;

        this.mapData = properties =>
          pulse
            .mapData(properties, this, {
              waitForMount: config.waitForMount
            })
            .bind(pulse);
      },
      mounted() {
        if (this.__pulseUniqueIdentifier && config.waitForMount)
          pulse.mount(this);
      },
      beforeDestroy() {
        if (this.__pulseUniqueIdentifier && config.autoUnmount)
          pulse.unmount(this);
      }
    });
  }
  mapData(properties, instanceToBind, config) {
    instanceToBind = instanceToBind ? instanceToBind : this;
    let returnData = {};

    let uuid = instanceToBind.__pulseUniqueIdentifier;

    if (!uuid) {
      // generate UUID
      uuid = uuid();
      // inject uuid into component instance
      const componentContainer = {
        instance: instanceToBind,
        uuid,
        ready: config && config.waitForMount ? false : true,
        mappedData: properties,
        config
      };
      instanceToBind.__pulseUniqueIdentifier = uuid;

      // register component globally
      pulse.global.componentStore[uuid] = componentContainer;
    } else {
      pulse.mount(instanceToBind);
    }

    if (properties)
      pulse.normalizeMap(properties).forEach(({ key, val }) => {
        // parse address
        let collection = val.split("/")[0];
        let property = val.split("/")[1];

        // if collection not found return
        if (!pulse.hasOwnProperty(collection)) return;

        let subscribed = pulse._collections[collection]._subscribedToData;

        let ref = {
          componentUUID: uuid,
          key
        };

        // register component locally on collection
        if (!subscribed.hasOwnProperty(property)) {
          subscribed[property] = [ref];
        } else subscribed[property].push(ref);

        // return data values to component
        returnData[key] = pulse[collection][property];
      });
    return returnData;
  }
  normalizeMap(map) {
    return Array.isArray(map)
      ? map.map(key => ({ key, val: key }))
      : Object.keys(map).map(key => ({ key, val: map[key] }));
  }
}

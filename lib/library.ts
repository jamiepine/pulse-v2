import Runtime from "./runtime";
import Collection from "./collection";
import SubController from "./subController";
import Request from "./collections/request";
import { uuid, normalizeMap } from "./helpers";
import {
  Private,
  RequestConfig,
  RootCollectionObject,
  JobType
} from "./interfaces";

export default class Library {
  _private: Private;
  [key: string]: any;

  constructor(root: RootCollectionObject) {
    this._private = {
      runtime: null,
      events: {},
      global: {
        config: root.config,
        initComplete: false,
        runningAction: false,
        runningWatcher: false,
        runningFilter: false,
        collecting: false,
        subs: new SubController(this.getContext.bind(this)),
        dispatch: this.dispatch.bind(this),
        getContext: this.getContext.bind(this),
        contextRef: {},
        uuid
      }
    };
    // this.mapData = this._mapData.bind(this);
    this.initCollections(root.collections);
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

      const filterKeys = collection.keys.filters;
      for (let i = 0; i < filterKeys.length; i++) {
        const filterName = filterKeys[i];
        this._private.runtime.performFilterOutput({
          collection: collection.name,
          property: filterName,
          type: JobType.FILTER_REGEN
        });
      }
    }
  }

  initCollections(collections: object, request: RequestConfig = {}) {
    this._private.collections = {};
    let collectionKeys = Object.keys(collections);
    for (let i = 0; i < collectionKeys.length; i++) {
      const collection = collections[collectionKeys[i]];
      this._private.collections[collectionKeys[i]] = new Collection(
        collectionKeys[i],
        this._private.global,
        collection
      );
    }
    this._private.collections["request"] = new Request(
      this._private.global,
      request
    );
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

  dispatch(type: string, payload) {
    switch (type) {
      case "mutation":
        this._private.runtime.ingest({
          type: JobType.PUBLIC_DATA_MUTATION,
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
    const c = this._private.collections[collection];
    if (!c) return this._private.global.contextRef;
    return {
      ...this._private.global.contextRef,
      ...c.methods,
      data: c.public.object,
      indexes: c.indexes.object,
      groups: c.public.object,
      filters: c.public.object,
      routes: c.public.object.routes
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

  mapData(properties, instance = {}, _config = {}) {
    const config = {
      waitForMount: true,
      ..._config
    };
    const componentUUID = this._private.global.subs.registerComponent(
      instance,
      config
    );
    // new cool mapData method
    if (typeof properties === "function") {
      return this._private.global.subs.subscribePropertiesToComponents(
        properties,
        componentUUID
      );
      // legacy support....
    } else if (typeof properties === "object") {
      let returnData = {};
      normalizeMap(properties).forEach(({ key, val }) => {
        let collection = val.split("/")[0];
        let property = val.split("/")[1];
        let c = this._private.global.getContext()[collection];
        returnData = this._private.global.subs.subscribePropertiesToComponents(
          () => {
            return { [key]: c[property] };
          },
          componentUUID
        );
      });
      return returnData;
    }
  }

  emit(name: string, payload: any): void {
    if (this._private.events[name])
      for (let i = 0; i < this._private.events[name].length; i++) {
        const callback = this._private.events[name][i];
        callback(payload);
      }
  }
  on(name: string, callback: () => any): void {
    if (!Array.isArray(this._private.events[name]))
      this._private.events[name] = [callback];
    else this._private.events[name].push(callback);
  }
}

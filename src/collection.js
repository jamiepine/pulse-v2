import Reactive from "./reactive";
import { protectedNames } from "./helpers";
import Action from "./action";

export default class Collection {
  constructor(
    { name, dispatch, _global },
    {
      config = {},
      data = {},
      model = {},
      actions = {},
      filters = {},
      groups = [],
      routes = {},
      watch = {},
      persist = [],
      local = {},
      onReady
    }
  ) {
    this.name = name;
    this.config = config;
    this._global = _global;
    this.dispatch = dispatch;
    groups = this.normalizeGroups(groups);

    this.methods = {
      collect: this.collect.bind(this)
    }

    this.internalData = {};

    this.prepareNamespace({ data, groups, filters, actions });
    this.initReactive(data, groups);

    this.initActions(actions);
    this.initWatchers(watch)
  }

  prepareNamespace(types) {
    this.public = {
      actions: {},
      filters: {},
      groups: {},
      data: {},
      routes: {}
    };
    if (this._global.config.bindPropertiesToCollectionRoot === false) {
      return;
    }
    // let dataKeys = Object.keys(types.data);
    // for (let i = 0; i < dataKeys.length; i++) {
    //   const dataName = dataKeys[i];
    // }
  }

  normalizeGroups(groupsAsArray) {
    const groups = {};
    for (let i = 0; i < groupsAsArray.length; i++) {
      const groupName = groupsAsArray[i];
      groups[groupName] = [];
    }
    return groups;
  }

  initReactive(data, groups) {
    let dataKeys = Object.keys(data);
    let groupKeys = Object.keys(groups);
    // Make data reactive
    this.data = new Reactive(data, this.dispatch, {
      mutable: dataKeys,
      type: "data",
      collection: this.name
    });
    this.public.data = this.data.object;

    if (this._global.config.bindPropertiesToCollectionRoot !== false) {
      for (let i = 0; i < dataKeys.length; i++) {
        const key = dataKeys[i];
        this.public[key] = this.data.object[key];
      }
    }
    // Make indexes reactive
    this.indexes = new Reactive(groups, this.dispatch, {
      mutable: groupKeys,
      type: "indexes",
      collection: this.name
    });
    this.public.indexes = this.indexes.object;

    // Make entire public object Reactive
    this.public = new Reactive(this.public, this.dispatch, {
      mutable: [...dataKeys, ...groupKeys],
      collection: this.name
    });
  }

  initActions(actions) {
    this.actions = {};
    let actionKeys = Object.keys(actions);
    for (let i = 0; i < actionKeys.length; i++) {
      const action = actions[actionKeys[i]];
      this.actions[actionKeys[i]] = new Action(
        {
          collection: this.name,
          _global: this._global
        },
        action,
        actionKeys[i]
      );
      this.public.object.actions[actionKeys[i]] = this.actions[
        actionKeys[i]
      ].exec;
      if (this._global.config.bindPropertiesToCollectionRoot !== false) {
        this.public.privateWrite(
          actionKeys[i],
          this.actions[actionKeys[i]].exec
        );
      }
    }
  }

  initWatchers(watchers) {
    this.watchers = {}
    let watcherKeys = Object.keys(watchers)
    for (let i = 0; i < watcherKeys.length; i++) {
      const watcher = watchers[watcherKeys[i]];
      this.watchers[watcherKeys[i]] = function () {
        return watcher.apply(
          null,
          [this._global.getContext(this.name)].concat(Array.prototype.slice.call(arguments))
        );
      }
    }
    
  }



  // METHODS
  collect() {
    
  }
}

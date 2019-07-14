import Reactive from "./reactive";
import { protectedNames } from "./helpers";
import Action from "./action";
import Filter from "./filter";

export default class Collection {
  constructor(
    { name, _global },
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
    this.global = _global;
    this.dispatch = _global.dispatch;
    groups = this.normalizeGroups(groups);
    this.filterDeps = {};
    this.methods = {
      collect: this.collect.bind(this)
    };

    this.internalData = {};

    this.prepareNamespace({ data, groups, filters, actions });
    this.initReactive(data, groups);

    this.initActions(actions);
    this.initWatchers(watch);
    this.initFilters(filters);
  }

  prepareNamespace(types) {
    this.keys = {};
    Object.keys(types).forEach(type => {
      this.keys[type] = Object.keys(types[type]);
    });

    this.public = Object.assign(
      {},
      // force defaults
      { routes: {}, indexes: {} },
      types.filters,
      this.data,
      this.groups
    );
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

    for (let i = 0; i < dataKeys.length; i++) {
      const key = dataKeys[i];
      this.public[key] = data[key];
    }

    // Make indexes reactive
    this.indexes = new Reactive(groups, this.global, {
      mutable: groupKeys,
      type: "indexes",
      collection: this.name
    });
    this.public.indexes = this.indexes.object;

    // Make entire public object Reactive
    this.public = new Reactive(Object.assign({}, this.public), this.global, {
      mutable: [...dataKeys, ...groupKeys],
      collection: this.name,
      keys: this.keys,
      referenceFilterDeps: this.referenceFilterDeps.bind(this)
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
          global: this.global
        },
        action,
        actionKeys[i]
      );

      if (this.global.config.bindPropertiesToCollectionRoot !== false) {
        this.public.privateWrite(
          actionKeys[i],
          this.actions[actionKeys[i]].exec
        );
      } else {
        this.public.object.actions[actionKeys[i]] = this.actions[
          actionKeys[i]
        ].exec;
      }
    }
    this.actions._keys = actionKeys;
  }

  initWatchers(watchers) {
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

  // this function is used to alias the filter output's Dep class on the collection instance
  //
  referenceFilterDeps(filter, dep) {
    this.filterDeps[filter] = dep;
  }

  // METHODS
  collect() {}
}

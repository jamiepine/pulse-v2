import { protectedNames, arrayFunctions, isWatchableObject } from "./helpers";
import Dep from "./dep";

export default class Reactive {
  constructor(object = {}, _global, config = {}) {
    this.global = _global;
    this.mutable = config.mutable || [];
    this.collection = config.collection;
    this.dispatch = this.global.dispatch;
    this.allowPrivateWrite = false;
    this.properties = Object.keys(object);
    this.object = this.reactiveObject(object);
  }

  reactiveObject(object, rootProperty) {
    const self = this;
    const objectKeys = Object.keys(object);

    for (let i = 0; i < objectKeys.length; i++) {
      const key = objectKeys[i];
      let value = object[key];

      if (Array.isArray(value)) {
        value = this.reactiveArray(value, key);
      } else if (isWatchableObject(value) && !protectedNames.includes(key)) {
        value = this.deepReactiveObject(value, object.rootProperty || key);
      }

      const dep = new Dep({ _global: this.global });

      Object.defineProperty(object, key, {
        get: function pulseGetter() {
          dep.register();
          return value;
        },
        set: function pulseSetter(newValue) {
          // if rootProperty is present & is mutable
          if (rootProperty && self.mutable.includes(rootProperty)) {
            // mutate locally
            value = newValue;
            // dispatch mutation for rootProperty
            self.dispatch("mutation", {
              collection: self.collection,
              key: rootProperty,
              value: self.object[rootProperty],
              dep: dep
            });
          } else {
            // if backdoor open or is protected name, allow direct mutation
            if (self.allowPrivateWrite || protectedNames.includes(key))
              return (value = newValue);

            // if property is mutable dispatch update
            if (self.mutable.includes(key)) {
              self.dispatch("mutation", {
                collection: self.collection,
                key,
                value: newValue,
                dep: dep
              });
              // we did not apply the mutation since runtime will privatly
              // write the result since we dispatched above
            }
          }
        }
      });
    }
    return object;
  }

  deepReactiveObject(value, rootProperty) {
    let objectWithCustomPrototype = Object.create({
      rootProperty
    });
    // repopulate custom object with incoming values
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
      const property = keys[i];
      objectWithCustomPrototype[property] = value[property];
    }

    this.allowPrivateWrite = true;
    const obj = this.reactiveObject(objectWithCustomPrototype, rootProperty);
    this.allowPrivateWrite = false;
    return obj;
  }

  reactiveArray(array, key) {
    const self = this;
    const reactiveArray = array.slice();

    for (let i = 0; i < arrayFunctions.length; i++) {
      const func = arrayFunctions[i];
      const original = Array.prototype[func];
      Object.defineProperty(reactiveArray, func, {
        value: function() {
          const result = original.apply(this, arguments);
          self.dispatch("mutation", {
            collection: self.collection,
            key,
            value: result
          });
          return result;
        }
      });
    }

    return reactiveArray;
  }

  privateWrite(property, value) {
    this.allowPrivateWrite = true;
    this.object[property] = value;
    this.allowPrivateWrite = false;
  }
}

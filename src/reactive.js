import { protectedNames } from "./helpers";

export default class Reactive {
  constructor(object = {}, dispatch, config = {}) {
    // let { root, deep } = config;
    this.mutable = config.mutable || [];
    this.type = config.type || "root";
    this.collection = config.collection;
    this.dispatch = dispatch;
    this.allowPrivateWrite = false;
    this.properties = Object.keys(object);
    this.object = this.proxify(object);
    this.dependents = {
      thing: [
        ['collection', 'type', 'key']
      ]
    }
  }

  /**
   * @param {Array} mutations - description
   */
  proxify(object) {
    return new Proxy(object, {
      set: (target, key, value) => {
        if (this.allowPrivateWrite) {
          target[key] = value;
          return true;
        }
        if (protectedNames.includes(key)) return true;

        if (this.mutable.includes(key) && target.hasOwnProperty(key)) {
          console.log("DISPATCHING", key, value);
          this.dispatch("mutation", {
            collection: this.collection,
            key,
            value
          });
          // this.privateWrite(key, value);
        }
        return true;
      }
    });
  }

  privateWrite(property, value) {
    this.allowPrivateWrite = true;
    this.object[property] = value;
    this.allowPrivateWrite = false;
  }
}

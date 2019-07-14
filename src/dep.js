export default class Dep {
  constructor(glob, key, rootProperty, propertyOnObject) {
    this.global = glob;
    this.rootProperty = rootProperty;
    this.propertyOnObject = propertyOnObject;
    this.name = key;

    this.dependents = new Set();
    this.subscribers = [];
  }

  register() {
    const subs = this.global.subs;

    if (this.global.runningFilter) {
      this.dependents.add(this.global.runningFilter);
    }
    if (subs.subscribingComponent) {
      this.subscribeComponent();
    }
    if (subs.unsubscribingComponent) {
      // this.subscribers.delete(this.global.subscribingComponent);
    }
  }

  subscribeComponent() {
    console.log(this);
    const subs = this.global.subs;

    if (this.rootProperty && subs.skimmingDeepReactive) {
      subs.prepareNext(this);
      return;
    }
    if (this.rootProperty) {
      subs.foundDeepReactive();
      subs.prepareNext(this);
      return;
    }
    if (!this.rootProperty && subs.skimmingDeepReactive) {
      subs.exitDeepReactive();
    }

    this.subscribe();

    subs.prepareNext(this);
  }
  subscribe() {
    const subs = this.global.subs;
    const keys = subs.subscribingComponent.keys;
    const key = keys[subs.subscribingComponentKey];
    const component = {
      componentUUID: subs.subscribingComponent.componentUUID,
      key: key
    };
    this.subscribers.push(component);
  }
}

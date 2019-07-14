export default class SubController {
  constructor(getContext) {
    this.getContext = getContext;
    this.subscribingComponent = false;
    this.unsubscribingComponent = false;
    this.subscribingComponentKey = false;
    this.skimmingDeepReactive = false;
    this.lastAccessedDep = null;
  }

  subscribePropertiesToComponents(properties, componentUUID) {
    // provisionally get keys of mapped data
    const provision = properties(this.getContext());
    console.log(provision);
    const keys = Object.keys(provision);

    // mapData has a user defined local key, we need to include that in the subscription so we know what to update on the component later.
    this.subscribingComponentKey = 0;
    this.subscribingComponent = {
      componentUUID,
      keys
    };
    const returnToComponent = properties(this.getContext());
    this.subscribingComponent = false;
    this.subscribingComponentKey = false;
    return returnToComponent;
  }
  prepareNext(dep) {
    this.lastAccessedDep = dep;
    if (!this.skimmingDeepReactive) this.subscribingComponentKey++;
  }
  foundDeepReactive() {
    this.skimmingDeepReactive = true;
    // undo changes
    this.lastAccessedDep.subscribers.pop();
    this.subscribingComponentKey--;
  }
  exitDeepReactive() {
    this.skimmingDeepReactive = false;
    this.lastAccessedDep.subscribe();
    this.subscribingComponentKey++;
  }
}

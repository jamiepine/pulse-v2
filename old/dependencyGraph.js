export default class DependencyGraph {
  constructor({ collection, _global }, trackable) {
    this.graph = {};
    this.collectionName = collection;

    this.prepareGraph(trackable);
  }

  prepareGraph(trackable) {
    let trackableKeys = Object.keys(trackable);
    for (let i = 0; i < trackableKeys.length; i++) {
      const element = trackable[trackableKeys[i]];
    }
  }

  findAll(filter) {
    const graph = this.graph;
    if (!graph[this.collectionName][filter]) return [];
    const dependents = graph[this.collectionName][filter].dependents;
    const dependenciesFound = [];
    let loops = 0;
    let lastRound = [];
    for (let i = 0; i < dependents.length; i++) {
      const dep = dependents[i];
      lastRound.push(dep);
      dependenciesFound.push(dep);
    }
    const loop = () => {
      loops++;
      const loopChildren = lastRound;
      lastRound = [];
      for (let i = 0; i < loopChildren.length; i++) {
        const dep = loopChildren[i];
        const depParsed = this.parseKey(dep);
        const search =
          graph[depParsed.collection][depParsed.property].dependents;
        for (let i = 0; i < search.length; i++) {
          const childDep = search[i];
          lastRound.push(childDep);
          dependenciesFound.push(childDep);
        }
      }
      if (loops > 1000)
        return assert(`Maximum stack exceeded for dependent search.`);
      else if (lastRound.length !== 0) loop();
    };
    loop();
    return dependenciesFound;
  }
}

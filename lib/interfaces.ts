import SubController from "./subController";
import Runtime from "./runtime";
import Collection from "./collection";
import Dep from "./dep";
import Action from "./action";
import Filter from "./filter";

export interface ExpandableObject {
  [key: string]: any;
}

export interface Watcher {
  collection: string;
  property: string;
}

export interface RootConfig {
  framework?: any;
  frameworkConstructor?: any;
}
export interface CollectionConfig {}

export interface RootCollectionObject {
  config?: RootConfig;
  request?: object;
  collections?: object;

  // basic
  data?: object;
  persist?: Array<object>;
  groups?: Array<string>;
  actions?: object;
  filters?: object;
  watch?: object;
  routes?: object;
  model?: object;
  local?: object;
}

export interface Methods {
  collect: void;
  replaceIndex: void;
}

export interface Keys {
  data?: Array<string>;
  filters?: Array<string>;
  actions?: Array<string>;
  groups?: Array<string>;
}

export interface CollectionObject {
  config?: CollectionConfig;
  data?: object;
  persist?: Array<string>;
  groups?: Array<string>;
  actions?: object;
  filters?: object;
  watch?: object;
  routes?: object;
  model?: object;
  local?: object;
  // private
  indexes?: object;
}

export interface Global {
  subs: SubController;
  runtime?: Runtime;
  config: object;
  initComplete: boolean;
  collecting: boolean;
  runningAction: boolean | Action;
  runningFilter: boolean | Filter;
  runningWatcher: boolean | Watcher;
  contextRef: ExpandableObject;
  // aliases
  dispatch: any;
  getContext: any;
  uuid: any;
  ingest?: any;
}

export interface Private {
  global: Global;
  runtime: Runtime;
  collections?: { [key: string]: Collection };
}

export const enum JobType {
  PUBLIC_DATA_MUTATION = "PUBLIC_DATA_MUTATION",
  INTERNAL_DATA_MUTATION = "INTERNAL_DATA_MUTATION",
  INDEX_UPDATE = "INDEX_UPDATE",
  FILTER_REGEN = "FILTER_REGEN",
  GROUP_UPDATE = "GROUP_UPDATE",
  DEEP_PUBLIC_DATA_MUTATION = "DEEP_PUBLIC_DATA_MUTATION",
  BULK_INTERNAL_DATA_MUTATION = "BULK_INTERNAL_DATA_MUTATION"
}

export interface Job {
  type: JobType;
  collection: string;
  property: string;
  value?: string;
  previousValue?: string;
  dep?: Dep;
  fromAction?: boolean | Action;
}

export interface ComponentContainer {
  instance: any;
  uuid: string;
  ready: boolean;
}

import Pulse from "./pulse";

const pulse = new Pulse({
  config: {
    bindPropertiesToCollectionRoot: false
  },
  collections: {
    channels: {
      groups: ["myChannels"],
      data: {
        openChannel: true
      }
    }
  }
});

pulse._private.collections.channels.data.privateWrite('openChannel', false)
pulse._private.collections.channels.data.dispatch()

pulse.channels.data.openChannel = 'LMFAO'
console.log(pulse);


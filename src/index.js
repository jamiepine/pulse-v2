import Pulse from "./pulse";

const pulse = new Pulse({
  config: {
    bindPropertiesToCollectionRoot: true
  },
  collections: {
    channels: {
      groups: ["myChannels"],
      data: {
        openChannel: true,
        currentChannel: 32
      },
      actions: {
        test({channels}) {
          channels.currentChannel = 55
          return true;
        }
      }
    }
  }
});

pulse._private.collections.channels.data.privateWrite("openChannel", false);
pulse._private.collections.channels.data.dispatch();

pulse.channels.data.openChannel = "LMFAO";

console.log(pulse.channels.actions.test());

console.log(pulse);

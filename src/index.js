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
        test({ channels }) {
          channels.currentChannel = "FIRST";
          channels.openChannel = "SECOND";
          return true;
        }
      },
      watch: {
        openChannel({ channels }) {
          channels.currentChannel = "THIRD";
        }
      },
      filters: {
        haha() {
          return
        }
      }
    }
  }
});

pulse._private.collections.channels.data.privateWrite("openChannel", false);
pulse._private.collections.channels.data.dispatch();

// pulse.channels.openChannel = "LMFAO";
pulse.channels.test();

console.log(pulse);

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
          channels.currentChannel = 55
          channels.openChannel = false
          return true;
        }
      },
      watch: {
        openChannel() {
          console.log('hi');
          
        }
      }
    }
  }
});

pulse._private.collections.channels.data.privateWrite("openChannel", false);
pulse._private.collections.channels.data.dispatch();

pulse.channels.openChannel = "LMFAO";
pulse.channels.test()

// console.log(pulse);

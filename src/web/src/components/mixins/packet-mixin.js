import { hash, packet, twist } from '../../../../../dist/toda.web.dist.js';
const { Packet } = packet;
const { Hash } = hash;
const { Twist } = twist;

export default {
  props: {
    hash: Hash,
    packet: Packet,
    twist: Twist
  },
  computed: {
    shapedValue() {
      return this.packet ? this.packet.getShapedValue() : {};
    },
    moniker() {
      return this.packet ? this.packet.constructor.getMoniker() : '';
    }
  }
}

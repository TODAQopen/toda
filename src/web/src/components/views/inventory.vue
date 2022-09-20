<template>
  <div class="inventory">
    <div class="pagination-nav">
      <button @click="this.back()" :class="{ disabled: this.isFirst }">prev</button>
      <button v-for="item in this.pages" :key="item" @click="() => goToPage(item)"
              :class="{ selected: this.isCurrent(item) }">
        {{ item }}
      </button>
      <button @click="this.next()" :class="{ disabled: this.isLast }">next</button>
    </div>
    <div class="twists" v-if="this.twistHashes.length > 1">
      <div class="file-link" v-for="twistHash in this.paginatedData" :key="twistHash">
        <router-link :to="`/${twistHash}`" class="mono">{{ twistHash }}</router-link>
      </div>
    </div>
    <div v-else>
      Loading...
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import Uploader from '../files/uploader.vue';
import LineDetails from "../files/line-details";
import { hash, atoms, twist, ByteArray } from '../../../../../dist/toda.web.dist.js';
const { Hash }  = hash;
const { Atoms } = atoms;
const { Twist } = twist;

export default {
  name: 'Inventory',
  inject: ['config'],
  components: {
    Uploader,
    LineDetails
  },
  data: function() {
    return {
      twistHashes: [],
      localTwist: null,
      page: 1,
      perPage: 50,
    }
  },
  created: async function() {
    let bytes = await axios.get(`${this.config.server}/files`,{
      responseType: 'arraybuffer'
    }).then(res => new ByteArray(res.data));


    let hashes = [];
    while (bytes.length > 0) {
      let hash = Hash.parse(bytes);
      hashes.push(hash);
      bytes = bytes.slice(hash.numBytes());
    }

    this.twistHashes = hashes.map(h => `${h.toString()}`).sort();
    if (this.twistHashes.length === 1) {
      this.$router.push(`/${this.twistHashes[0]}`);
    }
  },
  methods: {
    async onChange(bytes) {
      this.localTwist = new Twist(Atoms.fromBytes(bytes));
    },
    next() {
      let current = this.page * this.perPage;
      if (current < this.twistHashes.length) {
        this.page += 1;
      }
    },
    back() {
      if (this.page > 1) {
        this.page -= 1;
      }
    },
    goToPage(numPage) {
      this.page = numPage;
    },
    isCurrent(page) {
      return this.page === page;
    }
  },
  computed: {
    paginatedData() {
      return this.twistHashes.slice((this.page - 1) * this.perPage, this.page * this.perPage);
    },
    isFirst() {
      return this.page === 1;
    },
    isLast() {
      return this.page === this.pages;
    },
    pages() {
      return Math.ceil(this.twistHashes.length / this.perPage);
    }
  }
}
</script>

<template>
  <div>
    <div class="nav-header util-wrapper">
      <div class="row">
        <div class="col-sm-6">
          <router-link to="/"><BIconArrowLeftCircle/> List</router-link>
        </div>
        <div class="col-sm-6">
          <a v-if="this.abject" :href="this.fileData" :download="`${this.abject.getHash()}.toda`" ><BIconCloudDownload/> Download</a>
        </div>
      </div>
    </div>

    <div v-if="this.loading">Loading...</div>

    <AbjectViewer v-if="this.abject" :abject="this.abject"/>

    <div class="error-wrapper" v-if="this.error">
      <div>An error has occurred while parsing the twist:</div>
      <span class="error">{{ this.error }}</span>
    </div>
  </div>
</template>

<script>

import { BIconArrowLeftCircle, BIconCloudDownload } from 'bootstrap-icons-vue';
import axios from "axios";
import LineDetails from '../files/line-details.vue';
import AbjectViewer from '../abjects/abject-viewer.vue';
import { ByteArray, atoms, twist, hash, abject } from '../../../../../dist/toda.web.dist.js';
import { Buffer } from 'buffer/';

const { Atoms } = atoms;
const { Twist } = twist;
const { Hash } = hash;
const { Abject } = abject;

export default {
  name: 'File',
  inject: ['config'],
  components: {
    LineDetails,
    AbjectViewer,
    BIconArrowLeftCircle,
    BIconCloudDownload
  },
  data: function() {
    return {
      abject: null,
      buffer: null,
      id: this.$route.params.id,
      focus: this.$route.params.focus,
      loading: true,
      error: null
    }
  },
  errorCaptured: function(err) {
    this.error = err;
    return false;
  },
  created: async function() {
    try {
      let res = await axios.get(`${this.config.server}/files/${this.id}`,{
        responseType: 'arraybuffer',
      });

      this.buffer = res.data;
      let focusHash;
      try {
        focusHash = this.focus ?
            Hash.parse(new ByteArray(Buffer.from(this.focus, 'hex'))) :
            Hash.parse(new ByteArray(Buffer.from(this.id, 'hex')));
      } catch(e) {}

      let atoms = Atoms.fromBytes(new ByteArray(this.buffer));

      try {
        this.abject = Abject.parse(atoms, focusHash);
      } catch(e) {
        this.abject = new Twist(atoms, focusHash);
      }

      this.loading = false;
    } catch(e) {
      this.error = e;
    }
  },
  computed: {
    fileData() {
      const blob = new Blob([this.buffer]);
      return URL.createObjectURL(blob);
    }
  }
}
</script>

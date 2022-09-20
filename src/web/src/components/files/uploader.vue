<template>
  <div>
    <h2>Inspect a local file</h2>
    <div class="uploader" v-bind:class="{ hover: this.hovering }" @dragover="dragover" @dragleave="dragleave" @drop="drop" @click="$refs.file.click()">
      <label for="assetsFieldHandle">
        Drop a local .toda file in here or click here to select a local file to inspect.
      </label>
      <input type="file" id="assetsFieldHandle" @change="onSelect" ref="file" accept=".toda" />
    </div>
  </div>
</template>

<script>
import { ByteArray } from '../../../../../dist/toda.web.dist.js';

export default {
  name: 'Uploader',
  components: {
    History
  },
  data: function () {
    return {
      hovering: false
    }
  },
  methods: {
    getFileBytes(file) {
      let reader = new FileReader();
      reader.readAsArrayBuffer(file);

      reader.onload = () => {
        this.$emit('on-change', new ByteArray(reader.result));
      };
    },
    onChange(files) {
      this.getFileBytes(files[0])
    },
    remove(idx) {
      this.files.splice(idx, 1);
    },
    dragover(e) {
      e.preventDefault();
      this.hovering = true;
    },
    dragleave(e) {
      this.hovering = false;
    },
    drop(e) {
      e.preventDefault();
      this.onChange(e.dataTransfer.files);
      this.hovering = false;
    },
    onSelect(e) {
      this.onChange(e.target.files)
    }
  }
}
</script>

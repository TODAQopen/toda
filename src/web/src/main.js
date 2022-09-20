import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import Inventory from './components/views/inventory.vue';
import File from './components/views/file.vue';
import HashPacket from './components/files/hash-packet.vue';
import { ByteArray } from '../../../dist/toda.web.dist.js';
import yaml from 'js-yaml';

// Router
const routes = [
  { path: '/', component: Inventory },
  { path: '/:id', component: File },
  { path: '/:id/:focus', component: File },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

fetch(process.env.BASE_URL + 'config.yml')
  .then(resp => resp.arrayBuffer())
  .then(buf => {
    let bytes = new ByteArray(buf);
    let config = yaml.load(bytes.toUTF8String());
    createApp(App)
      .use(router)
      .component('HashPacket', HashPacket)
      .provide('config', config)
      .mount('#app');
  });




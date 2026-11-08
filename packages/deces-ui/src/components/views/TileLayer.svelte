<div>
    <slot></slot>
</div>

<script>
    import L from 'leaflet';

    import tileServers from '../tools/tileServers.js';
    import { onMount, getContext } from 'svelte';

    export let tileServer = 'osm.mapnik'

    onMount(() => {
		L.Map.addInitHook(function() {
			const map = this;
			const {url, attribution, className, opacity} = tileServers[tileServer];
			L.tileLayer(url, {
				attribution,
				maxZoom: 18,
				id: tileServer,
				...(className ? { className } : {}),
				...(opacity !== undefined ? { opacity } : {})
			}).addTo(map);
		});
    });

</script>

<style>
	:global(.leaflet-layer.tiles-greyscale) {
		filter: grayscale(1);
	}
</style>

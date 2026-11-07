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
			const {url, attribution, className} = tileServers[tileServer];
			L.tileLayer(url, {
				attribution,
				maxZoom: 18,
				id: tileServer,
				...(className ? { className } : {})
			}).addTo(map);
		});
    });

</script>

<style>
	:global(.leaflet-layer.tiles-greyscale) {
		filter: grayscale(1);
	}
</style>

(function(){
  class Map { constructor(el,o){ this.el=el; this.z=o.zoom; this.ls={}; window.__mockMap=this; this.opts=o; } addListener(n,f){ this.ls[n]=f; return {remove(){}}; }
    fitBounds(b,p){ window.__fits=(window.__fits||0)+1; } panTo(){} setZoom(z){ this.z=z; } getZoom(){ return this.z; } setOptions(o){ this.lastOpts=o; } }
  class AdvancedMarkerElement { constructor(o){ this.content=o.content; this._m=null; this.position=o.position; this.draggable=!!o.gmpDraggable; (window.__ames=window.__ames||[]).push(this); this.map=o.map; window.__markers=(window.__markers||0)+1; }
    set map(m){ if(m && !this._m) m.el.appendChild(this.content); if(!m && this.content.parentNode) this.content.remove(); this._m=m; } get map(){ return this._m; }
    addListener(){ return {remove(){}}; } }
  class Polyline { setOptions(o){ Object.assign(this.o,o); } setPath(p){ this.o.path=p; window.__setPath=(window.__setPath||0)+1; } constructor(o){ this.o=o; this.ls={}; window.__lines=(window.__lines||0)+1; (window.__polys=window.__polys||[]).push(this); } setMap(m){ this.onmap=!!m; } addListener(n,f){ this.ls[n]=f; return {remove(){}}; } }
  class InfoWindow { setContent(c){ this.c=c; window.__iwc=c; } setPosition(p){ this.p=p; } close(){ window.__iwOpen=false; } open(){ window.__iw=(window.__iw||0)+1; window.__iwOpen=true; } }
  class LatLngBounds { extend(){} }
  class Circle { constructor(o){ this.o=o; (window.__circles=window.__circles||[]).push(this); } setMap(m){ this.o.map=m; } setCenter(c){ this.o.center=c; } setRadius(r){ this.o.radius=r; } }
  const Route = { computeRoutes: async r => { window.__calls=(window.__calls||0)+1; if (window.__noRoutes) throw new Error("mock: no routes"); await new Promise(z=>setTimeout(z,5));
    const d = Math.hypot(r.origin.lat-r.destination.lat, r.origin.lng-r.destination.lng)*111;
    return { routes: [{ path: [{lat:r.origin.lat,lng:r.origin.lng},{lat:(r.origin.lat+r.destination.lat)/2+0.05,lng:(r.origin.lng+r.destination.lng)/2},{lat:r.destination.lat,lng:r.destination.lng}], distanceMeters: d*1200, durationMillis: d*1200/90*3600 }] }; } };
  class Place { constructor(o){ this.id=o.id; } async fetchFields(){ await new Promise(z=>setTimeout(z,10)); this.displayName = this.id==='bad' ? '' : 'Al Baleed Resort Salalah by Anantara'; }
    static async searchNearby(r){ window.__nearby=r; await new Promise(z=>setTimeout(z,10)); return { places: [{ id: 'near1', displayName: 'Anantara Al Jabal Al Akhdar Resort', location: { lat: () => 23.0669, lng: () => 57.6686 } }] }; }
    static async searchByText(r){ window.__text=r; await new Promise(z=>setTimeout(z,10)); return { places: [{ id: 'tx1', displayName: 'Alila Jabal Akhdar', formattedAddress: 'Jabal Al Akhdar, Oman', location: { lat: 23.07, lng: 57.62 } }, { id: 'tx2', displayName: 'Sahab Hotel', formattedAddress: 'Saiq, Oman', location: { lat: 23.06, lng: 57.65 } }] }; } }
  window.google = { maps: { importLibrary: async n => ({ maps:{Map}, marker:{AdvancedMarkerElement}, routes:{Route}, places:{Place, SearchNearbyRankPreference:{DISTANCE:'DISTANCE',POPULARITY:'POPULARITY'}} }[n]), Polyline, InfoWindow, LatLngBounds, Circle } };
  setTimeout(() => window.__omanMapsReady(), 0);
})();

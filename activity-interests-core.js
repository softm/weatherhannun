(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.WeatherActivityInterests=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const KEYS=["walk","laundry","carwash","harvest","spray","irrigation"];
  const DEFAULTS=["walk","laundry","carwash"];
  function normalize(value){
    return Array.isArray(value)?KEYS.filter(key=>value.includes(key)):DEFAULTS.slice();
  }
  function rank(items,interests,all){
    const selected=normalize(interests);
    const score=item=>Number.isFinite(item.data.score)?item.data.score:-1;
    return items.filter(item=>all||selected.includes(item.key)).sort((a,b)=>score(b)-score(a)||KEYS.indexOf(a.key)-KEYS.indexOf(b.key));
  }
  return Object.freeze({normalize,rank});
});

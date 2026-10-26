(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.WeatherHannunPlusPersonalization=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const VERSION="WH-P01-PERSONALIZATION-v1";
  const SUITABLE_SCORE=60;
  const ACTIVITIES=Object.freeze(["walk","laundry","carwash","harvest","spray","irrigation"]);
  const PROFILES=Object.freeze({
    commute:Object.freeze({
      label:"출퇴근·등하교",rainThreshold:65,dryThreshold:80,clearHours:3,
      watchRain:true,watchDry:false,watchClear:false,watchFrost:true,watchWind:true
    }),
    outdoor:Object.freeze({
      label:"야외활동 민감형",rainThreshold:50,dryThreshold:90,clearHours:4,
      watchRain:true,watchDry:true,watchClear:true,watchFrost:true,watchWind:true
    }),
    farm:Object.freeze({
      label:"농작업 점검형",rainThreshold:50,dryThreshold:80,clearHours:3,
      watchRain:true,watchDry:false,watchClear:true,watchFrost:true,watchWind:true
    })
  });
  function profile(id){return PROFILES[id]||PROFILES.commute;}
  function normalizePriority(input){
    const output=[];
    (Array.isArray(input)?input:[]).forEach(value=>{
      if(ACTIVITIES.includes(value)&&!output.includes(value)&&output.length<3)output.push(value);
    });
    return Object.freeze(output);
  }
  function order(items,priority){
    const selected=normalizePriority(priority),index=new Map(selected.map((value,position)=>[value,position]));
    return [...(Array.isArray(items)?items:[])].sort((left,right)=>{
      const leftScore=typeof left?.data?.score==="number"&&Number.isFinite(left.data.score)?left.data.score:-1;
      const rightScore=typeof right?.data?.score==="number"&&Number.isFinite(right.data.score)?right.data.score:-1;
      const leftSuitable=leftScore>=SUITABLE_SCORE;
      const rightSuitable=rightScore>=SUITABLE_SCORE;
      if(leftSuitable!==rightSuitable)return leftSuitable?-1:1;
      const leftIndex=index.has(left?.key)?index.get(left.key):Number.POSITIVE_INFINITY;
      const rightIndex=index.has(right?.key)?index.get(right.key):Number.POSITIVE_INFINITY;
      if(leftSuitable&&leftIndex!==rightIndex)return leftIndex-rightIndex;
      return rightScore-leftScore;
    });
  }
  return Object.freeze({VERSION,SUITABLE_SCORE,ACTIVITIES,PROFILES,profile,normalizePriority,order});
});

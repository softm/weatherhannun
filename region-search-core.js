/* WeatherHannun Korean administrative region lookup.
 * Static MOIS/VWorld-derived Korea legal district centroids (2026-02).
 * No VWorld API keys, live location sharing or third-party autocomplete.
 */
(function(root,factory) {
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.WeatherRegionSearchCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const KIND=["sido","si","gu","gun","eup","myeon","dong","ri"];
  const LABEL={sido:"시·도",si:"시",gu:"구",gun:"군",eup:"읍",myeon:"면",dong:"법정동",ri:"리"};
  const ALIASES={
    "서울특별시":"서울", "부산광역시":"부산", "대구광역시":"대구", "인천광역시":"인천",
    "광주광역시":"광주", "대전광역시":"대전", "울산광역시":"울산", "세종특별자치시":"세종",
    "경기도":"경기", "강원특별자치도":"강원", "강원도":"강원",
    "충청북도":"충북", "충청남도":"충남", "전북특별자치도":"전북",
    "전라북도":"전북", "전라남도":"전남", "경상북도":"경북",
    "경상남도":"경남", "제주특별자치도":"제주", "제주도":"제주"
  };
  const ROMAN={seoul:"서울",busan:"부산",incheon:"인천",daegu:"대구",daejeon:"대전",
    gwangju:"광주",ulsan:"울산",sejong:"세종",bucheon:"부천시",seosan:"서산시",pyeongtaek:"평택시",
    gangneung:"강릉시",jeju:"제주시",suwon:"수원시",paju:"파주시"};
  const SORT={dong:58,eup:55,myeon:55,ri:30,gu:26,gun:25,si:23,sido:9};
  function clean(value){
    return String(value||"").normalize("NFKC").toLowerCase().replace(/[()()[\],.·<>]/g," ")
      .replace(/\s+/g," ").trim().slice(0,100);
  }
  function compact(value){return clean(value).replace(/\s+/g,"");}
  function removeLot(query){
    return clean(query).replace(/\s+(?:산\s*)?\d+(?:-\d+)?(?:번지)?$/,"").trim();
  }
  function isStreet(query){
    return /[가-힣0-9]+(?:대로|로|길)\s*\d+(?:-\d+)?/.test(clean(query));
  }
  function textAliases(path){
    return path.map(n=>ALIASES[n]||n).join(" ");
  }
  function localParts(value){
    const word=compact(value);
    if(!word)return {word:"",stem:"",family:""};
    const suffix=word.match(/(?:특별자치도|특별자치시|특별시|광역시|자치도|도|시|군|구|읍|면|동|리)$/u)?.[0]||"";
    const family=/^(?:특별자치시|특별시|광역시|시)$/.test(suffix)?"si":
      /^(?:특별자치도|자치도|도)$/.test(suffix)?"do":suffix;
    return {word,stem:suffix?word.slice(0,-suffix.length):word,family};
  }
  function localRelation(entry,token){
    const query=localParts(token);
    const entryForms=[localParts(entry.name),localParts(ALIASES[entry.name]||"")].filter(value=>value.word);
    const sameAdministrativeName=value=>value.stem===query.stem&&
      (!value.family||!query.family||value.family===query.family);
    const exact=entryForms.some(value=>value.word===query.word||sameAdministrativeName(value));
    const compatible=value=>!query.family||!value.family||value.family===query.family;
    const prefix=!exact&&query.stem.length>=2&&entryForms.some(value=>compatible(value)&&value.stem.startsWith(query.stem));
    const contained=!exact&&!prefix&&query.stem.length>=2&&entryForms.some(value=>compatible(value)&&value.stem.includes(query.stem));
    return {exact,prefix,contained,direct:exact||prefix||contained};
  }
  function isValidCoord(lat,lon){
    return typeof lat==="number"&&typeof lon==="number"&&Number.isFinite(lat)&&Number.isFinite(lon)
      &&lat>=30&&lat<=42&&lon>=123&&lon<=134;
  }
  function load(raw){
    if(!raw||raw.v!==1||!Array.isArray(raw.nodes))throw new Error("지원되지 않는 주소 데이터입니다.");
    const entries=[],ids=new Set();
    function visit(nodes,ancestors){
      for(const node of nodes){
        if(!Array.isArray(node)||node.length<4)continue;
        const [name,index,lat,lon,children]=node;
        if(typeof name!=="string"||!KIND[index]||!isValidCoord(lat,lon))continue;
        const path=ancestors.concat(name),full=path.join(" "),id=full;
        if(!ids.has(id)){
          ids.add(id);
          const kind=KIND[index],short=path.slice(-(kind==="sido"?1:kind==="ri"?3:3)).join(" ");
          const target={id,kind,label:LABEL[kind],name,short,full,province:path[0],lat,lon,
            searchable:compact(full),aliasSearch:compact(textAliases(path)),parts:path};
          entries.push(target);
        }
        if(Array.isArray(children))visit(children,path);
      }
    }
    visit(raw.nodes,[]);
    if(entries.length<1000)throw new Error("전국 주소 데이터가 일부만 로드되었습니다.");
    return entries;
  }
  function splitQuery(value){
    const q=clean(removeLot(value));
    const direct=q.split(" ").filter(Boolean);
    if(direct.length>1)return direct;
    const tokens=q.match(/[가-힣a-z0-9]+?(?:특별자치도|특별시|광역시|특별자치시|자치도|도|시|군|구|읍|면|동|리)(?=[가-힣a-z0-9]|$)/g);
    if(tokens&&tokens.join("")===compact(q)&&tokens.length>1)return tokens;
    return direct;
  }
  function match(entry,value,tokens){
    const q=compact(value);
    if(!q)return null;
    const search=entry.searchable,alias=entry.aliasSearch,local=compact(entry.name);
    const exactFull=search===q||alias===q;
    const exactLocal=local===q;
    const beginning=local.startsWith(q),contained=local.includes(q);
    const terminal=localRelation(entry,tokens[tokens.length-1]||q);
    const fullMatch=search.includes(q)||alias.includes(q);
    const tokenMatch=tokens.every(t=>search.includes(compact(t))||alias.includes(compact(t)));
    if(!fullMatch&&!tokenMatch&&!contained&&!(tokens.length===1&&terminal.direct))return null;
    const kind=entry.kind;
    let score=SORT[kind]||0;
    if(exactFull)score+=200;
    if(exactLocal)score+=160;
    else if(beginning)score+=92;
    else if(contained)score+=38;
    if(fullMatch)score+=64;
    if(tokenMatch)score+=tokens.length>1?70:10;
    // A query ending in "소사구" describes the gu itself, not every dong
    // below it. Prefer the deepest administrative name the user actually
    // typed, including common suffix-free forms such as "부천" → "부천시".
    if(tokens.length>1&&terminal.exact)score+=190;
    else if(tokens.length>1&&terminal.prefix)score+=112;
    else if(tokens.length>1&&terminal.contained)score+=42;
    if(tokens.length>1&&entry.parts.slice(1).some(part=>compact(part)===compact(tokens[tokens.length-1])))score+=44;
    if(tokens.length>1)score+=Math.min(35,tokens.length*7);
    if(kind==="ri"&&/(리)$/.test(q))score+=80;
    if((kind==="dong"||kind==="eup"||kind==="myeon")&&/(동|읍|면)$/.test(q))score+=45;
    // Disambiguation: prefer a precise matching neighborhood over a province/city.
    return {score,direct:exactFull||terminal.direct};
  }
  function search(entries,input,opts){
    const options=opts||{},limit=Math.max(1,Math.min(50,Number(options.limit)||14));
    const raw=clean(input);
    // If full road+number is supplied, fall back only to explicitly typed
    // administrative prefix; never pretend the centroid is a house geocode.
    const fullStreet=isStreet(raw);
    let q=removeLot(raw);
    if(fullStreet){
      q=clean(raw.replace(/[가-힣0-9]+(?:대로|로|길)\s*\d+(?:-\d+)?(?:.*)$/,""));
      if(q.length<2)return [];
    }
    q=ROMAN[q]||q;
    if(q.length<2)return [];
    const tokens=splitQuery(q),found=[];
    const biased=isValidCoord(Number(options.biasLat),Number(options.biasLon));
    const originLat=Number(options.biasLat),originLon=Number(options.biasLon);
    for(const entry of entries||[]){
      const matched=match(entry,q,tokens);
      if(matched!==null){
        let proximity=0;
        if(biased){
          const km=Math.hypot((entry.lat-originLat)*111,(entry.lon-originLon)*88);
          if(km<8)proximity=Math.max(0,30-km*4);
        }
        found.push({entry,rank:matched.score+proximity,direct:matched.direct});
      }
    }
    // Ancestor-only matches are useful only when there is no result whose own
    // name matches the final query token. This prevents a gu/city search from
    // expanding into an arbitrary list of all child dongs or ri.
    const candidates=found.some(item=>item.direct)?found.filter(item=>item.direct):found;
    candidates.sort((a,b)=>b.rank-a.rank||a.entry.full.localeCompare(b.entry.full,"ko"));
    return candidates.slice(0,limit).map((x,index)=>({ ...x.entry,score:x.rank,best:index===0 }));
  }
  function toLocation(entry){
    if(!entry||!isValidCoord(entry.lat,entry.lon))return null;
    return {name:entry.name,lat:entry.lat,lon:entry.lon,source:"manual",
      administrative:entry.full,address:entry.full,approximate:true,regionCenter:true};
  }
  return Object.freeze({KIND,LABEL,load,search,clean,splitQuery,removeLot,isStreet,toLocation});
});
